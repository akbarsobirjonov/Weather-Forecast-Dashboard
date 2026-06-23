/* =========================================================
   Weather app — OpenWeatherMap API
   =========================================================
   SETUP: Replace YOUR_API_KEY below with your OpenWeatherMap
   API key from https://openweathermap.org/api (free tier works).
   The key is used in browser requests — keep it local-only.
   ========================================================= */

const API_KEY = "YOUR_API_KEY"; // <-- paste your key here
const BASE_URL = "https://api.openweathermap.org/data/2.5";

// ---- State ----
const state = {
  units: localStorage.getItem("weather-units") || "metric", // 'metric' | 'imperial'
  theme: localStorage.getItem("weather-theme") || "light",
  lastQuery: null, // { type: 'coords', lat, lon } | { type: 'city', name }
  lastCurrent: null, // raw current-weather API response, kept to re-apply gradient on theme toggle
};

// ---- DOM refs ----
const els = {
  html: document.documentElement,
  themeToggle: document.getElementById("themeToggle"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  geoBtn: document.getElementById("geoBtn"),
  unitC: document.getElementById("unitC"),
  unitF: document.getElementById("unitF"),
  status: document.getElementById("status"),
  currentSection: document.getElementById("currentSection"),
  cityName: document.getElementById("cityName"),
  weatherDesc: document.getElementById("weatherDesc"),
  temp: document.getElementById("temp"),
  tempUnit: document.getElementById("tempUnit"),
  weatherIcon: document.getElementById("weatherIcon"),
  feelsLike: document.getElementById("feelsLike"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  pressure: document.getElementById("pressure"),
  forecastSection: document.getElementById("forecastSection"),
  forecastGrid: document.getElementById("forecastGrid"),
};

// ---- Weather icon mapping (OpenWeatherMap icon code -> emoji) ----
const ICON_MAP = {
  "01d": "☀️", "01n": "🌙",
  "02d": "⛅", "02n": "☁️",
  "03d": "☁️", "03n": "☁️",
  "04d": "☁️", "04n": "☁️",
  "09d": "🌧️", "09n": "🌧️",
  "10d": "🌦️", "10n": "🌧️",
  "11d": "⛈️", "11n": "⛈️",
  "13d": "❄️", "13n": "❄️",
  "50d": "🌫️", "50n": "🌫️",
};

// ---- Dynamic background gradient (weather x theme) ----
// Each weather condition has a lighter (light theme) and darker (night theme) variant.
// Applied to body via --page-gradient.
const PAGE_GRADIENTS = {
  "clear-d": {
    light: "linear-gradient(180deg, #74d0f5 0%, #56ccf2 50%, #2f80ed 100%)",
    night: "linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
  },
  "clear-n": {
    light: "linear-gradient(180deg, #4a5d7e 0%, #2c3e60 50%, #1a2742 100%)",
    night: "linear-gradient(180deg, #0a0f1a 0%, #141a2e 50%, #1e2640 100%)",
  },
  "clouds-d": {
    light: "linear-gradient(180deg, #b8c6db 0%, #a4b5cb 50%, #8e9eab 100%)",
    night: "linear-gradient(180deg, #283048 0%, #4b5a6e 50%, #859398 100%)",
  },
  "clouds-n": {
    light: "linear-gradient(180deg, #5a6678 0%, #404a5e 50%, #2c3445 100%)",
    night: "linear-gradient(180deg, #1a1f2e 0%, #283048 50%, #3a445a 100%)",
  },
  "rain-d": {
    light: "linear-gradient(180deg, #6b8acc 0%, #4b6cb7 50%, #324b80 100%)",
    night: "linear-gradient(180deg, #1a2540 0%, #243b55 50%, #141e30 100%)",
  },
  "rain-n": {
    light: "linear-gradient(180deg, #4a5560 0%, #353c45 50%, #232526 100%)",
    night: "linear-gradient(180deg, #15181c 0%, #232526 50%, #2c3035 100%)",
  },
  "thunderstorm": {
    light: "linear-gradient(180deg, #3a4870 0%, #2a3860 50%, #141e30 100%)",
    night: "linear-gradient(180deg, #0a0f1a 0%, #141e30 50%, #243b55 100%)",
  },
  "snow-d": {
    light: "linear-gradient(180deg, #f0f4ff 0%, #c9d6ff 50%, #a4b6e0 100%)",
    night: "linear-gradient(180deg, #2c3e50 0%, #3a5b7a 50%, #4ca1af 100%)",
  },
  "snow-n": {
    light: "linear-gradient(180deg, #5a7090 0%, #3e5878 50%, #2c3e50 100%)",
    night: "linear-gradient(180deg, #1a2535 0%, #2c3e50 50%, #4ca1af 100%)",
  },
  "mist-d": {
    light: "linear-gradient(180deg, #d5dadd 0%, #95a5a6 50%, #5d6d7e 100%)",
    night: "linear-gradient(180deg, #232526 0%, #353b40 50%, #414345 100%)",
  },
  "mist-n": {
    light: "linear-gradient(180deg, #4a5058 0%, #353b40 50%, #232526 100%)",
    night: "linear-gradient(180deg, #15181c 0%, #232526 50%, #2c3035 100%)",
  },
};

function getGradientKey(main, icon) {
  const isDay = (icon || "").endsWith("d");
  const m = (main || "").toLowerCase();
  if (m === "clear") return isDay ? "clear-d" : "clear-n";
  if (m === "clouds") return isDay ? "clouds-d" : "clouds-n";
  if (m === "rain" || m === "drizzle") return isDay ? "rain-d" : "rain-n";
  if (m === "thunderstorm") return "thunderstorm";
  if (m === "snow") return isDay ? "snow-d" : "snow-n";
  if (m === "mist" || m === "fog" || m === "haze" || m === "smoke" || m === "dust" || m === "sand" || m === "ash" || m === "tornado")
    return isDay ? "mist-d" : "mist-n";
  return isDay ? "clear-d" : "clear-n";
}

function applyWeatherGradient(data) {
  if (!data || !data.weather || !data.weather[0]) return;
  const key = getGradientKey(data.weather[0].main, data.weather[0].icon);
  const themeKey = state.theme === "night" ? "night" : "light";
  const gradient = (PAGE_GRADIENTS[key] && PAGE_GRADIENTS[key][themeKey]) || PAGE_GRADIENTS["clear-d"].light;
  els.html.style.setProperty("--page-gradient", gradient);
}

// ---- Init ----
const DEFAULT_WEATHER = { weather: [{ main: "clear", icon: "d" }] };

function init() {
  applyTheme(state.theme);
  applyUnits(state.units);
  bindEvents();
  // Apply a default gradient so the page isn't blank/white before the
  // user searches. Will be replaced once real weather data arrives.
  applyWeatherGradient(DEFAULT_WEATHER);
  // Try to auto-detect location so the user sees weather on load.
  tryAutoDetectLocation();
}

function tryAutoDetectLocation() {
  if (!navigator.geolocation) return;
  // Silently request; if user denies, just keep the default gradient.
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
    () => { /* permission denied or unavailable — keep default */ },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
  );
}

function bindEvents() {
  els.themeToggle.addEventListener("click", toggleTheme);
  els.searchForm.addEventListener("submit", onSearch);
  els.geoBtn.addEventListener("click", onUseLocation);
  els.unitC.addEventListener("click", () => setUnits("metric"));
  els.unitF.addEventListener("click", () => setUnits("imperial"));
}

// ---- Theme ----
function applyTheme(theme) {
  els.html.setAttribute("data-theme", theme);
  state.theme = theme;
  localStorage.setItem("weather-theme", theme);
}

function toggleTheme() {
  applyTheme(state.theme === "light" ? "night" : "light");
  // Re-apply the page gradient so it shifts to the variant for the new theme.
  if (state.lastCurrent) applyWeatherGradient(state.lastCurrent);
}

// ---- Units ----
function applyUnits(units) {
  state.units = units;
  localStorage.setItem("weather-units", units);
  els.unitC.classList.toggle("active", units === "metric");
  els.unitF.classList.toggle("active", units === "imperial");
  els.unitC.setAttribute("aria-pressed", String(units === "metric"));
  els.unitF.setAttribute("aria-pressed", String(units === "imperial"));
  els.tempUnit.textContent = units === "metric" ? "°C" : "°F";
}

function setUnits(units) {
  if (units === state.units) return;
  applyUnits(units);
  // Re-fetch last data so labels (wind, feels like) reflect new units.
  if (state.lastQuery) fetchWeatherForQuery(state.lastQuery);
}

function tempUnitLabel() {
  return state.units === "metric" ? "°C" : "°F";
}
function windUnitLabel() {
  return state.units === "metric" ? "m/s" : "mph";
}

// ---- API helpers ----
async function apiFetch(path, params) {
  const url = new URL(BASE_URL + path);
  url.searchParams.set("appid", API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("units", state.units);

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        "Invalid API key. Edit script.js and replace YOUR_API_KEY with your OpenWeatherMap key."
      );
    }
    if (res.status === 404) {
      throw new Error("Location not found. Check the spelling and try again.");
    }
    throw new Error(`Request failed (${res.status}). Please try again.`);
  }
  return res.json();
}

