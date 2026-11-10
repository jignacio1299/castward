// Castward Functional Prototype - Enhanced with Demo Scenarios, UC1/UC2 Flows & Session Annotations
const EMBEDDED_DEMO_DATA = {
  "activeScenario": "oct14_thunderstorm",
  "units": "F",
  "scenarios": {
    "oct14_thunderstorm": {
      "id": "oct14_thunderstorm",
      "label": "Study Scenario: Wed, Oct 14 (Thunderstorms \u00b7 UC1 & UC2)",
      "location": "Chicago, IL",
      "dateLabel": "Wed, Oct 14",
      "retrievedAt": "NWS \u00b7 retrieved Oct 14, 12:09 a.m. CDT",
      "gridPoint": "LOT/76,73 (41.8818, -87.6232)",
      "alertStatus": "clear",
      "alertHeadline": "No active NWS alerts were listed at the capture time.",
      "hours": [
        {
          "hour24": 6,
          "timeLabel": "6:00 a.m.",
          "tempF": 63,
          "rain": 25,
          "windSpeed": "10 mph",
          "windDir": "NNE",
          "shortForecast": "Chance Showers And Thunderstorms",
          "humidity": 90
        },
        {
          "hour24": 7,
          "timeLabel": "7:00 a.m.",
          "tempF": 63,
          "rain": 22,
          "windSpeed": "10 mph",
          "windDir": "NNE",
          "shortForecast": "Slight Chance Rain Showers",
          "humidity": 90
        },
        {
          "hour24": 8,
          "timeLabel": "8:00 a.m.",
          "tempF": 62,
          "rain": 21,
          "windSpeed": "10 mph",
          "windDir": "NNE",
          "shortForecast": "Slight Chance Rain Showers",
          "humidity": 90
        }
      ]
    },
    "alerts_unavailable": {
      "id": "alerts_unavailable",
      "label": "R09 Failure Mode: Alerts Check Failed (Preserves Plan)",
      "location": "Chicago, IL",
      "dateLabel": "Wed, Oct 14",
      "retrievedAt": "NWS \u00b7 retrieved Oct 14, 12:09 a.m. CDT (Alerts check failed)",
      "gridPoint": "LOT/76,73",
      "alertStatus": "failed",
      "alertHeadline": "Alerts not checked. Do not read this as an absence of alerts.",
      "hours": [
        {
          "hour24": 6,
          "timeLabel": "6:00 a.m.",
          "tempF": 63,
          "rain": 25,
          "windSpeed": "10 mph",
          "windDir": "NNE",
          "shortForecast": "Chance Showers And Thunderstorms",
          "humidity": 90
        },
        {
          "hour24": 7,
          "timeLabel": "7:00 a.m.",
          "tempF": 63,
          "rain": 22,
          "windSpeed": "10 mph",
          "windDir": "NNE",
          "shortForecast": "Slight Chance Rain Showers",
          "humidity": 90
        },
        {
          "hour24": 8,
          "timeLabel": "8:00 a.m.",
          "tempF": 62,
          "rain": 21,
          "windSpeed": "10 mph",
          "windDir": "NNE",
          "shortForecast": "Slight Chance Rain Showers",
          "humidity": 90
        }
      ]
    },
    "lakefront_wind": {
      "id": "lakefront_wind",
      "label": "Clear & Breezy Scenario: Lakefront Exposure (P01)",
      "location": "Chicago, IL",
      "dateLabel": "Sun, Nov 8",
      "retrievedAt": "NWS \u00b7 retrieved Nov 8, 3:45 p.m. CST",
      "gridPoint": "LOT/76,73",
      "alertStatus": "clear",
      "alertHeadline": "No active NWS alerts in this snapshot.",
      "hours": [
        {
          "hour24": 6,
          "timeLabel": "6:00 a.m.",
          "tempF": 54,
          "rain": 10,
          "windSpeed": "15 mph",
          "windDir": "ENE",
          "shortForecast": "Mostly Sunny And Breezy",
          "humidity": 68
        },
        {
          "hour24": 7,
          "timeLabel": "7:00 a.m.",
          "tempF": 56,
          "rain": 10,
          "windSpeed": "15 mph",
          "windDir": "ENE",
          "shortForecast": "Mostly Sunny",
          "humidity": 64
        },
        {
          "hour24": 8,
          "timeLabel": "8:00 a.m.",
          "tempF": 58,
          "rain": 5,
          "windSpeed": "12 mph",
          "windDir": "E",
          "shortForecast": "Sunny",
          "humidity": 60
        }
      ]
    }
  },
  "sampleSessionAnnotations": [
    {
      "id": "note-1",
      "date": "Wed, Oct 14 \u00b7 7:00 a.m. (Run-walk \u00b7 63\u00b0F)",
      "feelingTag": "\ud83d\ude04 Layering worked",
      "gearSummary": "Light running top + Removable light layer",
      "note": "Walking breaks felt cooler near Arrigo Park; tying the light zip layer around my waist during running stretches worked much better than a heavy hoodie."
    },
    {
      "id": "note-2",
      "date": "Sun, Oct 11 \u00b7 4:30 p.m. (Running \u00b7 58\u00b0F)",
      "feelingTag": "\ud83e\udd75 Overheated",
      "gearSummary": "Long-sleeve top + Zip jacket",
      "note": "Dressed for standing in the hallway and started sweating 10 minutes in. Next time at 55\u201360\u00b0F: skip the heavy jacket and bring a cap for wind."
    }
  ]
};

