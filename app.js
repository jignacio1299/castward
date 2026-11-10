let nwsPeriods = []; // Cached NWS hourly forecast periods
let previousScreen = "screen-home"; // Remembers where you opened Hourly Forecast from

// 1. Screen Navigation
function showScreen(screenId) {
  const currentActive = document.querySelector(".screen.active");
  if (
    currentActive &&
    currentActive.id !== screenId &&
    screenId === "screen-hourly"
  ) {
    previousScreen = currentActive.id;
  }

  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });
}

document.addEventListener("click", (e) => {
  const navTrigger = e.target.closest("[data-target]");
  if (navTrigger) {
    e.preventDefault();
    showScreen(navTrigger.dataset.target);
    return;
  }

  const backTrigger = e.target.closest(".js-back-btn");
  if (backTrigger) {
    e.preventDefault();
    showScreen(previousScreen);
  }
});

// 2. Time Formatting Helpers
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesTo12Hr(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours24 >= 12 ? "p.m." : "a.m.";
  const hours12 = hours24 % 12 || 12;
  const paddedMins = String(mins).padStart(2, "0");
  return `${hours12}:${paddedMins} ${period}`;
}

// 3. Dynamically Calculate Expected Finish & Return Status
function updateRunCalculations() {
  const startInput =
    document.getElementById("start-time-input").value || "06:30";
  const durationInput =
    parseInt(document.getElementById("duration-input").value, 10) || 0;
  const homeByInput = document.getElementById("home-by-input").value;

  const startMins = parseTimeToMinutes(startInput);
  const finishMins = startMins + durationInput;
  const homeByMins = parseTimeToMinutes(homeByInput);

  const formattedStart = formatMinutesTo12Hr(startMins);
  const formattedFinish = formatMinutesTo12Hr(finishMins);
  const summaryText = `${formattedStart.replace(
    / [ap]\.m\./,
    ""
  )}–${formattedFinish} · ${durationInput} min`;

  // Update Expected Finish and Summary Banners
  document.getElementById("expected-finish").textContent = formattedFinish;
  document.getElementById("window-summary-time").textContent = summaryText;
  document.getElementById("forecast-summary-time").textContent = summaryText;

  const windowHomeByEl = document.getElementById("window-home-by");
  if (windowHomeByEl) {
    windowHomeByEl.textContent =
      homeByMins !== null ? formatMinutesTo12Hr(homeByMins) : "None";
  }

  // Compare Expected Finish with Home By time
  const lateBox = document.getElementById("late-return-box");
  const lateText = document.getElementById("late-return-text");
  const planReturnStatus = document.getElementById("plan-return-status");
  const primaryBtn = document.getElementById("window-primary-btn");
  const secondaryBtn = document.getElementById("window-secondary-btn");

  if (homeByMins !== null && finishMins > homeByMins) {
    const lateBy = finishMins - homeByMins;
    const formattedHomeBy = formatMinutesTo12Hr(homeByMins);

    lateBox.classList.remove("hidden");
    lateText.textContent = `This run ends ${lateBy} minute${
      lateBy === 1 ? "" : "s"
    } after ${formattedHomeBy}`;

    if (planReturnStatus) {
      planReturnStatus.textContent = `⚠️ Ends ${lateBy} min after your ${formattedHomeBy} return target.`;
      planReturnStatus.style.color = "#855213";
    }

    primaryBtn.textContent = "Edit start or duration";
    secondaryBtn.textContent = "Compare times";
  } else {
    lateBox.classList.add("hidden");

    if (planReturnStatus) {
      planReturnStatus.textContent =
        "Run time only. Allow extra time for travel, changing and showering.";
      planReturnStatus.style.color = "#5c645d";
    }

    primaryBtn.textContent = "Compare times";
    secondaryBtn.textContent = "Indoor option";
  }

  // Update weather & 3-hour forecast cards starting from the user's chosen hour
  const startHour24 = Math.floor(startMins / 60);
  renderWeatherForHour(startHour24);
  renderHourlyForecastCards(startHour24);
}

["start-time-input", "duration-input", "home-by-input"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", updateRunCalculations);
  }
});

