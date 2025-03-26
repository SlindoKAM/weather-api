dayjs.extend(dayjs_plugin_utc);
dayjs.extend(dayjs_plugin_timezone);

MicroModal.init();

//Selecting DOM elements for time display
const hour = document.getElementById('hour');
const minute = document.getElementById('minute');
const second = document.getElementById('second');
const day = document.getElementById('day');

//Selecting DOM elements for timezone modal
const openModalButton = document.getElementById('openModal');
const saveTimezoneButton = document.getElementById('saveTimezone');
const timezoneSelect = document.getElementById('timezoneSelect');
const selectedTimezoneDisplay = document.getElementById('selectedTimezoneDisplay');

//Selecting DOM elements for weather display
const locationInput = document.getElementById('locationInput');
const fetchWeatherButton = document.getElementById('fetchWeather');
const weatherDisplay = document.getElementById('weatherDisplay');

let selectedTimezone = 'UTC';//Default Timezone
const timezones = Intl.supportedValuesOf('timeZone');//Fetch all available(supported) timezone

//Function to update the time based on the selected timezone
function updateTime()
{
    const now = dayjs().tz(selectedTimezone);
    day.textContent = now.format('DD MMM YYYY');
    hour.textContent = now.format('HH');
    minute.textContent = now.format('mm');
    second.textContent = now.format('ss');
}

//Event listener for the modal open button to populate timezone dropdown
openModalBtn.addEventListener('click', () =>
{
    //Populate dropdown dynamically
    timezoneSelect.innerHTML = '';
    timezones.forEach((timezone) =>
    {
        const option = document.createElement('option');
        option.value = timezone;
        option.textContent = timezone;
        timezoneSelect.appendChild(option);
    });

    MicroModal.show('timezoneModal');
});


//Event listener for the save timezone button
saveTimezoneBtn.addEventListener('click', () =>
{
    //Get the selected timezone
    selectedTimezone = timezoneSelect.value;

    //Update the displayed timezone
    selectedTimezoneDisplay.textContent = `Selected Timezone: ${selectedTimezone}`;
    
    //Update time immediately after selecting timezone
    updateTime();

    //Show the selected timezone display
    // selectedTimezoneDisplay.style.display = 'flex';
    
    //Close the modal
    MicroModal.close('timezoneModal');
});

//Fuction to fetch weather data
async function fetchWeather()
{
    //Get the location from the input field
    const location = locationInput.value.trim();
    
    //Check if the location is empty
    if(!location)
    {
        weatherDisplay.textContent = 'Please enter a city name.';
        return;
    }
    
    //Fetch weather data from the server
    try 
    {
        const response = await fetch(`/weather?city=${encodeURIComponent(location)}`);
        
        //Check if the response is not ok
        if(!response.ok)
        {
            throw new Error('Error: ${response.statusText}');
        }

        //Parse the response
        const weatherData = await response.json();

        //Update the weather display
        weatherDisplay.innerHTML = `
            Location: ${weatherData.location.city}, ${weatherData.location.country}<br>
            Condition: ${weatherData.weather.condition} - ${weatherData.weather.description}<br>
            Temperature: ${weatherData.weather.temperature.current}°C (Feels Like:${weatherData.weather.temperature.feelsLike}°C)<br>
            Humidity: ${weatherData.weather.humidity}%<br>
            Wind: ${weatherData.weather.wind.speed} m/s `;

        //Convert and upadate timezone based on the location
        const cityTimezone = `Etc/GMT${Math.round(weatherData.location.coordinates.lon/15 ) * -1}`;
        selectedTimezone = cityTimezone;
        selectedTimezoneDisplay.textContent = `Selected Timezone: ${selectedTimezone}`;
        updateTime();

    } catch (error) 
    {
        weatherDisplay.textContent = 'Error while fetching weather data. Please try again.';
        console.error(error);
    }
}

// Event listener to bind the fetchWeather function to the button on a click event
fetchWeatherButton.addEventListener('click', fetchWeather);

//Update time every second
setInterval(updateTime, 1000);

//Initialize time using (Update function)
updateTime();
