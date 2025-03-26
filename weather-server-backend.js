const express = require('express'); // Import express module for creating server
const axios = require('axios'); // Import axios module for making HTTP requests
const dotenv = require('dotenv'); // Import dotenv module for reading .env file
const Redis = require('redis'); // Import redis module for caching data
const CORS = require('cors'); // Import cors module for enabling CORS
// const { promisify } = require('util'); // Import promisify function from util module for converting callback functions to promises
const rateLimit = require('express-rate-limit'); // Import express-rate-limit module for rate limiting requests
// const { url } = require('inspector');
const app = express(); // Create express server

//Load environment variables from .env file
dotenv.config();


//Redis client for caching data[Set up Redis client]
const redisClient = Redis.createClient(
{
    url: process.env.REDIS_URL, // Get the Redis URL from environment variable
    socket:
    {
        connectTimeout: 10000, // Set the connection timeout to 10 seconds
        reconnectStrategy: (attempts) => Math.min(attempts * 100, 3000) // Set the reconnection strategy to 3 seconds
    }
});

redisClient.on('error', (error) => console.log(`Redis client error: ${error}`)); // Log the Redis client error to the console
redisClient.on('connect', () => console.log('Redis client connected')); // Log the Redis client connection to the console
redisClient.on('reconnecting', () => console.log('Redis client reconnecting')); // Log the Redis client reconnection to the console

//Connect to Redis client
(async () =>
{
    await redisClient.connect();
})();

//Enable CORS for all requests
app.use(CORS());

//Set up middleware to parse JSON data
app.use(express.json());

//Set API key from environment variable and Base URL for making requests
// const API_KEY = process.env.WEATHER_API_KEY; // Get API key from environment variable
// const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather'; // Base URL for making requests,giving the current weather data from OpenWeatherMap API

const config =
{
    WEATHER_API_KEY: process.env.WEATHER_API_KEY, // Get API key from environment variable
    BASE_URL: 'https://api.openweathermap.org/data/2.5/weather', // Base URL for making requests,giving the current weather data from OpenWeatherMap API
    PORT: process.env.PORT || 3000, // Get the port from environment variable or use port 3000
    REDIS_URL: process.env.REDIS_URL, // Get the Redis URL from environment variable
    CACHE_TTL: parseInt(process.env.CACHE_TTL) || 43200, // Get the cache TTL from environment variable or use 12 hours in seconds
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // Get the rate limit window from environment variable or use 15 minutes
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100 // Get the rate limit maximum requests from environment variable or use 100 requests per window
};

//Validate the configuration settings[from environment variables]
if(!config.WEATHER_API_KEY)
{
    console.error('ERROR: WEATHER_API_KEY environment variable is required');
    process.exit(1);
}

//Set up rate limiting for the server
const limiter = rateLimit(
{
    windowMs: config.RATE_LIMIT_WINDOW, // Set the rate limit window to 15 minutes
    max: config.RATE_LIMIT_MAX, // Set the rate limit maximum requests to 100
    message: 'Too many requests, please try again later' // Set the rate limit message
});

//Apply rate limiting to all requests
app.use(limiter);

