// Castward - Production Client Application (Live Weather, Geolocation & Local Persistence)
const STORAGE_KEY = "castward_user_state_v1";

function getDefaultDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultStartTimeString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  now.setMinutes(now.getMinutes() >= 30 ? 30 : 0, 0, 0);
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

const defaultState = {
  location: {
    name: "Chicago, IL",
    lat: 41.8818,
    lon: -87.6232
  },
  units: "F",
  activity: "run-walk",
  clothingPref: "usual",
  manualOverrides: {},
  selectedFeelingTag: "😄 Layering worked",
  annotations: [],
  savedRun: null,
  runStarted: false,
  runStartedAt: null,
  runCompleted: false
};

let appState = loadState();
let weatherState = {
  loading: true,
  error: null,
  source: "Loading...",
  retrievedAt: "Fetching live forecast...",
  alertStatus: "checking", // "clear" | "active" | "failed"
  alertHeadline: "Checking active weather alerts...",
  hours: [] // Normalized hourly objects: { timeISO, dateStr, hour24, tempF, rain, windSpeedMph, windSpeedLabel, windDir, shortForecast, humidity }
};

let previousScreen = "screen-home";
let runTimerInterval = null;
let comparedSlots = { slot1Time: "06:30", slot2Time: "07:30" };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      location: { ...defaultState.location, ...(parsed.location || {}) },
      manualOverrides: parsed.manualOverrides || {},
      annotations: Array.isArray(parsed.annotations) ? parsed.annotations : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (err) {
    console.warn("Unable to save state to localStorage:", err);
  }
}

function formatTemp(tempF) {
  if (tempF === null || tempF === undefined || Number.isNaN(tempF)) return "--";
  if (appState.units === "C") {
    const c = Math.round(((tempF - 32) * 5) / 9);
    return `${c}°C`;
  }
  return `${Math.round(tempF)}°F`;
}

function formatDateLabel(dateInputStr) {
  if (!dateInputStr) return "Today";
  const [y, m, d] = dateInputStr.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

// 1. Screen Navigation
function showScreen(screenId) {
  const currentActive = document.querySelector(".screen.active");
  if (currentActive && currentActive.id !== screenId && screenId === "screen-hourly") {
    previousScreen = currentActive.id;
  }

  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  const navMap = {
    "screen-home": "screen-home",
    "screen-location": "screen-home",
    "screen-plan": "screen-home",
    "screen-window": "screen-home",
    "screen-forecast": "screen-home",
    "screen-compare": "screen-home",
    "screen-hourly": "screen-home",
    "screen-clothing": "screen-clothing",
    "screen-saved": "screen-saved",
    "screen-indoor": "screen-saved",
    "screen-preferences": "screen-preferences"
  };
  const activeNavTarget = navMap[screenId] || "screen-home";
  document.querySelectorAll(".nav-pills .nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === activeNavTarget);
  });
}

document.addEventListener("click", (e) => {
  const navTrigger = e.target.closest("[data-target]");
  if (navTrigger) {
    e.preventDefault();
    if (navTrigger.id === "btn-save-clothing") {
      updateSavedClothingSummary();
      saveState();
    }
    if (navTrigger.id === "btn-confirm-indoor") {
      const summary = getCurrentRunSummary();
      summary.status = "Indoor session";
      appState.savedRun = summary;
      saveState();
      renderSavedRun();
    }
    showScreen(navTrigger.dataset.target);
    return;
  }

  const backTrigger = e.target.closest(".js-back-btn");
  if (backTrigger) {
    e.preventDefault();
    showScreen(previousScreen);
  }
});

// 2. Time Helpers
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

function formatMinutesTo24HrInput(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mins = String(normalized % 60).padStart(2, "0");
  return `${hours24}:${mins}`;
}

// 3. Live Weather Fetching (NWS primary for US + Open-Meteo fallback globally)
function degreesToCardinal(deg) {
  if (deg === null || deg === undefined) return "";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function wmoCodeToText(code) {
  const map = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    71: "Light Snow",
    73: "Moderate Snow",
    75: "Heavy Snow",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Heavy Rain Showers",
    95: "Thunderstorm",
    96: "Thunderstorm With Hail",
    99: "Severe Thunderstorm"
  };
  return map[code] || "Mixed Conditions";
}