// 4. Match Selected Hour to NWS Weather Data
function renderWeatherForHour(targetHour24) {
  const matchingPeriod =
    nwsPeriods.find((p) => {
      return new Date(p.startTime).getHours() === targetHour24;
    }) || nwsPeriods[0];

  let temp = 63;
  let rainChance = targetHour24 < 7 ? 25 : 22;
  let windSpeed = "10 mph";
  let windDir = "NNE";
  let shortForecast =
    targetHour24 < 7
      ? "Chance Showers And Thunderstorms"
      : "Slight Chance Rain Showers";

  if (matchingPeriod) {
    temp = matchingPeriod.temperature;
    rainChance = matchingPeriod.probabilityOfPrecipitation?.value ?? 0;
    windSpeed = matchingPeriod.windSpeed;
    windDir = matchingPeriod.windDirection;
    shortForecast = matchingPeriod.shortForecast;
  }

  document.getElementById("win-temp").textContent = `${temp}°F`;
  document.getElementById("win-rain").textContent = `${rainChance}%`;
  document.getElementById("win-wind").textContent = windSpeed;

  document.getElementById("temp-value").textContent = `${temp}°F`;
  document.getElementById("rain-value").textContent = `${rainChance}%`;
  document.getElementById("wind-value").textContent = `${windSpeed} ${windDir}`;

  const windowCard = document.getElementById("window-status-card");
  const windowTitle = document.getElementById("window-status-title");
  const windowDesc = document.getElementById("window-status-desc");

  const alertBox = document.getElementById("alert-box");
  const alertTitle = document.getElementById("alert-title");
  const alertDesc = document.getElementById("alert-desc");

  windowCard.classList.remove("danger", "caution", "clear");
  alertBox.classList.remove("danger", "caution", "clear");

  const forecastLower = shortForecast.toLowerCase();

  if (forecastLower.includes("thunder") || rainChance >= 50) {
    windowCard.classList.add("danger");
    alertBox.classList.add("danger");
    windowTitle.textContent = "Reconsider";
    windowDesc.textContent =
      "Thunderstorms are in the forecast for this window.";
    alertTitle.textContent = "Thunderstorms in this window";
  } else if (
    forecastLower.includes("shower") ||
    forecastLower.includes("rain") ||
    rainChance >= 20
  ) {
    windowCard.classList.add("caution");
    alertBox.classList.add("caution");
    windowTitle.textContent = "Use caution";
    windowDesc.textContent =
      "Showers are possible. A low chance does not mean no rain.";
    alertTitle.textContent = "Showers are still possible";
  } else {
    windowCard.classList.add("clear");
    alertBox.classList.add("clear");
    windowTitle.textContent = "Good window to run";
    windowDesc.textContent = "Conditions look clear for your planned window.";
    alertTitle.textContent = "Clear conditions in this window";
  }

  alertDesc.textContent = `${shortForecast}. Rain chance: ${rainChance}%.`;
}

// 5. Render the 3-Hour Cards on the Hourly Forecast Screen
function renderHourlyForecastCards(startHour24) {
  const grid = document.getElementById("hourly-cards-grid");
  if (!grid) return;

  const fallbackHours = [
    {
      temp: 63,
      rain: 25,
      wind: "10 mph NNE",
      desc: "Chance Showers And Thunderstorms",
      humidity: 90,
    },
    {
      temp: 63,
      rain: 22,
      wind: "10 mph NNE",
      desc: "Slight Chance Rain Showers",
      humidity: 90,
    },
    {
      temp: 62,
      rain: 21,
      wind: "10 mph NNE",
      desc: "Slight Chance Rain Showers",
      humidity: 90,
    },
  ];

  let startIndex = nwsPeriods.findIndex(
    (p) => new Date(p.startTime).getHours() === startHour24
  );
  if (startIndex === -1) startIndex = 0;

  const cardsHtml = [0, 1, 2]
    .map((offset) => {
      const hour24 = (startHour24 + offset) % 24;
      const timeLabel = formatMinutesTo12Hr(hour24 * 60);
      const period = nwsPeriods[startIndex + offset];
      const fallback = fallbackHours[offset];

      const temp = period ? period.temperature : fallback.temp;
      const rain = period
        ? period.probabilityOfPrecipitation?.value ?? 0
        : fallback.rain;
      const wind = period
        ? `${period.windSpeed} ${period.windDirection}`
        : fallback.wind;
      const desc = period ? period.shortForecast : fallback.desc;
      const humidity = period
        ? period.relativeHumidity?.value ?? 90
        : fallback.humidity;
      const icon = rain >= 20 ? "🌧️" : "⛅";

      return `
      <div class="hour-card">
        <strong class="hour-time">${timeLabel}</strong>
        <span class="hour-icon">${icon}</span>
        <strong class="hour-main">${temp}°F · rain ${rain}%</strong>
        <p class="hour-desc">${wind} · ${desc}</p>
        <span class="hour-humidity">Humidity: ${humidity}%</span>
      </div>
    `;
    })
    .join("");

  grid.innerHTML = cardsHtml;
}

// 6. Fetch Live 24-Hour NWS Forecast for Chicago
async function fetchNWSWeather() {
  try {
    const res = await fetch(
      "https://api.weather.gov/gridpoints/LOT/76,73/forecast/hourly"
    );
    const data = await res.json();
    nwsPeriods = data.properties.periods.slice(0, 24);
    updateRunCalculations();
  } catch (err) {
    console.warn("Using fallback forecast data:", err);
    updateRunCalculations();
  }
}

// Replace "Wed, Oct 14" with the current date across all pages
const todayStr = new Date().toLocaleDateString("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
document.querySelectorAll(".current-date").forEach((el) => {
  el.textContent = todayStr;
});

updateRunCalculations();
fetchNWSWeather();
