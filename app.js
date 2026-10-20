// Weather Dashboard — uses the free Open-Meteo APIs (no API key needed).
// 1. The geocoding API turns a city name into latitude/longitude.
// 2. The forecast API returns current weather and a 7-day forecast for that location.

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_CITY = "London";
const LAST_CITY_KEY = "weather-dashboard:last-city";

// Open-Meteo returns WMO weather codes; map them to a label and an icon.
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "🌙"],
  1: ["Mainly clear", "🌤️", "🌙"],
  2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Light showers", "🌦️"],
  81: ["Showers", "🌧️"],
  82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Severe thunderstorm with hail", "⛈️"],
};

const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("city-input"),
  button: document.querySelector("#search-form button"),
  status: document.getElementById("status"),
  current: document.getElementById("current"),
  location: document.getElementById("location"),
  condition: document.getElementById("condition"),
  currentIcon: document.getElementById("current-icon"),
  temperature: document.getElementById("temperature"),
  feelsLike: document.getElementById("feels-like"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  forecastSection: document.getElementById("forecast-section"),
  forecast: document.getElementById("forecast"),
};

function describeWeather(code, isDay = true) {
  const [label, dayIcon, nightIcon] = WEATHER_CODES[code] ?? ["Unknown", "❔"];
  return { label, icon: !isDay && nightIcon ? nightIcon : dayIcon };
}

function showStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
  els.status.hidden = false;
}

function hideStatus() {
  els.status.hidden = true;
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Couldn't reach the weather service. Check your internet connection and try again.");
  }
  if (!response.ok) {
    throw new Error(`The weather service returned an error (${response.status}). Please try again later.`);
  }
  return response.json();
}

async function findCity(name) {
  const params = new URLSearchParams({ name, count: 1, language: "en", format: "json" });
  const data = await fetchJson(`${GEOCODING_URL}?${params}`);
  // When nothing matches, Open-Meteo omits the "results" field entirely.
  if (!data.results || data.results.length === 0) {
    throw new Error(`We couldn't find a city called "${name}". Check the spelling or try a nearby larger city.`);
  }
  return data.results[0];
}

async function getForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: 7,
  });
  return fetchJson(`${FORECAST_URL}?${params}`);
}

function renderCurrent(city, weather) {
  const { current } = weather;
  const { label, icon } = describeWeather(current.weather_code, current.is_day === 1);
  const place = [city.name, city.admin1, city.country].filter(Boolean);
  // Avoid repeating the name when the region has the same name (e.g. "Lisbon, Lisbon").
  const unique = place.filter((part, i) => i === 0 || !part.startsWith(place[0]));

  els.location.textContent = unique.join(", ");
  els.condition.textContent = label;
  els.currentIcon.textContent = icon;
  els.temperature.textContent = `${Math.round(current.temperature_2m)}°`;
  els.feelsLike.textContent = `${Math.round(current.apparent_temperature)}°C`;
  els.humidity.textContent = `${current.relative_humidity_2m}%`;
  els.wind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  els.current.hidden = false;
}

function renderForecast(weather) {
  const { daily } = weather;
  const dayName = new Intl.DateTimeFormat(undefined, { weekday: "short" });

  const items = daily.time.map((date, i) => {
    const { label, icon } = describeWeather(daily.weather_code[i]);
    // Parse as local noon so the weekday doesn't shift across timezones.
    const name = i === 0 ? "Today" : dayName.format(new Date(`${date}T12:00:00`));
    const rain = daily.precipitation_probability_max[i];

    const li = document.createElement("li");
    li.innerHTML = `
      <span class="day"></span>
      <span class="icon" role="img"></span>
      <span class="temps"><strong class="max"></strong> / <span class="min"></span></span>
      <span class="rain"></span>`;
    li.querySelector(".day").textContent = name;
    li.querySelector(".icon").textContent = icon;
    li.querySelector(".icon").setAttribute("aria-label", label);
    li.querySelector(".icon").title = label;
    li.querySelector(".max").textContent = `${Math.round(daily.temperature_2m_max[i])}°`;
    li.querySelector(".min").textContent = `${Math.round(daily.temperature_2m_min[i])}°`;
    li.querySelector(".rain").textContent = rain == null ? "" : `💧 ${rain}%`;
    return li;
  });

  els.forecast.replaceChildren(...items);
  els.forecastSection.hidden = false;
}

async function loadCity(name) {
  const query = name.trim();
  if (!query) {
    showStatus("Please type a city name.", true);
    return;
  }

  els.button.disabled = true;
  showStatus(`Loading weather for ${query}…`);

  try {
    const city = await findCity(query);
    const weather = await getForecast(city.latitude, city.longitude);
    renderCurrent(city, weather);
    renderForecast(weather);
    hideStatus();
    try { localStorage.setItem(LAST_CITY_KEY, city.name); } catch { /* storage unavailable */ }
  } catch (error) {
    els.current.hidden = true;
    els.forecastSection.hidden = true;
    showStatus(error.message, true);
  } finally {
    els.button.disabled = false;
  }
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadCity(els.input.value);
});

let startCity = DEFAULT_CITY;
try { startCity = localStorage.getItem(LAST_CITY_KEY) || DEFAULT_CITY; } catch { /* storage unavailable */ }
loadCity(startCity);