async function fetchLiveWeatherForLocation(lat, lon) {
  weatherState.loading = true;
  weatherState.error = null;
  updateLocationAndDateLabels();

  const roundedLat = Number(lat).toFixed(4);
  const roundedLon = Number(lon).toFixed(4);
  const nowStr = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  // Attempt National Weather Service (NWS) API first (covers US locations with official alerts)
  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${roundedLat},${roundedLon}`, {
      headers: { Accept: "application/geo+json" }
    });

    if (pointRes.ok) {
      const pointData = await pointRes.json();
      const forecastHourlyUrl = pointData.properties?.forecastHourly;
      const gridId = pointData.properties?.gridId;
      const gridX = pointData.properties?.gridX;
      const gridY = pointData.properties?.gridY;

      if (forecastHourlyUrl) {
        const [hourlyRes, alertsRes] = await Promise.allSettled([
          fetch(forecastHourlyUrl, { headers: { Accept: "application/geo+json" } }),
          fetch(`https://api.weather.gov/alerts/active?point=${roundedLat},${roundedLon}`, {
            headers: { Accept: "application/geo+json" }
          })
        ]);

        if (hourlyRes.status === "fulfilled" && hourlyRes.value.ok) {
          const hourlyData = await hourlyRes.value.json();
          const periods = hourlyData.properties?.periods || [];

          weatherState.hours = periods.slice(0, 48).map((p) => {
            const dt = new Date(p.startTime);
            const year = dt.getFullYear();
            const month = String(dt.getMonth() + 1).padStart(2, "0");
            const day = String(dt.getDate()).padStart(2, "0");
            const windMatch = String(p.windSpeed || "").match(/\d+/);
            const windMph = windMatch ? parseInt(windMatch[0], 10) : 0;

            return {
              timeISO: p.startTime,
              dateStr: `${year}-${month}-${day}`,
              hour24: dt.getHours(),
              tempF: p.temperatureUnit === "C" ? Math.round((p.temperature * 9) / 5 + 32) : p.temperature,
              rain: p.probabilityOfPrecipitation?.value ?? 0,
              windSpeedMph: windMph,
              windSpeedLabel: p.windSpeed || `${windMph} mph`,
              windDir: p.windDirection || "",
              shortForecast: p.shortForecast || "Clear",
              humidity: p.relativeHumidity?.value ?? 65
            };
          });

          // Process official NWS alerts
          if (alertsRes.status === "fulfilled" && alertsRes.value.ok) {
            const alertsData = await alertsRes.value.json();
            const features = alertsData.features || [];
            if (features.length > 0) {
              weatherState.alertStatus = "active";
              weatherState.alertHeadline = features
                .map((f) => f.properties?.headline || f.properties?.event)
                .filter(Boolean)
                .join(" · ");
            } else {
              weatherState.alertStatus = "clear";
              weatherState.alertHeadline = "No active NWS alerts for this location.";
            }
          } else {
            weatherState.alertStatus = "failed";
            weatherState.alertHeadline = "Alerts check unavailable. Do not read this as an absence of alerts.";
          }

          weatherState.loading = false;
          weatherState.source = `NWS (${gridId} ${gridX},${gridY})`;
          weatherState.retrievedAt = `NWS · updated ${nowStr}`;
          updateAllViews();
          return;
        }
      }
    }
  } catch (nwsErr) {
    console.info("NWS endpoint unavailable for coordinates, falling back to Open-Meteo:", nwsErr);
  }

  // Fallback to Open-Meteo API (works worldwide, no API key required)
  try {
    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLon}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=3`;
    const omRes = await fetch(omUrl);
    if (!omRes.ok) throw new Error(`Weather request failed (${omRes.status})`);
    const omData = await omRes.json();

    const times = omData.hourly?.time || [];
    weatherState.hours = times.map((t, idx) => {
      const [datePart, timePart] = t.split("T");
      const hour24 = parseInt(timePart.split(":")[0], 10);
      const windMph = Math.round(omData.hourly.wind_speed_10m?.[idx] ?? 0);
      const windDir = degreesToCardinal(omData.hourly.wind_direction_10m?.[idx]);

      return {
        timeISO: t,
        dateStr: datePart,
        hour24,
        tempF: Math.round(omData.hourly.temperature_2m?.[idx] ?? 60),
        rain: Math.round(omData.hourly.precipitation_probability?.[idx] ?? 0),
        windSpeedMph: windMph,
        windSpeedLabel: `${windMph} mph`,
        windDir,
        shortForecast: wmoCodeToText(omData.hourly.weather_code?.[idx] ?? 0),
        humidity: Math.round(omData.hourly.relative_humidity_2m?.[idx] ?? 65)
      };
    });

    weatherState.alertStatus = "clear";
    weatherState.alertHeadline = "Hourly forecast loaded via Open-Meteo (check local meteorological agency for severe alerts).";
    weatherState.loading = false;
    weatherState.source = `Open-Meteo (${roundedLat}, ${roundedLon})`;
    weatherState.retrievedAt = `Open-Meteo · updated ${nowStr}`;
    updateAllViews();
  } catch (err) {
    weatherState.loading = false;
    weatherState.error = "Unable to reach live weather service. Check your internet connection and refresh.";
    weatherState.alertStatus = "failed";
    weatherState.alertHeadline = "Weather service unreachable. Alerts and hourly forecast could not be verified.";
    weatherState.retrievedAt = `Offline · failed at ${nowStr}`;
    updateAllViews();
  }
}

// 4. Match Selected Date & Hour to Live Forecast
function getHourData(targetHour24, targetDateStr) {
  const dateStr = targetDateStr || document.getElementById("run-date-input")?.value || getDefaultDateString();
  if (weatherState.hours.length > 0) {
    const exactMatch = weatherState.hours.find(
      (h) => h.dateStr === dateStr && h.hour24 === targetHour24
    );
    if (exactMatch) return exactMatch;

    const sameHourMatch = weatherState.hours.find((h) => h.hour24 === targetHour24);
    if (sameHourMatch) return sameHourMatch;

    return weatherState.hours[0];
  }

  return {
    tempF: null,
    rain: 0,
    windSpeedMph: 0,
    windSpeedLabel: "-- mph",
    windDir: "",
    shortForecast: weatherState.loading ? "Loading forecast..." : "Forecast unavailable",
    humidity: 0
  };
}

function classifyWindowCondition(hourObj) {
  if (!hourObj || hourObj.tempF === null) {
    return {
      level: "neutral-banner",
      badgeClass: "caution-pill",
      badgeText: "Unavailable",
      title: "Not enough information",
      desc: weatherState.error || "Waiting for live forecast data."
    };
  }

  const forecastLower = hourObj.shortForecast.toLowerCase();
  if (
    weatherState.alertStatus === "active" ||
    forecastLower.includes("thunder") ||
    forecastLower.includes("severe") ||
    hourObj.rain >= 60 ||
    hourObj.windSpeedMph >= 25
  ) {
    return {
      level: "danger",
      badgeClass: "danger-pill",
      badgeText: "Reconsider",
      title: "Reconsider",
      desc:
        weatherState.alertStatus === "active"
          ? weatherState.alertHeadline
          : `${hourObj.shortForecast} (${hourObj.rain}% precipitation, wind ${hourObj.windSpeedLabel}).`
    };
  }

  if (
    forecastLower.includes("shower") ||
    forecastLower.includes("rain") ||
    forecastLower.includes("drizzle") ||
    forecastLower.includes("snow") ||
    forecastLower.includes("fog") ||
    hourObj.rain >= 20 ||
    hourObj.windSpeedMph >= 16
  ) {
    return {
      level: "caution",
      badgeClass: "caution-pill",
      badgeText: "Use caution",
      title: "Use caution",
      desc: `${hourObj.shortForecast}. Rain chance is ${hourObj.rain}% with ${hourObj.windSpeedLabel} wind.`
    };
  }

  return {
    level: "clear",
    badgeClass: "clear-pill",
    badgeText: "Good window",
    title: "Good window to run",
    desc: `${hourObj.shortForecast} (${formatTemp(hourObj.tempF)}, ${hourObj.rain}% rain chance).`
  };
}

// 5. Update All UI Screens with Live Data
function updateLocationAndDateLabels() {
  const dateInputEl = document.getElementById("run-date-input");
  const dateLabel = formatDateLabel(dateInputEl?.value || getDefaultDateString());

  document.querySelectorAll(".current-location").forEach((el) => {
    el.textContent = appState.location.name;
  });

  document.querySelectorAll(".current-date").forEach((el) => {
    el.textContent = dateLabel;
  });

  const tsEl = document.getElementById("nws-timestamp");
  if (tsEl) tsEl.textContent = weatherState.retrievedAt;

  const sourceLabel = document.getElementById("hourly-source-label");
  if (sourceLabel) sourceLabel.textContent = weatherState.source;

  const prefSource = document.getElementById("pref-weather-source");
  const prefDetails = document.getElementById("pref-weather-details");
  if (prefSource) {
    prefSource.textContent = `${appState.location.name} · ${weatherState.source}`;
  }
  if (prefDetails) {
    prefDetails.textContent = `Coordinates: ${Number(appState.location.lat).toFixed(4)}, ${Number(
      appState.location.lon
    ).toFixed(4)} · ${weatherState.retrievedAt}`;
  }
}

function updateRunCalculations() {
  updateLocationAndDateLabels();

  const startInput = document.getElementById("start-time-input")?.value || "06:30";
  const durationInput = parseInt(document.getElementById("duration-input")?.value, 10) || 30;
  const homeByInput = document.getElementById("home-by-input")?.value || "";
  const dateStr = document.getElementById("run-date-input")?.value || getDefaultDateString();

  const startMins = parseTimeToMinutes(startInput);
  const finishMins = startMins + durationInput;
  const homeByMins = parseTimeToMinutes(homeByInput);

  const formattedStart = formatMinutesTo12Hr(startMins);
  const formattedFinish = formatMinutesTo12Hr(finishMins);
  const summaryText = `${formattedStart.replace(/ [ap]\.m\./, "")}–${formattedFinish} · ${durationInput} min`;

  document.getElementById("expected-finish").textContent = formattedFinish;
  document.getElementById("window-summary-time").textContent = summaryText;
  document.getElementById("forecast-summary-time").textContent = summaryText;

  const clothingTimeEl = document.getElementById("clothing-time-label");
  if (clothingTimeEl) clothingTimeEl.textContent = `${formattedStart} start`;

  const windowHomeByEl = document.getElementById("window-home-by");
  if (windowHomeByEl) {
    windowHomeByEl.textContent = homeByMins !== null ? formatMinutesTo12Hr(homeByMins) : "Flexible";
  }

  const lateBox = document.getElementById("late-return-box");
  const lateText = document.getElementById("late-return-text");
  const planReturnStatus = document.getElementById("plan-return-status");
  const primaryBtn = document.getElementById("window-primary-btn");
  const secondaryBtn = document.getElementById("window-secondary-btn");

  if (homeByMins !== null && finishMins > homeByMins) {
    const lateBy = finishMins - homeByMins;
    const formattedHomeBy = formatMinutesTo12Hr(homeByMins);

    lateBox.classList.remove("hidden");
    lateText.textContent = `This run ends ${lateBy} minute${lateBy === 1 ? "" : "s"} after ${formattedHomeBy}.`;

    if (planReturnStatus) {
      planReturnStatus.textContent = `⚠️ Ends ${lateBy} min after your ${formattedHomeBy} return target.`;
      planReturnStatus.style.color = "#855213";
    }

    primaryBtn.textContent = "Edit start or duration";
    primaryBtn.dataset.target = "screen-plan";
    secondaryBtn.textContent = "Compare times";
    secondaryBtn.dataset.target = "screen-compare";
  } else {
    lateBox.classList.add("hidden");

    if (planReturnStatus) {
      planReturnStatus.textContent = "Run time only. Allow extra time for travel, changing and showering.";
      planReturnStatus.style.color = "#5c645d";
    }

    primaryBtn.textContent = "Compare times";
    primaryBtn.dataset.target = "screen-compare";
    secondaryBtn.textContent = "Indoor option";
    secondaryBtn.dataset.target = "screen-indoor";
  }

  const startHour24 = Math.floor(startMins / 60);
  renderWeatherForHour(startHour24, dateStr);
  renderHourlyForecastCards(startHour24, dateStr);
  renderCompareScreen(startMins, durationInput, homeByMins, dateStr);
  updateClothingRecommendations(startHour24, dateStr);
  updateSavedClothingSummary();
  updateRunActionState();
}

function renderWeatherForHour(targetHour24, dateStr) {
  const h = getHourData(targetHour24, dateStr);

  const previewEl = document.getElementById("home-weather-preview");
  if (previewEl) {
    previewEl.textContent =
      h.tempF !== null
        ? `Currently ${formatTemp(h.tempF)} · ${h.shortForecast} in ${appState.location.name}`
        : weatherState.error || "Loading forecast...";
  }

  document.getElementById("win-temp").textContent = formatTemp(h.tempF);
  document.getElementById("win-rain").textContent = `${h.rain}%`;
  document.getElementById("win-wind").textContent = h.windSpeedLabel;

  document.getElementById("temp-value").textContent = formatTemp(h.tempF);
  document.getElementById("rain-value").textContent = `${h.rain}%`;
  document.getElementById("wind-value").textContent = `${h.windSpeedLabel} ${h.windDir}`.trim();

  const windowCard = document.getElementById("window-status-card");
  const windowTitle = document.getElementById("window-status-title");
  const windowDesc = document.getElementById("window-status-desc");

  const alertBox = document.getElementById("alert-box");
  const alertTitle = document.getElementById("alert-title");
  const alertDesc = document.getElementById("alert-desc");

  windowCard.classList.remove("danger", "caution", "clear", "neutral-banner");
  alertBox.classList.remove("danger", "caution", "clear", "neutral-banner");

  document.querySelectorAll(".official-alert-text").forEach((el) => {
    el.textContent = weatherState.alertHeadline;
  });

  if (weatherState.alertStatus === "failed" && h.tempF !== null) {
    windowCard.classList.add("neutral-banner");
    alertBox.classList.add("caution");
    windowTitle.textContent = "Alerts check unavailable";
    windowDesc.textContent = "Official alert status could not be verified. Hourly forecast values are shown below.";
    alertTitle.textContent = "Alerts not verified";
    alertDesc.textContent = `${h.shortForecast}. Rain chance: ${h.rain}%. Do not read a failed alert check as an absence of alerts.`;
    return;
  }

  const status = classifyWindowCondition(h);
  windowCard.classList.add(status.level);
  alertBox.classList.add(status.level);
  windowTitle.textContent = status.title;
  windowDesc.textContent = status.desc;
  alertTitle.textContent = status.title;
  alertDesc.textContent = `${h.shortForecast}. Rain chance: ${h.rain}%, Humidity: ${h.humidity}%.`;
}

// 6. Dynamic Compare Start Times Screen
function renderCompareScreen(startMins, durationInput, homeByMins, dateStr) {
  const slot1End = startMins + durationInput;
  const slot2Start = (startMins + 60) % 1440;
  const slot2End = slot2Start + durationInput;

  comparedSlots = {
    slot1Time: formatMinutesTo24HrInput(startMins),
    slot2Time: formatMinutesTo24HrInput(slot2Start)
  };

  const h1 = getHourData(Math.floor(startMins / 60), dateStr);
  const h2 = getHourData(Math.floor(slot2Start / 60), dateStr);
  const cond1 = classifyWindowCondition(h1);
  const cond2 = classifyWindowCondition(h2);

  const s1StartFormatted = formatMinutesTo12Hr(startMins);
  const s2StartFormatted = formatMinutesTo12Hr(slot2Start);
  const s1Text = `${s1StartFormatted.replace(/ [ap]\.m\./, "")}–${formatMinutesTo12Hr(slot1End)}`;
  const s2Text = `${s2StartFormatted.replace(/ [ap]\.m\./, "")}–${formatMinutesTo12Hr(slot2End)}`;

  document.getElementById("compare-duration-label").textContent = `${durationInput} minutes`;
  document.getElementById("compare-homeby-label").textContent =
    homeByMins !== null ? formatMinutesTo12Hr(homeByMins) : "flexible";

  // Update Card 1
  const card1 = document.getElementById("compare-card-1");
  const badge1 = document.getElementById("compare-badge-1");
  card1.className = `alert-box ${cond1.level}`;
  badge1.className = `pill-badge ${cond1.badgeClass}`;
  badge1.textContent = cond1.badgeText;
  document.getElementById("compare-slot1-title").textContent = s1Text;
  document.getElementById("compare-slot1-desc").textContent = `${h1.shortForecast} · ${formatTemp(
    h1.tempF
  )} · rain ${h1.rain}% · wind ${h1.windSpeedLabel} ${h1.windDir}`.trim();

  const c1Dead = document.getElementById("compare-slot1-deadline");
  if (homeByMins !== null) {
    const diff1 = homeByMins - slot1End;
    c1Dead.textContent =
      diff1 >= 0
        ? `✓ Finishes ${diff1} min before Home by ${formatMinutesTo12Hr(homeByMins)}`
        : `⚠️ Ends ${Math.abs(diff1)} min after Home by ${formatMinutesTo12Hr(homeByMins)}`;
  } else {
    c1Dead.textContent = `Finishes at ${formatMinutesTo12Hr(slot1End)}`;
  }

  // Update Card 2
  const card2 = document.getElementById("compare-card-2");
  const badge2 = document.getElementById("compare-badge-2");
  card2.className = `alert-box ${cond2.level}`;
  badge2.className = `pill-badge ${cond2.badgeClass}`;
  badge2.textContent = cond2.badgeText;
  document.getElementById("compare-slot2-title").textContent = s2Text;
  document.getElementById("compare-slot2-desc").textContent = `${h2.shortForecast} · ${formatTemp(
    h2.tempF
  )} · rain ${h2.rain}% · wind ${h2.windSpeedLabel} ${h2.windDir}`.trim();

  const c2Dead = document.getElementById("compare-slot2-deadline");
  if (homeByMins !== null) {
    const diff2 = homeByMins - slot2End;
    c2Dead.textContent =
      diff2 >= 0
        ? `✓ Finishes ${diff2} min before Home by ${formatMinutesTo12Hr(homeByMins)}`
        : `⚠️ Ends ${Math.abs(diff2)} min after Home by ${formatMinutesTo12Hr(homeByMins)}`;
  } else {
    c2Dead.textContent = `Finishes at ${formatMinutesTo12Hr(slot2End)}`;
  }

  // Dynamic Tradeoff Summary & Buttons
  const tradeoffEl = document.getElementById("compare-tradeoff-text");
  if (tradeoffEl) {
    const rainDiff = h2.rain - h1.rain;
    const tempDiff = (h2.tempF ?? 0) - (h1.tempF ?? 0);
    const rainPhrase =
      rainDiff === 0
        ? `the same rain chance (${h2.rain}%)`
        : rainDiff < 0
        ? `a lower rain chance (${h2.rain}% vs. ${h1.rain}%)`
        : `a higher rain chance (${h2.rain}% vs. ${h1.rain}%)`;
    const tempPhrase =
      tempDiff === 0
        ? `the same temperature (${formatTemp(h2.tempF)})`
        : `a ${tempDiff > 0 ? "warmer" : "cooler"} temperature (${formatTemp(h2.tempF)} vs. ${formatTemp(h1.tempF)})`;

    tradeoffEl.textContent = `Starting at ${s2StartFormatted} gives ${rainPhrase} and ${tempPhrase}, finishing at ${formatMinutesTo12Hr(
      slot2End
    )}.`;
  }

  const btn1 = document.getElementById("btn-use-slot1");
  const btn2 = document.getElementById("btn-use-slot2");
  if (btn1) btn1.textContent = `Use ${s1StartFormatted}`;
  if (btn2) btn2.textContent = `Use ${s2StartFormatted}`;

  const dateLabel = formatDateLabel(dateStr);
  const indoorWin = document.getElementById("indoor-saved-window");
  const indoorMeta = document.getElementById("indoor-saved-meta");
  if (indoorWin) indoorWin.textContent = `${dateLabel} · ${s1Text}`;
  if (indoorMeta) {
    indoorMeta.textContent = `${durationInput} minutes indoors · Finish: ${formatMinutesTo12Hr(slot1End)} (${
      homeByMins !== null ? `Home by ${formatMinutesTo12Hr(homeByMins)} preserved` : "Flexible return"
    })`;
  }
}

document.getElementById("btn-use-slot1")?.addEventListener("click", () => {
  document.getElementById("start-time-input").value = comparedSlots.slot1Time;
  updateRunCalculations();
  showScreen("screen-window");
});

document.getElementById("btn-use-slot2")?.addEventListener("click", () => {
  document.getElementById("start-time-input").value = comparedSlots.slot2Time;
  updateRunCalculations();
  showScreen("screen-window");
});

// 7. Render 3-Hour Cards on Hourly Forecast Screen
function renderHourlyForecastCards(startHour24, dateStr) {
  const grid = document.getElementById("hourly-cards-grid");
  if (!grid) return;

  const cardsHtml = Array.from({ length: 24 }, (_, offset) => offset)
    .map((offset) => {
      const hour24 = (startHour24 + offset) % 24;
      const timeLabel = formatMinutesTo12Hr(hour24 * 60);
      const h = getHourData(hour24, dateStr);
      const fLower = h.shortForecast.toLowerCase();
      const icon = fLower.includes("thunder")
        ? "⛈️"
        : h.rain >= 25 || fLower.includes("rain") || fLower.includes("shower")
        ? "🌧️"
        : fLower.includes("clear") || fLower.includes("sunny")
        ? "☀️"
        : "⛅";

      return `
      <div class="hour-card">
        <strong class="hour-time">${timeLabel}</strong>
        <span class="hour-icon">${icon}</span>
        <strong class="hour-main">${formatTemp(h.tempF)} · rain ${h.rain}%</strong>
        <p class="hour-desc">${h.windSpeedLabel} ${h.windDir} · ${h.shortForecast}</p>
        <span class="hour-humidity">Humidity: ${h.humidity}%</span>
      </div>
    `;
    })
    .join("");

  grid.innerHTML = cardsHtml;
}

// 8. Dynamic Weather-Aware Clothing Logic
function updateClothingRecommendations(targetHour24, dateStr) {
  const startMins = parseTimeToMinutes(document.getElementById("start-time-input")?.value || "06:30");
  const hour24 = targetHour24 !== undefined ? targetHour24 : Math.floor(startMins / 60);
  const h = getHourData(hour24, dateStr);

  const act = appState.activity;
  const pref = appState.clothingPref;

  document.querySelectorAll("[data-activity]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.activity === act);
  });
  document.querySelectorAll("[data-pref]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pref === pref);
  });

  const weatherLabel = document.getElementById("clothing-weather-label");
  if (weatherLabel) {
    weatherLabel.textContent =
      h.tempF !== null ? `${formatTemp(h.tempF)}, ${h.rain}% rain, ${h.windSpeedLabel} wind` : "Live weather";
  }

  // Compute effective temperature feel based on preference and activity
  const rawTempF = h.tempF ?? 60;
  const prefOffset = pref === "warmer" ? -8 : pref === "cooler" ? 8 : 0;
  const actOffset = act === "run-walk" ? -4 : 0;
  const effectiveTempF = rawTempF + prefOffset + actOffset;

  const baseTitle = document.getElementById("gear-base-title");
  const baseDesc = document.getElementById("gear-base-desc");
  const layerTitle = document.getElementById("gear-layer-title");
  const layerDesc = document.getElementById("gear-layer-desc");
  const shellTitle = document.getElementById("gear-shell-title");
  const shellDesc = document.getElementById("gear-shell-desc");
  const accTitle = document.getElementById("gear-acc-title");
  const accDesc = document.getElementById("gear-acc-desc");
  const reasonEl = document.getElementById("clothing-reason-text");

  if (effectiveTempF < 40) {
    baseTitle.textContent = "Thermal long-sleeve base top & tights";
    baseDesc.textContent = `Insulated moisture-wicking base layer for ${formatTemp(rawTempF)} conditions.`;
    layerTitle.textContent = "Fleece or thermal mid-layer";
    layerDesc.textContent = "Retains core warmth in cold air; unzip slightly if climbing.";
  } else if (effectiveTempF < 55) {
    baseTitle.textContent = "Long-sleeve technical running top";
    baseDesc.textContent = `Comfortable coverage for ${formatTemp(rawTempF)} (${pref} warmth preference).`;
    layerTitle.textContent = "Lightweight removable zip vest or layer";
    layerDesc.textContent = "Keeps your core warm during warm-up and walk breaks.";
  } else if (effectiveTempF < 68) {
    baseTitle.textContent = "Breathable short-sleeve running top";
    baseDesc.textContent = `Light base layer suited for ${formatTemp(rawTempF)}.`;
    layerTitle.textContent = "Removable light layer";
    layerDesc.textContent = "Useful during walking intervals or breezy stretches; tie around waist once warm.";
  } else {
    baseTitle.textContent = "Light singlet or sleeveless breathable top";
    baseDesc.textContent = `Maximum ventilation for ${formatTemp(rawTempF)} and ${h.humidity}% humidity.`;
    layerTitle.textContent = "Light warm-up layer (optional)";
    layerDesc.textContent = "Only needed before starting if standing in shade or wind.";
  }

  shellTitle.textContent = "Water/wind-resistant outer shell";
  shellDesc.textContent = `Current rain chance is ${h.rain}% with ${h.windSpeedLabel} wind (${h.humidity}% humidity).`;

  accTitle.textContent =
    rawTempF < 45 ? "Gloves, headband & visibility gear" : "Brimmed cap, sunglasses & visibility gear";
  accDesc.textContent =
    rawTempF < 45
      ? "Light gloves protect hands in chilly wind; reflective trim for low light."
      : "Cap shields eyes from rain or sun glare; reflective accents for traffic.";

  if (act === "run-walk") {
    reasonEl.textContent = `At ${formatTemp(
      rawTempF
    )}, walking intervals reduce body heat compared to continuous running. Your "${pref}" preference adjusts base insulation while factoring in ${
      h.windSpeedLabel
    } winds.`;
  } else {
    reasonEl.textContent = `Continuous running at ${formatTemp(
      rawTempF
    )} generates steady body heat after 10 minutes. Dressed for "${pref}" comfort so you don't overheat mid-run.`;
  }

  // Set smart defaults for checkboxes unless manually overridden by the user
  const defaultLayer = effectiveTempF < 58 || (act === "run-walk" && effectiveTempF < 66);
  const defaultShell = h.rain >= 30 || h.windSpeedMph >= 18;
  const defaultAcc = rawTempF < 45 || h.rain >= 20 || h.windSpeedMph >= 15;

  const defaults = {
    "gear-base": true,
    "gear-layer": defaultLayer,
    "gear-shell": defaultShell,
    "gear-acc": defaultAcc
  };

  Object.entries(defaults).forEach(([id, defVal]) => {
    const cb = document.getElementById(id);
    if (cb && appState.manualOverrides[id] === undefined) {
      cb.checked = defVal;
    } else if (cb && appState.manualOverrides[id] !== undefined) {
      cb.checked = appState.manualOverrides[id];
    }
  });
}