let demoState = {
  activeScenario: "oct14_thunderstorm",
  units: "F",
  activity: "run-walk",
  clothingPref: "usual",
  manualOverrides: {}, // Preserves manual checkbox edits across preference switches (EC07 / R07)
  selectedFeelingTag: "😄 Layering worked",
  annotations: [...EMBEDDED_DEMO_DATA.sampleSessionAnnotations],
  savedRun: null,
  runStarted: false,
  runStartedAt: null,
  runCompleted: false
};

let nwsPeriods = [];
let previousScreen = "screen-home";
let runTimerInterval = null;

function formatTemp(tempF) {
  if (demoState.units === "C") {
    const c = Math.round(((tempF - 32) * 5) / 9);
    return `${c}°C`;
  }
  return `${tempF}°F`;
}

// 1. Screen Navigation with Active Top-Nav Sync
function showScreen(screenId) {
  const currentActive = document.querySelector(".screen.active");
  if (currentActive && currentActive.id !== screenId && screenId === "screen-hourly") {
    previousScreen = currentActive.id;
  }

  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  // Sync top navigation pills
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

function getActiveScenarioObj() {
  return (
    EMBEDDED_DEMO_DATA.scenarios[demoState.activeScenario] ||
    EMBEDDED_DEMO_DATA.scenarios.oct14_thunderstorm
  );
}

// 3. Dynamically Calculate Expected Finish, Return Status & Compare Screen
function updateRunCalculations() {
  const startInput = document.getElementById("start-time-input").value || "06:30";
  const durationInput = parseInt(document.getElementById("duration-input").value, 10) || 30;
  const homeByInput = document.getElementById("home-by-input").value;

  const startMins = parseTimeToMinutes(startInput);
  const finishMins = startMins + durationInput;
  const homeByMins = parseTimeToMinutes(homeByInput);

  const formattedStart = formatMinutesTo12Hr(startMins);
  const formattedFinish = formatMinutesTo12Hr(finishMins);
  const summaryText = `${formattedStart.replace(/ [ap]\.m\./, "")}–${formattedFinish} · ${durationInput} min`;

  document.getElementById("expected-finish").textContent = formattedFinish;
  document.getElementById("window-summary-time").textContent = summaryText;
  document.getElementById("forecast-summary-time").textContent = summaryText;

  const windowHomeByEl = document.getElementById("window-home-by");
  if (windowHomeByEl) {
    windowHomeByEl.textContent = homeByMins !== null ? formatMinutesTo12Hr(homeByMins) : "None";
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
    lateText.textContent = `This run ends ${lateBy} minute${lateBy === 1 ? "" : "s"} after ${formattedHomeBy}`;

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

  // Update date and timestamp labels from active scenario
  const scenario = getActiveScenarioObj();
  document.querySelectorAll(".current-date").forEach((el) => {
    el.textContent = scenario.dateLabel;
  });
  const tsEl = document.getElementById("nws-timestamp");
  if (tsEl) tsEl.textContent = scenario.retrievedAt;

  const startHour24 = Math.floor(startMins / 60);
  renderWeatherForHour(startHour24);
  renderHourlyForecastCards(startHour24);
  renderCompareScreen(startMins, durationInput, homeByMins);
  updateRunActionState();
}

["start-time-input", "duration-input", "home-by-input"].forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", updateRunCalculations);
});