// ---- UI helpers ----
function setStatus(message, type = "info") {
  els.status.textContent = message || "";
  els.status.className = "status" + (message ? " " + type : "");
}

function pickIcon(iconCode) {
  return ICON_MAP[iconCode] || "🌡️";
}

// ---- Data fetching ----
async function fetchByCity(city) {
  setStatus("Loading…", "info");
  try {
    const [current, forecast] = await Promise.all([
      apiFetch("/weather", { q: city }),
      apiFetch("/forecast", { q: city }),
    ]);
    state.lastQuery = { type: "city", name: city };
    renderCurrent(current);
    renderForecast(forecast);
    setStatus("");
  } catch (err) {
    handleError(err);
  }
}

async function fetchByCoords(lat, lon) {
  setStatus("Loading…", "info");
  try {
    const [current, forecast] = await Promise.all([
      apiFetch("/weather", { lat, lon }),
      apiFetch("/forecast", { lat, lon }),
    ]);
    state.lastQuery = { type: "coords", lat, lon };
    renderCurrent(current);
    renderForecast(forecast);
    setStatus("");
  } catch (err) {
    handleError(err);
  }
}

function fetchWeatherForQuery(q) {
  if (q.type === "city") fetchByCity(q.name);
  else if (q.type === "coords") fetchByCoords(q.lat, q.lon);
}