document.querySelectorAll("[data-activity]").forEach((btn) => {
  btn.addEventListener("click", () => {
    appState.activity = btn.dataset.activity;
    saveState();
    updateRunCalculations();
  });
});

document.querySelectorAll("[data-pref]").forEach((btn) => {
  btn.addEventListener("click", () => {
    appState.clothingPref = btn.dataset.pref;
    saveState();
    updateRunCalculations();
  });
});

["gear-base", "gear-layer", "gear-shell", "gear-acc"].forEach((id) => {
  const cb = document.getElementById(id);
  if (cb) {
    cb.addEventListener("change", () => {
      appState.manualOverrides[id] = cb.checked;
      saveState();
      updateSavedClothingSummary();
    });
  }
});

function updateSavedClothingSummary() {
  const startMins = parseTimeToMinutes(document.getElementById("start-time-input")?.value || "06:30");
  const dateStr = document.getElementById("run-date-input")?.value || getDefaultDateString();
  const headerEl = document.getElementById("saved-plan-header");
  if (headerEl) {
    headerEl.textContent = `${appState.location.name} · ${formatDateLabel(dateStr)} · ${formatMinutesTo12Hr(
      startMins
    )} start`;
  }

  const modeEl = document.getElementById("saved-plan-mode");
  if (modeEl) {
    const actLabel = appState.activity === "run-walk" ? "Run-walk" : "Running";
    const prefLabel = appState.clothingPref.charAt(0).toUpperCase() + appState.clothingPref.slice(1);
    modeEl.textContent = `Activity: ${actLabel} · Preference: ${prefLabel} · Outdoor clothing preparation`;
  }

  const listEl = document.getElementById("saved-gear-list");
  if (!listEl) return;

  const items = [
    { id: "gear-base", label: document.getElementById("gear-base-title")?.textContent || "Base layer" },
    { id: "gear-layer", label: document.getElementById("gear-layer-title")?.textContent || "Removable layer" },
    { id: "gear-shell", label: document.getElementById("gear-shell-title")?.textContent || "Outer shell" },
    { id: "gear-acc", label: document.getElementById("gear-acc-title")?.textContent || "Accessories" }
  ];

  const selected = items.filter((item) => document.getElementById(item.id)?.checked);
  listEl.innerHTML = selected.length
    ? selected.map((i) => `<li>✓ ${i.label}</li>`).join("")
    : "<li>No clothing items checked</li>";
}