// 4. Match Selected Hour to Scenario or Live NWS Weather Data
function getHourData(targetHour24) {
  if (demoState.activeScenario === "live_nws" && nwsPeriods.length > 0) {
    const matchingPeriod =
      nwsPeriods.find((p) => new Date(p.startTime).getHours() === targetHour24) || nwsPeriods[0];
    return {
      tempF: matchingPeriod.temperature,
      rain: matchingPeriod.probabilityOfPrecipitation?.value ?? 0,
      windSpeed: matchingPeriod.windSpeed,
      windDir: matchingPeriod.windDirection,
      shortForecast: matchingPeriod.shortForecast,
      humidity: matchingPeriod.relativeHumidity?.value ?? 80
    };
  }
  const scenario = getActiveScenarioObj();
  const match =
    scenario.hours.find((h) => h.hour24 === targetHour24) ||
    (targetHour24 < 7 ? scenario.hours[0] : scenario.hours[1]);
  return match;
}

function renderWeatherForHour(targetHour24) {
  const h = getHourData(targetHour24);
  const scenario = getActiveScenarioObj();

  document.getElementById("win-temp").textContent = formatTemp(h.tempF);
  document.getElementById("win-rain").textContent = `${h.rain}%`;
  document.getElementById("win-wind").textContent = h.windSpeed;

  document.getElementById("temp-value").textContent = formatTemp(h.tempF);
  document.getElementById("rain-value").textContent = `${h.rain}%`;
  document.getElementById("wind-value").textContent = `${h.windSpeed} ${h.windDir}`;

  const windowCard = document.getElementById("window-status-card");
  const windowTitle = document.getElementById("window-status-title");
  const windowDesc = document.getElementById("window-status-desc");

  const alertBox = document.getElementById("alert-box");
  const alertTitle = document.getElementById("alert-title");
  const alertDesc = document.getElementById("alert-desc");

  windowCard.classList.remove("danger", "caution", "clear", "neutral-banner");
  alertBox.classList.remove("danger", "caution", "clear", "neutral-banner");

  // Check R09 Failed Alert Check state first
  const officialAlertsBoxes = document.querySelectorAll("#screen-window .info-box p, #screen-hourly .info-box p");
  if (scenario.alertStatus === "failed") {
    windowCard.classList.add("neutral-banner");
    alertBox.classList.add("caution");
    windowTitle.textContent = "Not enough information";
    windowDesc.textContent = "The official NWS alert check failed. Your planned window is kept.";
    alertTitle.textContent = "Alerts not checked (Plan preserved)";
    alertDesc.textContent = "Do not read a failed alert check as an absence of alerts. Forecast values remain available below.";
    if (officialAlertsBoxes[0]) {
      officialAlertsBoxes[0].textContent = "⚠️ Alerts not checked. Do not read this as an absence of alerts.";
    }
    return;
  } else if (officialAlertsBoxes[0]) {
    officialAlertsBoxes[0].textContent = scenario.alertHeadline;
  }

  const forecastLower = h.shortForecast.toLowerCase();
  if (forecastLower.includes("thunder") || h.rain >= 50) {
    windowCard.classList.add("danger");
    alertBox.classList.add("danger");
    windowTitle.textContent = "Reconsider";
    windowDesc.textContent = "Thunderstorms are in the forecast for this window.";
    alertTitle.textContent = "Thunderstorms in this window";
  } else if (forecastLower.includes("shower") || forecastLower.includes("rain") || h.rain >= 20) {
    windowCard.classList.add("caution");
    alertBox.classList.add("caution");
    windowTitle.textContent = "Use caution";
    windowDesc.textContent = "Showers are possible. A low chance does not mean no rain.";
    alertTitle.textContent = "Showers are still possible";
  } else {
    windowCard.classList.add("clear");
    alertBox.classList.add("clear");
    windowTitle.textContent = "Good window to run";
    windowDesc.textContent = "Conditions look clear for your planned window.";
    alertTitle.textContent = "Clear conditions in this window";
  }

  alertDesc.textContent = `${h.shortForecast}. Rain chance: ${h.rain}%.`;
}

