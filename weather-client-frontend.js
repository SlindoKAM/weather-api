dayjs.extend(dayjs_plugin_utc);
dayjs.extend(dayjs_plugin_timezone);

MicroModal.init();

const hour = document.getElementById('hour');
const minute = document.getElementById('minute');
const second = document.getElementById('second');
const day = document.getElementById('day');
const openModalBtn = document.getElementById('openModal');
const saveTimezoneBtn = document.getElementById('saveTimezone');
const timezoneSelect = document.getElementById('timezoneSelect');
const selectedTimezoneDis = document.getElementById('selectedTimezoneDisplay');

//Default Timezone
let selectedTimezone = 'UTC';

//Fetch all available timezone
const timezones = Intl.supportedValuesOf('timeZone')

//Function to update the time based on the selected timezone
function updateTime()
{
    const now = dayjs().tz(selectedTimezone);
    day.textContent = now.format('DD MMM YYYY');
    hour.textContent = now.format('HH');
    minute.textContent = now.format('mm');
    second.textContent = now.format('ss');
}

//Event listener for the modal open button
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
    selectedTimezone = timezoneSelect.value;
    MicroModal.close('timezoneModal');

    //Update the displayed timezone
    selectedTimezoneDis.textContent = `Selected Timezone: ${selectedTimezone}`;
    
    //Update time immediately after selecting timezone
    updateTime();

    selectedTimezoneDis.style.display = 'flex';
});

//Update time every second
setInterval(updateTime, 1000);

//Initialize time using (Update function)
updateTime();