// 9. Active Run Timer & Saved Sessions
function getCurrentRunSummary() {
  const startMins = parseTimeToMinutes(document.getElementById("start-time-input")?.value || "06:30");
  const duration = parseInt(document.getElementById("duration-input")?.value, 10) || 30;
  const homeBy = parseTimeToMinutes(document.getElementById("home-by-input")?.value);
  const dateStr = document.getElementById("run-date-input")?.value || getDefaultDateString();
  const startHour = Math.floor(startMins / 60);
  const weather = getHourData(startHour, dateStr);

  return {
    location: appState.location.name,
    date: formatDateLabel(dateStr),
    start: formatMinutesTo12Hr(startMins),
    finish: formatMinutesTo12Hr(startMins + duration),
    duration,
    homeBy: homeBy === null ? "flexible" : formatMinutesTo12Hr(homeBy),
    weather: `${formatTemp(weather.tempF)} · ${weather.shortForecast}`,
    status: document.getElementById("window-status-title")?.textContent || "Planned"
  };
}

function updateRunActionState() {
  const startButton = document.getElementById("btn-start-run");
  const feedback = document.getElementById("run-action-feedback");
  if (!startButton || !feedback) return;

  if (appState.runStarted) {
    startButton.textContent = "Run in progress";
    feedback.textContent = "Your run is underway. Stay aware of changing conditions.";
  } else {
    startButton.textContent = "Start run";
    feedback.textContent = "";
  }
}