function handleError(err) {
  console.error(err);
  setStatus(err.message || "Something went wrong.", "error");
  els.currentSection.hidden = true;
  els.forecastSection.hidden = true;
}

// ---- Rendering ----
function renderCurrent(data) {
  state.lastCurrent = data;
  applyWeatherGradient(data);
  els.currentSection.hidden = false;
  els.cityName.textContent = `${data.name}, ${data.sys.country}`;
  els.weatherDesc.textContent = data.weather[0].description;
  els.temp.textContent = Math.round(data.main.temp);
  els.weatherIcon.textContent = pickIcon(data.weather[0].icon);
  els.feelsLike.textContent = `${Math.round(data.main.feels_like)}${tempUnitLabel()}`;
  els.humidity.textContent = `${data.main.humidity}%`;
  els.wind.textContent = `${data.wind.speed} ${windUnitLabel()}`;
  els.pressure.textContent = `${data.main.pressure} hPa`;
}

function renderForecast(data) {
  // The 5-day/3-hour forecast returns 40 entries; reduce to one per day
  // by picking the entry closest to local 12:00 for each date.
  const byDay = new Map();
  for (const entry of data.list) {
    const date = new Date(entry.dt * 1000);
    const dayKey = date.toISOString().slice(0, 10);
    const hour = date.getHours();
    const existing = byDay.get(dayKey);
    // Prefer midday entries; otherwise keep the first one we see.
    const isBetter =
      !existing ||
      Math.abs(hour - 12) < Math.abs(new Date(existing.dt * 1000).getHours() - 12);
    if (isBetter) byDay.set(dayKey, entry);
  }

  // Take the first 5 distinct days (skip today if it's already shown as "current").
  const todayKey = new Date().toISOString().slice(0, 10);
  const days = [...byDay.entries()]
    .filter(([k]) => k !== todayKey)
    .slice(0, 5);

  // For min/max, group all entries per day and find extremes.
  const minMaxByDay = new Map();
  for (const entry of data.list) {
    const dayKey = new Date(entry.dt * 1000).toISOString().slice(0, 10);
    if (dayKey === todayKey) continue;
    const cur = minMaxByDay.get(dayKey) || { min: entry.main.temp, max: entry.main.temp };
    cur.min = Math.min(cur.min, entry.main.temp);
    cur.max = Math.max(cur.max, entry.main.temp);
    minMaxByDay.set(dayKey, cur);
  }

  els.forecastGrid.innerHTML = days
    .map(([dayKey, entry]) => {
      const date = new Date(entry.dt * 1000);
      const dayName = date.toLocaleDateString(undefined, { weekday: "short" });
      const dateStr = date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const { min, max } = minMaxByDay.get(dayKey);
      return `
        <div class="forecast-card">
          <div class="forecast-day">${dayName}</div>
          <div class="forecast-date">${dateStr}</div>
          <div class="forecast-icon">${pickIcon(entry.weather[0].icon)}</div>
          <div class="forecast-temp">
            ${Math.round(max)}°
            <span class="forecast-temp-min">${Math.round(min)}°</span>
          </div>
          <div class="forecast-desc">${entry.weather[0].description}</div>
        </div>
      `;
    })
    .join("");

  els.forecastSection.hidden = days.length === 0;
}

// ---- Event handlers ----
function onSearch(e) {
  e.preventDefault();
  const city = els.searchInput.value.trim();
  if (!city) return;
  fetchByCity(city);
}

function onUseLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not supported by your browser.", "error");
    return;
  }
  setStatus("Detecting your location…", "info");
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
    (err) => {
      const msg =
        err.code === err.PERMISSION_DENIED
          ? "Location permission denied. Search by city instead."
          : "Could not detect your location. Try again or search by city.";
      setStatus(msg, "error");
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
}

// ---- Boot ----
init();