// 5. Render Compare Start Times Screen (UC1)
function renderCompareScreen(startMins, durationInput, homeByMins) {
  const slot1End = startMins + durationInput;
  const slot2Start = startMins + 30;
  const slot2End = slot2Start + durationInput;

  const h1 = getHourData(Math.floor(startMins / 60));
  const h2 = getHourData(Math.floor(slot2Start / 60));

  const s1Text = `${formatMinutesTo12Hr(startMins).replace(/ [ap]\.m\./, "")}–${formatMinutesTo12Hr(slot1End)}`;
  const s2Text = `${formatMinutesTo12Hr(slot2Start).replace(/ [ap]\.m\./, "")}–${formatMinutesTo12Hr(slot2End)}`;

  const durLabel = document.getElementById("compare-duration-label");
  const hbLabel = document.getElementById("compare-homeby-label");
  if (durLabel) durLabel.textContent = `${durationInput} minutes`;
  if (hbLabel) hbLabel.textContent = homeByMins !== null ? formatMinutesTo12Hr(homeByMins) : "flexible";

  const c1Title = document.getElementById("compare-slot1-title");
  const c1Desc = document.getElementById("compare-slot1-desc");
  const c1Dead = document.getElementById("compare-slot1-deadline");
  if (c1Title) c1Title.textContent = s1Text;
  if (c1Desc) c1Desc.textContent = `${h1.shortForecast} · ${formatTemp(h1.tempF)} · rain ${h1.rain}% · wind ${h1.windSpeed} ${h1.windDir}`;
  if (c1Dead && homeByMins !== null) {
    const diff1 = homeByMins - slot1End;
    c1Dead.textContent =
      diff1 >= 0
        ? `✓ Finishes ${diff1} min before Home by ${formatMinutesTo12Hr(homeByMins)}`
        : `⚠️ Ends ${Math.abs(diff1)} min after Home by ${formatMinutesTo12Hr(homeByMins)}`;
  }

  const c2Title = document.getElementById("compare-slot2-title");
  const c2Desc = document.getElementById("compare-slot2-desc");
  const c2Dead = document.getElementById("compare-slot2-deadline");
  if (c2Title) c2Title.textContent = s2Text;
  if (c2Desc) c2Desc.textContent = `${h2.shortForecast} · ${formatTemp(h2.tempF)} · rain ${h2.rain}% · wind ${h2.windSpeed} ${h2.windDir}`;
  if (c2Dead && homeByMins !== null) {
    const diff2 = homeByMins - slot2End;
    c2Dead.textContent =
      diff2 >= 0
        ? `✓ Finishes ${diff2} min before Home by ${formatMinutesTo12Hr(homeByMins)}`
        : `⚠️ Ends ${Math.abs(diff2)} minutes after Home by ${formatMinutesTo12Hr(homeByMins)}`;
  }

  const indoorWin = document.getElementById("indoor-saved-window");
  const indoorMeta = document.getElementById("indoor-saved-meta");
  if (indoorWin) indoorWin.textContent = `${getActiveScenarioObj().dateLabel} · ${s1Text}`;
  if (indoorMeta) {
    indoorMeta.textContent = `${durationInput} minutes indoors · Finish: ${formatMinutesTo12Hr(slot1End)} (Home by ${
      homeByMins !== null ? formatMinutesTo12Hr(homeByMins) : "target"
    } preserved)`;
  }
}