function renderSavedRun() {
  const box = document.getElementById("saved-session-box");
  const summary = document.getElementById("saved-session-summary");
  const status = document.getElementById("saved-session-status");
  if (!box || !summary || !status) return;

  if (!appState.savedRun) {
    box.classList.add("hidden");
    return;
  }

  const run = appState.savedRun;
  box.classList.remove("hidden");
  summary.textContent = `${run.location || appState.location.name} · ${run.date} · ${run.start}–${run.finish} · ${
    run.duration
  } min · ${run.weather}`;
  status.textContent = `Home by ${run.homeBy} · ${run.status}`;
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateActiveRunTimer() {
  const panel = document.getElementById("active-run-panel");
  const display = document.getElementById("run-timer-display");
  const caption = document.getElementById("run-timer-caption");
  const progress = document.getElementById("run-timer-progress");
  const title = document.getElementById("active-run-title");
  const badge = document.getElementById("active-run-badge");
  if (!panel || !display || !caption || !progress || !title || !badge || !appState.savedRun) return;

  const totalSeconds = appState.savedRun.duration * 60;
  const elapsedSeconds = Math.min(
    totalSeconds,
    Math.max(0, Math.floor((Date.now() - appState.runStartedAt) / 1000))
  );
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const complete = appState.runCompleted || elapsedSeconds >= totalSeconds;

  panel.classList.remove("hidden");
  display.textContent = formatTimer(complete ? totalSeconds : elapsedSeconds);
  progress.style.width = `${(elapsedSeconds / totalSeconds) * 100}%`;

  if (complete) {
    appState.runCompleted = true;
    appState.runStarted = false;
    saveState();
    title.textContent = "Run complete";
    badge.textContent = "DONE";
    caption.textContent = "Nice work! Add a note below to record how your clothing and timing worked.";
    clearInterval(runTimerInterval);
    runTimerInterval = null;
    document.getElementById("btn-finish-run").textContent = "Run finished";
    updateRunActionState();
  } else {
    title.textContent = "Run in progress";
    badge.textContent = "LIVE";
    caption.textContent = `Elapsed · ${formatTimer(remainingSeconds)} remaining`;
  }
}

function startRunTimer() {
  clearInterval(runTimerInterval);
  updateActiveRunTimer();
  runTimerInterval = setInterval(updateActiveRunTimer, 1000);
}

document.getElementById("btn-start-run")?.addEventListener("click", () => {
  appState.savedRun = getCurrentRunSummary();
  appState.runStarted = true;
  appState.runCompleted = false;
  appState.runStartedAt = Date.now();
  saveState();
  renderSavedRun();
  updateRunActionState();
  showScreen("screen-saved");
  startRunTimer();
});

document.getElementById("btn-save-session")?.addEventListener("click", () => {
  appState.savedRun = getCurrentRunSummary();
  saveState();
  renderSavedRun();
  showScreen("screen-saved");
});

document.getElementById("btn-finish-run")?.addEventListener("click", () => {
  if (!appState.runStarted || !appState.savedRun) return;
  appState.runCompleted = true;
  updateActiveRunTimer();
});

// 10. Session Reflections (Persisted in localStorage)
function renderAnnotations() {
  const feed = document.getElementById("annotations-history");
  if (!feed) return;

  if (appState.annotations.length === 0) {
    feed.innerHTML = `<p class="helper-text" style="margin: 4px 0;">No session notes saved yet. Add a reflection after your run to build your personal log.</p>`;
    return;
  }

  feed.innerHTML = appState.annotations
    .map(
      (a) => `
      <div class="annotation-item">
        <div class="ann-meta">
          <span class="ann-tag">${a.feelingTag}</span>
          <span>${a.date} <button type="button" class="delete-note-btn" data-delete-id="${a.id}" title="Delete note">&times;</button></span>
        </div>
        <p><strong>${a.gearSummary}:</strong> ${a.note}</p>
      </div>
    `
    )
    .join("");
}

document.getElementById("annotations-history")?.addEventListener("click", (e) => {
  const delBtn = e.target.closest("[data-delete-id]");
  if (!delBtn) return;
  const noteId = delBtn.dataset.deleteId;
  appState.annotations = appState.annotations.filter((a) => a.id !== noteId);
  saveState();
  renderAnnotations();
});

document.querySelectorAll("#annotation-tags .tag-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    appState.selectedFeelingTag = pill.dataset.tag;
    document.querySelectorAll("#annotation-tags .tag-pill").forEach((p) => {
      p.classList.toggle("active", p === pill);
    });
  });
});

