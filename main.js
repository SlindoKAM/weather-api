const express = require('express'); // Import express module for creating server
const axios = require('axios'); // Import axios module for making HTTP requests
const dotenv = require('dotenv'); // Import dotenv module for reading .env file
const app = express(); // Create express server

//Load environment variables from .env file
dotenv.config();

//Set up middleware to parse JSON data
app.use(express.json());

//Set API key from environment variable and Base URL for making requests
const API_KEY = process.env.WEATHER_API_KEY || 'your_api_key'; // Get API key from environment variable
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather'; // Base URL for making requests,giving the current weather data from OpenWeatherMap API

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
        
        // Make a request to OpenWeatherMap API to get the current weather data using the axios module[axios.get() method]
        // The response data will be stored in the response variable
        const response = await axios.get(`${BASE_URL}/weather`, 
        {
            params: 
            {
                q: locationQuery,
                units: units,
                appid: API_KEY
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

        //Send the formatted response to the client
        res.json(formatedResponse);
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
    
        const response = await axios.get(`${BASE_URL}/forecast`, 
        {
            params: 
            {
                q: locationQuery,
                units: units,
                appid: API_KEY
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
const PORT = process.env.PORT || 3000; // Get the port from environment variable or use port 3000
app.listen(PORT, () =>
{
    console.log(`Server is running on http://localhost:${PORT}`);// Log the server URL to the console
});

//Export the app module for testing purposes
module.exports = main;