function getCurrentRunSummary() {
  const startMins = parseTimeToMinutes(document.getElementById("start-time-input")?.value || "06:30");
  const duration = parseInt(document.getElementById("duration-input")?.value, 10) || 30;
  const homeBy = parseTimeToMinutes(document.getElementById("home-by-input")?.value);
  const startHour = Math.floor(startMins / 60);
  const weather = getHourData(startHour);

  return {
    date: getActiveScenarioObj().dateLabel,
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

  if (demoState.runStarted) {
    startButton.textContent = "Run started";
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

  if (!demoState.savedRun) {
    box.classList.add("hidden");
    return;
  }

  const run = demoState.savedRun;
  box.classList.remove("hidden");
  summary.textContent = `${run.date} · ${run.start}–${run.finish} · ${run.duration} min · ${run.weather}`;
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
  if (!panel || !display || !caption || !progress || !title || !badge || !demoState.savedRun) return;

  const totalSeconds = demoState.savedRun.duration * 60;
  const elapsedSeconds = Math.min(
    totalSeconds,
    Math.max(0, Math.floor((Date.now() - demoState.runStartedAt) / 1000))
  );
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const complete = demoState.runCompleted || elapsedSeconds >= totalSeconds;

  panel.classList.remove("hidden");
  display.textContent = formatTimer(complete ? totalSeconds : elapsedSeconds);
  progress.style.width = `${(elapsedSeconds / totalSeconds) * 100}%`;

  if (complete) {
    demoState.runCompleted = true;
    demoState.runStarted = false;
    title.textContent = "Run complete";
    badge.textContent = "DONE";
    caption.textContent = "Nice work. Add a note below to remember how it felt.";
    clearInterval(runTimerInterval);
    runTimerInterval = null;
    document.getElementById("btn-finish-run").textContent = "Run finished";
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
  demoState.savedRun = getCurrentRunSummary();
  demoState.runStarted = true;
  demoState.runCompleted = false;
  demoState.runStartedAt = Date.now();
  renderSavedRun();
  updateRunActionState();
  showScreen("screen-saved");
  startRunTimer();
});

document.getElementById("btn-save-session")?.addEventListener("click", () => {
  demoState.savedRun = getCurrentRunSummary();
  renderSavedRun();
  showScreen("screen-saved");
});

document.getElementById("btn-finish-run")?.addEventListener("click", () => {
  if (!demoState.runStarted || !demoState.savedRun) return;
  demoState.runCompleted = true;
  updateActiveRunTimer();
});

document.getElementById("btn-use-slot1")?.addEventListener("click", () => {
  document.getElementById("start-time-input").value = "06:30";
  updateRunCalculations();
  showScreen("screen-window");
});

document.getElementById("btn-use-slot2")?.addEventListener("click", () => {
  document.getElementById("start-time-input").value = "07:00";
  updateRunCalculations();
  showScreen("screen-window");
});

// 6. Render 3-Hour Cards on Hourly Forecast Screen
function renderHourlyForecastCards(startHour24) {
  const grid = document.getElementById("hourly-cards-grid");
  if (!grid) return;

  const cardsHtml = [0, 1, 2]
    .map((offset) => {
      const hour24 = (startHour24 + offset) % 24;
      const timeLabel = formatMinutesTo12Hr(hour24 * 60);
      const h = getHourData(hour24);
      const icon = h.rain >= 20 ? "🌧️" : "⛅";

      return `
      <div class="hour-card">
        <strong class="hour-time">${timeLabel}</strong>
        <span class="hour-icon">${icon}</span>
        <strong class="hour-main">${formatTemp(h.tempF)} · rain ${h.rain}%</strong>
        <p class="hour-desc">${h.windSpeed} ${h.windDir} · ${h.shortForecast}</p>
        <span class="hour-humidity">Humidity: ${h.humidity}%</span>
      </div>
    `;
    })
    .join("");

  grid.innerHTML = cardsHtml;
}

// 7. UC2 Clothing Logic with Manual Override Preservation (EC07 / R07)
function updateClothingRecommendations() {
  const act = demoState.activity;
  const pref = demoState.clothingPref;

  document.querySelectorAll("[data-activity]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.activity === act);
  });
  document.querySelectorAll("[data-pref]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pref === pref);
  });

  const baseTitle = document.getElementById("gear-base-title");
  const baseDesc = document.getElementById("gear-base-desc");
  const reasonEl = document.getElementById("clothing-reason-text");

  if (pref === "warmer") {
    baseTitle.textContent = "Long-sleeve running top";
    baseDesc.textContent = "Warmer base layer selected for personal comfort at 63°F.";
  } else if (pref === "cooler") {
    baseTitle.textContent = "Light sleeveless / breathable top";
    baseDesc.textContent = "Lighter base layer so you don't overheat after warming up.";
  } else {
    baseTitle.textContent = "Light running top";
    baseDesc.textContent = "Breathable short-sleeve base layer for 63°F.";
  }

  if (act === "run-walk") {
    if (pref === "cooler") {
      reasonEl.textContent =
        "Cooler preference reduces base warmth, while Run-walk keeps your activity selected. You can still check a removable layer for walking breaks.";
    } else if (pref === "warmer") {
      reasonEl.textContent =
        "Warmer switches to a long-sleeve base top while retaining a removable light layer for walking breaks.";
    } else {
      reasonEl.textContent =
        "Walking breaks can feel cooler after warming up. Consider a removable light layer (like a zip top or hoodie you can tie around your waist).";
    }
  } else {
    reasonEl.textContent =
      "Continuous running generates steady body heat. Start with a light base layer so you don't overheat 10 minutes into the run.";
  }

  // Apply defaults ONLY for checkboxes the user hasn't manually overridden (EC07)
  const defaultLayer = act === "run-walk" && pref !== "cooler";
  const layerCheckbox = document.getElementById("gear-layer");
  if (layerCheckbox && demoState.manualOverrides["gear-layer"] === undefined) {
    layerCheckbox.checked = defaultLayer;
  }
}

