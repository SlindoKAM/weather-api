//Weather API Integration
document.addEventListener('DOMContentLoaded', function() 
{
    //Initialise the weather API
    const API_BASE_URL = 'http://localhost:3000/weather'; // In production this URL will need to be changed to your actually server URL
    let currentCity = 'Johannesburg'; //Default city
    let currentUnits = 'metric'; //Default units(metric/imperial)

    //DOM Elements
    const searchForm = document.getElementById('searchForm');
    const cityInput = document.getElementById('cityInput');
    const countryInput = document.getElementById('countryInput');
    const unitsToggle = document.getElementById('unitsToggle'); 
    const currentWeatherContainer = document.getElementById('currentWeatherContainer');
    const forecastContainer = document.getElementById('forecastContainer');
    const errorMessage = document.getElementById('errorMessage');

    //Initialize the UI
    loadSavedPreferences(); //Load the saved preferences

    //Event Listeners
    searchForm.addEventListener('submit', function(event) 
    {
        event.preventDefault();
        const city = cityInput.value.trim();
        const country = countryInput.value.trim();

        //Check if the city is empty
        if (city) 
        {
            currentCity = city;
            fetchWeatherData(city, country, currentUnits); //Fetch the weather data
            savePreferences(); //Save the preferences
        }else
        {
            showError('Please enter a city name');
        }
    });

    unitsToggle.addEventListener('change', function() 
    {
        currentUnits = this.checked ? 'imperial' : 'metric'; //Toggle between metric and imperial checking if the units is in imperial else metric
        fetchWeatherData(currentCity, '', currentUnits);
        savePreferences();
    });

    //Fetch the weather data from the API
    function fetchWeatherData(city, country = '', units = 'metric') 
    {
        //Show the loading spinner and clearing of the Error message
        showLoading();
        clearError();

        //Construct query parameters for the API
        const params = new URLSearchParams(
        {
            city: city,
            units: units
        });

        //Add the country parameter if it is provided
        if (country) 
        {
            params.append('country', country);
        }

        //Fetch the current weather data from the API
        fetch(`${API_BASE_URL}?{params}`)
            .then(response => 
            {
                if (!response.ok) 
                {
                    return response.json().then(error => Promise.reject(error));
                }
                return response.json();
            })
            .then(data => 
            {
                displayCurrentWeather(data);
                return fetch(`${API_BASE_URL}?${params}`);
            })
            .then(response => 
            {
                if (!response.ok) 
                {
                    return response.json().then(error => Promise.reject(error));
                }
                return response.json();
            })
            .then(data => 
            {
                displayForecast(data);
                hideLoading();
            })
            .catch(error =>
            {
                console.error('Error Fetching weather data:', error);
                showError(error.details || 'An error occurred while fetching weather data');
                hideLoading();
            });
    }

    //Display the current weather data
    function displayCurrentWeather(data)
    {
        const tempUnit = currentUnits === 'metric' ? '°C' : '°F';
        const windSpeedUnit = currentUnits === 'metric' ? 'm/s' : 'mph';
        const pressureUnit = 'hPa';

        const weatherIcinClass = getWeatherIconClass(data.weather.condition);
        const dateTime = new Date(data.timestamp);
    }
});