//Middleware to cache data in Redis for a specific time for logging purposes
app.use(async (req, res, next) =>
{
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`); // Log the request method, path and IP address to the console
    next(); // Move to the next middleware
});

/**
 * Fetches current data from the OpenWeatherMap API and caches it in Redis for a specific time
 * @param {string} locationQuery - The location query string to get the weather data for
 * @param {Object} units - The units to use for the weather data[metric,imperial,standard]
 * @returns {Promise<Object>} - The weather data for the location[response data from the API]
*/

async function fetchWeatherWithCache(locationQuery, units = 'metric')
{
    // Create a cache key with the location and units
    const cacheKey = `weather: ${locationQuery}:${units}`;

    // Check if the cache key exists in Redis
    try
    {
        const cachedData = await redisClient.get(cacheKey); // Get the cached data from Redis

        if(cachedData)
        {
            console.log(`Cache hit for ${cacheKey}`); // Log the cache hit to the console
            return JSON.parse(cachedData); // Return the cached data if it exists
        }

        console.log(`Cache miss for ${cacheKey}, fetching from API`); // Log the cache miss to the console for debugging purposes
        
        //Fetch fresh data from the OpenWeatherMap API
        // Make a request to OpenWeatherMap API to get the current weather data using the axios module[axios.get() method]
        // The response data will be stored in the response variable
        const response = await axios.get(config.BASE_URL, 
        {
            params: 
            {
                q: locationQuery,
                units: units,
                appid: config.WEATHER_API_KEY
            }
        });
        
        const weatherData = response.data; // Get the weather data from the response
        
        //Format the response data to send to the client
        const formattedResponse = 
        {
            location:
            {
                city: weatherData.name,
                country: weatherData.sys.country,
                coordinates:
                {
                    lon: weatherData.coord.lon,
                    lat: weatherData.coord.lat
                }
            },
            weather:
            {
                condition: weatherData.weather[0].main,
                description: weatherData.weather[0].description,
                temperature:
                {
                    current: weatherData.main.temp,
                    high: weatherData.main.temp_max,
                    low: weatherData.main.temp_min,
                    feelsLike: weatherData.main.feels_like
                },
                pressure: weatherData.main.pressure,
                humidity: weatherData.main.humidity,
                wind:
                {
                    speed: weatherData.wind.speed,
                    direction: weatherData.wind.deg || 0
                },
                visibility: weatherData.visibility || 0,
                sunrise: weatherData.sys.sunrise,
                sunset: weatherData.sys.sunset,
                cloudiness: weatherData.clouds.all
            },
            timestamp: new Date(weatherData.dt * 1000).toISOString(),
            units: units
        };

        //Cache the formatted response data in Redis for a specific time
        await redisClient.set(cacheKey, JSON.stringify(formattedResponse),
        {
            'EX': config.CACHE_TTL // Set the cache TTL to 12 hours
        });

        return formattedResponse; // Return the formatted response data

    }catch(error)
    {
        console.error(`Error occurred when fetching cached data: ${error.message}`); // Log the error message to the console
        throw error; // Rethrow the error to be handled by the route handler
    }
}

//Create a route to get the current weather data[GET request]
app.get('/weather', async (req, res) => 
{
    try 
    {
        // Get the city, country and units from query parameter
        const { city, country, units ='metric'} = req.query;
        
        // Check if city is provided
        if(!city) 
        {
        // Send an error message to the client if city is not provided with status code 400
        return res.status(400).json({ error: 'City is required' });
        }
        
        // Create a location query string with city and country if provided or just city
        const locationQuery = country ? `${city},${country}` : city; // if country is provided, return {city,country} else return just the {city}
        
        // Log the location query to the console for debugging purposes 
        console.log(`Requesting weather data for ${locationQuery}`);
        
        //Get weather data from cache or fetch from the OpenWeatherMap API
        const formattedResponse = await fetchWeatherWithCache(locationQuery, units);

        // // Make a request to OpenWeatherMap API to get the current weather data using the axios module[axios.get() method]
        // // The response data will be stored in the response variable
        // const response = await axios.get(`${BASE_URL}`, 
        //     {
        //         params: 
        //         {
        //             q: locationQuery,
        //             units: units,
        //             appid: API_KEY
        //         }
        //     });
            
        //     const weatherData = response.data; // Get the weather data from the response
            
        //     //Format the response data to send to the client
        //     const formattedResponse = 
        //     {
        //         location:
        //         {
        //             city: weatherData.name,
        //             country: weatherData.sys.country,
        //             coordinates:
        //             {
        //                 lon: weatherData.coord.lon,
        //                 lat: weatherData.coord.lat
        //             }
        //         },
        //         weather:
        //         {
        //             condition: weatherData.weather[0].main,
        //             description: weatherData.weather[0].description,
        //             temperature:
        //             {
        //                 current: weatherData.main.temp,
        //                 high: weatherData.main.temp_max,
        //                 low: weatherData.main.temp_min,
        //                 feelsLike: weatherData.main.feels_like
        //             },
        //             pressure: weatherData.main.pressure,
        //             humidity: weatherData.main.humidity,
        //             wind:
        //             {
        //                 speed: weatherData.wind.speed,
        //                 direction: weatherData.wind.deg || 0
        //             },
        //             visibility: weatherData.visibility || 0,
        //             sunrise: weatherData.sys.sunrise,
        //             sunset: weatherData.sys.sunset,
        //             cloudiness: weatherData.clouds.all
        //         },
        //         timestamp: new Date(weatherData.dt * 1000).toISOString(),
        //         units: units
        //     };

        //Send the formatted response to the client
        res.json(formattedResponse);
    } catch (error) 
    {
        // Log the error message to the console for debugging purposes
        console.log(`Errror occurred when fetching weather data: ${error.message}`);
        
        // Check if the error is from the OpenWeatherMap API[Handle API-specific errors] 
        if(error.response) 
        {
            return res.status(error.response.status).json(
                {
                    error: 'Failed to get weather data from OpenWeatherMap API',
                    details: error.response.data.message || 'Unknown error'
                });
        }

        // Send a generic error message to the client with status code 500 if an error occurs
        res.status(500).json(
            {
                error: 'Internal server error',
                details: error.message
            });
    }
});

/**
 * Fetches forecast data from the OpenWeatherMap API and caches it in Redis for a specific time
 * @param {string} locationQuery - The location query string to get the forecast data for
 * @param {Object} units - The units to use for the forecast data[metric,imperial,standard]
 * @returns {Promise<Object>} - The forecast data for the location[response data from the API]
*/

async function fetchForecastWithCache(locationQuery, units = 'metric')
{
    // Create a cache key with the location and units
    const cacheKey = `forecast: ${locationQuery}:${units}`;

    // Check if the cache key exists in Redis
    try
    {
        const cachedData = await redisClient.get(cacheKey); // Get the cached data from Redis

        if(cachedData)
        {
            console.log(`Cache hit for ${cacheKey}`); // Log the cache hit to the console
            return JSON.parse(cachedData); // Return the cached data if it exists
        }

        console.log(`Cache miss for ${cacheKey}, fetching from API`); // Log the cache miss to the console for debugging purposes
        
        //Fetch fresh data from the OpenWeatherMap API
        // Make a request to OpenWeatherMap API to get the forecast data using the axios module[axios.get() method]
        // The response data will be stored in the response variable
        const response = await axios.get(config.BASE_URL, 
        {
            params: 
            {
                q: locationQuery,
                units: units,
                appid: config.WEATHER_API_KEY
            }
        });
        
        const forecastData = response.data; // Get the forecast data from the response
        
        //Process and format the forecast data to send to the client
        const formattedForecast = 
        {
            location:
            {
                city: forecastData.city.name,
                country: forecastData.city.country,
                coordinates:
                {
                    lon: forecastData.city.coord.lon,
                    lat: forecastData.city.coord.lat
                }
            },
            forecast: [],
            units: units
        };
        
        //Group the forecast data by date/days
        const forecastByDays = {};
        
        // Iterate through the forecast list and format each forecast data
        forecastData.list.forEach(item => 
        {
            const date = new Date(item.dt * 1000).toISOString().split('T')[0]; // Get the date from the forecast data
        
            if(!forecastByDays[date])
            {
                forecastByDays[date] = [];
            }
        
            forecastByDays[date].push(
                {
                    timestamp: new Date(item.dt * 1000).toISOString().split('T')[1].substring(0, 5),
                    temperature: item.main.temp,
                    condition: item.weather[0].main,
                    description: item.weather[0].description,
                    pressure: item.main.pressure,
                    humidity: item.main.humidity,
                    wind_speed: item.wind.speed,
                    feelsLike: item.main.feels_like,
                });
        });

        // Iterate through the forecastByDays object and push the forecast data to the formattedForecast object
        //Add formatted days to response
        Object.entries(forecastByDays).forEach(([date, entries]) =>
        {
            formattedForecast.forecast.push(
                {
                    date,
                    entries
                });
        });

        //Cache the formatted forecast data in Redis for a specific time
        await redisClient.set(cacheKey, JSON.stringify(formattedForecast),
        {
            'EX': config.CACHE_TTL // Set the cache TTL to 12 hours
        });

        return formattedForecast; // Return the formatted forecast data

    }catch(error)
    {
        console.error(`Error occurred when fetching forecast data: ${error.message}`); // Log the error message to the console
        throw error; // Rethrow the error to be handled by the route handler
    }
}

// Create a route to get the weather forecast data[GET request]
app.get('/forecast', async (req, res) =>
{
    try
    {
        const { city, country, units = 'metric' } = req.query; // Get the city, country and units from query parameter
    
        if(!city) 
        {
            // Send an error message to the client if city is not provided with status code 400
            return res.status(400).json({ error: 'City is required' });
        }
    
        const locationQuery = country ? `${city},${country}` : city; // Create a location query string with city and country if provided or just city
    
        console.log(`Requesting forecast data for ${locationQuery}`); // Log the location query to the console for debugging purposes
        
        //Get forecast data from cache or fetch from the OpenWeatherMap API
        const formattedForecast = await fetchForecastWithCache(locationQuery, units);
        // const response = await axios.get(`${BASE_URL}/forecast`, 
        // {
        //     params: 
        //     {
        //         q: locationQuery,
        //         units: units,
        //         appid: API_KEY
        //     }
        // });
    
        // const forecastData = response.data; // Get the forecast data from the response
    
        // //Process and format the forecast data to send to the client
        // const formattedForecast = 
        // {
        //     location:
        //     {
        //         city: forecastData.city.name,
        //         country: forecastData.city.country,
        //         coordinates:
        //         {
        //             lon: forecastData.city.coord.lon,
        //             lat: forecastData.city.coord.lat
        //         }
        //     },
        //     forecast: [],
        //     units: units
        // };
    
        // //Group the forecast data by date/days
        // const forecastByDays = {};
    
        // // Iterate through the forecast list and format each forecast data
        // forecastData.list.forEach(item => 
        // {
        //     const date = new Date(item.dt * 1000).toISOString().split('T')[0]; // Get the date from the forecast data
    
        //     if(!forecastByDays[date])
        //     {
        //         forecastByDays[date] = [];
        //     }
    
        //     forecastByDays[date].push(
        //         {
        //             timestamp: new Date(item.dt * 1000).toISOString().split('T')[1].substring(0, 5),
        //             temperature: item.main.temp,
        //             condition: item.weather[0].main,
        //             description: item.weather[0].description,
        //             pressure: item.main.pressure,
        //             humidity: item.main.humidity,
        //             wind_speed: item.wind.speed,
        //             feelsLike: item.main.feels_like,
        //         });
        // });
    
        // // Iterate through the forecastByDays object and push the forecast data to the formattedForecast object
        // //Add formatted days to response
        // Object.entries(forecastByDays).forEach(([date, entries]) => 
        // {
        //     formattedForecast.forecast.push(
        //         {
        //             date,
        //             entries
        //         });
        // });
    
        res.json(formattedForecast); // Send the formatted forecast data to the client   
    }catch(error)
    {
        console.log(`Error occurred when fetching forecast data: ${error.message}`); // Log the error message to the console for debugging purposes
    
        if(error.response) 
        {
            return res.status(error.response.status).json(
                {
                    error: 'Failed to get forecast data from OpenWeatherMap API',
                    details: error.response.data.message || 'Unknown error'
                });
        }
    
        res.status(500).json(
            {
                error: 'Internal server error',
                details: error.message
            });
    }
});

//Health check endpoint to check if the server is running, uptime and timestamp
app.get('/health', (req, res) => 
{
    res.json({ status: 'Server is running', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

//Set the port for the server to listen on[Start the server]
// const PORT = process.env.PORT || 3000; // Get the port from environment variable or use port 3000
const PORT = config.PORT; // Get the port from the configuration settings
app.listen(PORT, () =>
{
    console.log(`Server is running on http://localhost:${PORT}`);// Log the server URL to the console
});

//Export the app module for testing purposes
module.exports = app;