document.getElementById("btn-add-annotation")?.addEventListener("click", () => {
  const noteInput = document.getElementById("session-note-input");
  const text = (noteInput?.value || "").trim();
  if (!text) return;

  const startMins = parseTimeToMinutes(document.getElementById("start-time-input")?.value || "06:30");
  const dateStr = document.getElementById("run-date-input")?.value || getDefaultDateString();
  const h = getHourData(Math.floor(startMins / 60), dateStr);

  const baseLabel = document.getElementById("gear-base-title")?.textContent || "Base top";
  const hasLayer = document.getElementById("gear-layer")?.checked;
  const gearSummary = hasLayer ? `${baseLabel} + Removable layer` : baseLabel;

  appState.annotations.unshift({
    id: `note-${Date.now()}`,
    date: `${appState.location.name} · ${formatDateLabel(dateStr)} (${
      appState.activity === "run-walk" ? "Run-walk" : "Running"
    } · ${formatTemp(h.tempF)})`,
    feelingTag: appState.selectedFeelingTag,
    gearSummary,
    note: text
  });
  noteInput.value = "";
  saveState();
  renderAnnotations();
});

// 11. Location Search & Browser Geolocation
function selectLocation(name, lat, lon) {
  appState.location = { name, lat: Number(lat), lon: Number(lon) };
  saveState();
  const statusEl = document.getElementById("location-status-msg");
  if (statusEl) statusEl.textContent = `Selected ${name}. Fetching live forecast...`;
  fetchLiveWeatherForLocation(appState.location.lat, appState.location.lon);
}