document.querySelectorAll("[data-activity]").forEach((btn) => {
  btn.addEventListener("click", () => {
    demoState.activity = btn.dataset.activity;
    updateClothingRecommendations();
  });
});

document.querySelectorAll("[data-pref]").forEach((btn) => {
  btn.addEventListener("click", () => {
    demoState.clothingPref = btn.dataset.pref;
    updateClothingRecommendations();
  });
});

["gear-base", "gear-layer", "gear-shell", "gear-acc"].forEach((id) => {
  const cb = document.getElementById(id);
  if (cb) {
    cb.addEventListener("change", () => {
      demoState.manualOverrides[id] = cb.checked;
    });
  }
});

function updateSavedClothingSummary() {
  const modeEl = document.getElementById("saved-plan-mode");
  if (modeEl) {
    const actLabel = demoState.activity === "run-walk" ? "Run-walk" : "Running";
    const prefLabel = demoState.clothingPref.charAt(0).toUpperCase() + demoState.clothingPref.slice(1);
    modeEl.textContent = `Activity: ${actLabel} · Preference: ${prefLabel} · Outdoor clothing preparation`;
  }

  const listEl = document.getElementById("saved-gear-list");
  if (!listEl) return;

  const items = [
    { id: "gear-base", label: document.getElementById("gear-base-title")?.textContent || "Light running top" },
    { id: "gear-layer", label: "Removable light layer (for walking breaks)" },
    { id: "gear-shell", label: "Rain-resistant outer layer" },
    { id: "gear-acc", label: "Personal visibility / brimmed cap" }
  ];

  const selected = items.filter((item) => document.getElementById(item.id)?.checked);
  listEl.innerHTML = selected.length
    ? selected.map((i) => `<li>✓ ${i.label}</li>`).join("")
    : "<li>No clothing items checked</li>";
}

