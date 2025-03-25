const axios = require('axios');

//Initialize the modal
MicroModal.init();

//Select DOM elements
const hour = document.getElementById('hour');
const minute = document.getElementById('minute');
const second = document.getElementById('second');
const day = document.getElementById('day');
const openModalButton = document.getElementById('openModal');
const saveTimezoneButton = document.getElementById('saveTimezone');
const timezoneSelect = document.getElementById('timezoneSelect');
const selectedTimezoneDisplay = document.getElementById('selectedTimezoneDisplay');

//Configuration for weather API to the frontend
const API_BASE_URL = 'http://localhost:3000'; //API base URL can be updated to match the backend server URL
let selectedUnits = 'metric'; //Default to metric units

//Utility functions 

//Function to get the temperature in the selected units
function formatTemperature(temp) 
{
    return `${Math.round(temp)}°${selectedUnits === 'metric' ? 'C' : 'F'}`;
}

//Function to get the weather icons based on the weather condition
function getWeatherIcon(condition) 
{
    const icons = 
    {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧',
        'Snow': '❄️',
        'Thunderstorm': '⛈️',
        'Mist': '🌫️',
        'Smoke': '💨',
        'Drizzle': '🌦️',
    };
    return icons[condition] || '🌈';
}

//Fuction to fetch the weather data based on the city name
async function fetchWeatherData(city) 
{
    try 
    {
        const response = await fetch(`${API_BASE_URL}/weather?city=${city}&units=${selectedUnits}`);

        if (!response.ok) 
        {
            throw new Error('Failed to fetch Weather data');
        }

        return await response.json();
    } catch (error) 
    {
        console.error('Error occurred while fetching Weather data', error);
        hour.textContent = 'Error';
        minute.textContent = 'Fetching';
        second.textContent = 'Data';
        throw error;
    }
}

//Function to update the weather data display
function updateWeatherData(weatherData) 
{
    const { location, weather } = weatherData;

    //Update main display with temperature and weather condition
    hour.textContent = formatTemperature(weather.temperature.current);
    hour.insertAdjacentText('beforeend', getWeatherIcon(weather.condition));

    //Use minute to show additional weather information
    minute.textContent = `Feels like ${formatTemperature(weather.temperature.feelsLike)}`;

    //Use second for additional weather information
    second.textContent = `${weather.description}`;

    //Update day with the location city name
    day.textContent = `${location.city}, ${location.country}`;

    //Update selected timezone display
    selectedTimezoneDisplay.textContent = `${location.city}, ${location.country}`;
}

//Adding Event Listeners for the modal open and save buttons
openModalButton.addEventListener('click', async () =>
{
    //Populate city input when modal opens
    const currentCity = day.textContent.split(',')[0].trim();

    //Create input element for city
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
    <input type="text" id="cityInput" class="timezone-select" placeholder="Enter city name" value="${currentCity}" required>
    <div style="margin-top: 10px;">
        <label>
            <input type="radio" name="units" value="metric" ${selectedUnits === 'metric' ? 'checked' : ''}>
            Imperial (°F)
        </label>
    </div>
    `;

    //Open the modal
    MicroModal.show('timezoneModal');
});

saveTimezoneButton.addEventListener('click', async () =>
{
    //Get the city name from the input field
    const cityInput = document.getElementById('cityInput');
    const unitsRadios = document.querySelectorAll('input[name="units"]');

   //Determine the selected units
   unitsRadios.forEach(radio =>
    {
        if (radio.checked)
        {
            selectedUnits = radio.value;
        }
    });
    
    try 
    {
        //Fetch and update weather for the new city
        const weatherData = await fetchWeatherData(cityInput.value);
        updateWeatherData(weatherData);

        //Close the modal
        MicroModal.close('timezoneModal');
    } catch (error) 
    {
        alert('Could not fetch weather data for the city. Please try again.');
    }
});

//Initial load (you can set a default city here)
async function initializeWeather()
{
    try 
    {
        //Fetch and update weather for the default city
        const weatherData = await fetchWeatherData('Mumbai');
        updateWeatherData(weatherData);
    } catch (error) 
    {
        alert('Initial weather data failed to load:', error);
    }
}

//Initialize the application
initializeWeather();