async function searchLocations() {
  const input = document.getElementById("location-search-input");
  const resultsContainer = document.getElementById("location-search-results");
  const query = (input?.value || "").trim();
  if (!query || !resultsContainer) return;

  resultsContainer.innerHTML = `<p class="helper-text">Searching for "${query}"...</p>`;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
    );
    const data = await res.json();
    const results = data.results || [];
    if (results.length === 0) {
      resultsContainer.innerHTML = `<p class="helper-text">No matching cities found. Try another name.</p>`;
      return;
    }

    resultsContainer.innerHTML = results
      .map((item) => {
        const region = item.admin1 ? `, ${item.admin1}` : "";
        const country = item.country_code ? ` (${item.country_code})` : "";
        const displayName = `${item.name}${region}${country}`;
        return `
          <button type="button" class="search-result-item" data-lat="${item.latitude}" data-lon="${item.longitude}" data-name="${displayName}">
            <strong>${displayName}</strong>
            <span>${Number(item.latitude).toFixed(2)}, ${Number(item.longitude).toFixed(2)}</span>
          </button>
        `;
      })
      .join("");
  } catch {
    resultsContainer.innerHTML = `<p class="helper-text">Search failed. Please check your network connection.</p>`;
  }
}

document.getElementById("btn-search-location")?.addEventListener("click", searchLocations);
document.getElementById("location-search-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    searchLocations();
  }
});