// 8. Session Reflection & Annotations (Professor's Feature Suggestion)
function renderAnnotations() {
  const feed = document.getElementById("annotations-history");
  if (!feed) return;

  feed.innerHTML = demoState.annotations
    .map(
      (a) => `
      <div class="annotation-item">
        <div class="ann-meta">
          <span class="ann-tag">${a.feelingTag}</span>
          <span>${a.date}</span>
        </div>
        <p><strong>${a.gearSummary}:</strong> ${a.note}</p>
      </div>
    `
    )
    .join("");
}

document.querySelectorAll("#annotation-tags .tag-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    demoState.selectedFeelingTag = pill.dataset.tag;
    document.querySelectorAll("#annotation-tags .tag-pill").forEach((p) => {
      p.classList.toggle("active", p === pill);
    });
  });
});

document.getElementById("btn-add-annotation")?.addEventListener("click", () => {
  const noteInput = document.getElementById("session-note-input");
  const text = (noteInput?.value || "").trim();
  if (!text) return;

  const baseLabel = document.getElementById("gear-base-title")?.textContent || "Light running top";
  const hasLayer = document.getElementById("gear-layer")?.checked;
  const gearSummary = hasLayer ? `${baseLabel} + Removable layer` : baseLabel;

  demoState.annotations.unshift({
    id: `note-${Date.now()}`,
    date: `${getActiveScenarioObj().dateLabel} · ${demoState.activity === "run-walk" ? "Run-walk" : "Running"}`,
    feelingTag: demoState.selectedFeelingTag,
    gearSummary,
    note: text
  });
  noteInput.value = "";
  renderAnnotations();
});

// 9. Demo Scenario & Unit Switchers (Screen 11)
document.querySelectorAll("[data-scenario]").forEach((btn) => {
  btn.addEventListener("click", () => {
    demoState.activeScenario = btn.dataset.scenario;
    document.querySelectorAll("[data-scenario]").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    if (demoState.activeScenario === "live_nws" && nwsPeriods.length === 0) {
      fetchNWSWeather();
    } else {
      updateRunCalculations();
    }
  });
});

document.querySelectorAll("[data-unit]").forEach((btn) => {
  btn.addEventListener("click", () => {
    demoState.units = btn.dataset.unit;
    document.querySelectorAll("[data-unit]").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    updateRunCalculations();
  });
});

async function fetchNWSWeather() {
  try {
    const res = await fetch("https://api.weather.gov/gridpoints/LOT/76,73/forecast/hourly");
    const data = await res.json();
    nwsPeriods = data.properties.periods.slice(0, 24);
    updateRunCalculations();
  } catch (err) {
    console.warn("Using embedded demo-data.json fallback:", err);
    updateRunCalculations();
  }
}

// Initialize with deterministic Oct 14 Study Scenario for reliable demo
updateRunCalculations();
updateClothingRecommendations();
updateSavedClothingSummary();
renderAnnotations();
renderSavedRun();