document.getElementById("location-search-results")?.addEventListener("click", (e) => {
  const item = e.target.closest(".search-result-item");
  if (!item) return;
  selectLocation(item.dataset.name, item.dataset.lat, item.dataset.lon);
  document.getElementById("location-search-results").innerHTML = "";
  showScreen("screen-plan");
});

document.querySelectorAll("#quick-locations [data-lat]").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectLocation(btn.dataset.name, btn.dataset.lat, btn.dataset.lon);
    showScreen("screen-plan");
  });
});

document.getElementById("btn-use-geolocation")?.addEventListener("click", () => {
  const statusEl = document.getElementById("location-status-msg");
  if (!navigator.geolocation) {
    if (statusEl) statusEl.textContent = "Geolocation is not supported by your browser.";
    return;
  }

  if (statusEl) statusEl.textContent = "Requesting your current location...";
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      let placeName = `My Location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
      try {
        const revRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
        );
        if (revRes.ok) {
          const revData = await revRes.json();
          const city =
            revData.address?.city ||
            revData.address?.town ||
            revData.address?.village ||
            revData.address?.county;
          const state = revData.address?.state;
          if (city) placeName = state ? `${city}, ${state}` : city;
        }
      } catch {
        // Keep coordinate fallback name if reverse geocoding fails
      }
      selectLocation(placeName, latitude, longitude);
      showScreen("screen-plan");
    },
    () => {
      if (statusEl) {
        statusEl.textContent = "Location permission denied or unavailable. Search for your city below.";
      }
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
});

// 12. Preferences & Live Refresh Controls
document.querySelectorAll("[data-unit]").forEach((btn) => {
  btn.classList.toggle("active", btn.dataset.unit === appState.units);
  btn.addEventListener("click", () => {
    appState.units = btn.dataset.unit;
    saveState();
    document.querySelectorAll("[data-unit]").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    updateRunCalculations();
  });
});

document.getElementById("btn-refresh-weather")?.addEventListener("click", async () => {
  const fb = document.getElementById("refresh-feedback");
  if (fb) fb.textContent = "Refreshing live weather...";
  await fetchLiveWeatherForLocation(appState.location.lat, appState.location.lon);
  if (fb) fb.textContent = `Updated at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
});

document.getElementById("btn-clear-data")?.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  appState = structuredClone(defaultState);
  renderAnnotations();
  renderSavedRun();
  updateRunCalculations();
  const fb = document.getElementById("refresh-feedback");
  if (fb) fb.textContent = "Saved notes and preferences have been reset.";
});

// 13. Inputs & App Initialization
["run-date-input", "start-time-input", "duration-input", "home-by-input"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", updateRunCalculations);
});

function updateAllViews() {
  updateRunCalculations();
  renderAnnotations();
  renderSavedRun();
}

function initApp() {
  const dateInput = document.getElementById("run-date-input");
  if (dateInput && !dateInput.value) {
    dateInput.value = getDefaultDateString();
  }

  const startInput = document.getElementById("start-time-input");
  if (startInput) {
    startInput.value = getDefaultStartTimeString();
  }

  if (appState.runStarted && appState.savedRun) {
    startRunTimer();
  }

  updateAllViews();
  fetchLiveWeatherForLocation(appState.location.lat, appState.location.lon);
}

initApp();