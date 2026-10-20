// Weather Dashboard — uses the free Open-Meteo APIs (no API key needed).
// 1. The geocoding API turns a city name into latitude/longitude.
// 2. The forecast API returns current, hourly and 7-day weather for that location.

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_CITY = "London";
const MAX_RECENT = 5;
const STORAGE = { unit: "weather-dashboard:unit", recent: "weather-dashboard:recent" };

// Open-Meteo returns WMO weather codes: [label, day icon, night icon?, sky theme].
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "🌙", "clear"],
  1: ["Mainly clear", "🌤️", "🌙", "clear"],
  2: ["Partly cloudy", "⛅", "☁️", "cloudy"],
  3: ["Overcast", "☁️", null, "cloudy"],
  45: ["Fog", "🌫️", null, "fog"],
  48: ["Freezing fog", "🌫️", null, "fog"],
  51: ["Light drizzle", "🌦️", "🌧️", "rain"],
  53: ["Drizzle", "🌦️", "🌧️", "rain"],
  55: ["Heavy drizzle", "🌧️", null, "rain"],
  56: ["Freezing drizzle", "🌧️", null, "rain"],
  57: ["Heavy freezing drizzle", "🌧️", null, "rain"],
  61: ["Light rain", "🌦️", "🌧️", "rain"],
  63: ["Rain", "🌧️", null, "rain"],
  65: ["Heavy rain", "🌧️", null, "rain"],
  66: ["Freezing rain", "🌧️", null, "rain"],
  67: ["Heavy freezing rain", "🌧️", null, "rain"],
  71: ["Light snow", "🌨️", null, "snow"],
  73: ["Snow", "🌨️", null, "snow"],
  75: ["Heavy snow", "❄️", null, "snow"],
  77: ["Snow grains", "🌨️", null, "snow"],
  80: ["Light showers", "🌦️", "🌧️", "rain"],
  81: ["Showers", "🌧️", null, "rain"],
  82: ["Violent showers", "⛈️", null, "storm"],
  85: ["Snow showers", "🌨️", null, "snow"],
  86: ["Heavy snow showers", "❄️", null, "snow"],
  95: ["Thunderstorm", "⛈️", null, "storm"],
  96: ["Thunderstorm with hail", "⛈️", null, "storm"],
  99: ["Severe thunderstorm with hail", "⛈️", null, "storm"],
};

const $ = (id) => document.getElementById(id);
const els = {
  app: document.querySelector(".app"),
  form: $("search-form"),
  input: $("city-input"),
  suggestions: $("suggestions"),
  locate: $("locate-button"),
  recent: $("recent"),
  unitButtons: document.querySelectorAll(".unit-toggle button"),
  status: $("status"),
  current: $("current"),
  location: $("location"),
  localTime: $("local-time"),
  condition: $("condition"),
  highLow: $("high-low"),
  currentIcon: $("current-icon"),
  temperature: $("temperature"),
  details: $("details"),
  hourlySection: $("hourly-section"),
  hourly: $("hourly"),
  forecastSection: $("forecast-section"),
  forecast: $("forecast"),
};

const state = {
  unit: readStorage(STORAGE.unit, "C") === "F" ? "F" : "C",
  recent: [readStorage(STORAGE.recent, [])].flat().filter((p) => p && Number.isFinite(p.latitude)),
  place: null,
  weather: null,
  suggestions: [],
  activeSuggestion: -1,
};

// ---------- Small helpers ----------

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// Create an element with a class and text, so API data is never parsed as HTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function describeWeather(code, isDay = true) {
  const [label, dayIcon, nightIcon, sky] = WEATHER_CODES[code] ?? ["Unknown", "❔", null, "cloudy"];
  const icon = !isDay && nightIcon ? nightIcon : dayIcon;
  const theme = sky === "clear" ? (isDay ? "clear-day" : "clear-night") : sky;
  return { label, icon, theme };
}

// Open-Meteo times are already in the city's local time (e.g. "2026-10-20T14:00"),
// so parse them without a timezone and format them without converting.
const localDate = (isoTime) => new Date(isoTime);
const formatters = {
  weekday: new Intl.DateTimeFormat(undefined, { weekday: "short" }),
  hour: new Intl.DateTimeFormat(undefined, { hour: "numeric" }),
  time: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }),
  full: new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }),
};

const temp = (celsius) => `${Math.round(state.unit === "F" ? celsius * 9 / 5 + 32 : celsius)}°`;
const speed = (kmh) => (state.unit === "F" ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`);

function uvLabel(uv) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function compassDirection(degrees) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
}

function countryFlag(code) {
  if (!code || code.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function placeLabel(place) {
  const parts = [place.name, place.admin1, place.country].filter(Boolean);
  // Avoid repeats like "Lisbon, Lisbon District" or "New York, New York".
  return parts.filter((part, i) => i === 0 || !part.startsWith(parts[0])).join(", ");
}

function showStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
  els.status.hidden = false;
}

function hideStatus() {
  els.status.hidden = true;
}

function setLoading(isLoading) {
  els.app.classList.toggle("loading", isLoading);
  els.form.querySelectorAll("button").forEach((button) => { button.disabled = isLoading; });
}

// ---------- API ----------

async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn't reach the weather service. Check your internet connection and try again.");
  }
  if (!response.ok) {
    throw new Error(`The weather service returned an error (${response.status}). Please try again later.`);
  }
  return response.json();
}

async function searchCities(name, count, options) {
  const params = new URLSearchParams({ name, count, language: "en", format: "json" });
  const data = await fetchJson(`${GEOCODING_URL}?${params}`, options);
  // When nothing matches, Open-Meteo omits the "results" field entirely.
  return data.results ?? [];
}

async function findCity(name) {
  const [city] = await searchCities(name, 1);
  if (!city) {
    throw new Error(`We couldn't find a city called "${name}". Check the spelling or try a nearby larger city.`);
  }
  return city;
}

function getForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
    timezone: "auto",
    forecast_days: 7,
    forecast_hours: 24,
  });
  return fetchJson(`${FORECAST_URL}?${params}`);
}

// ---------- Rendering ----------

function render() {
  if (!state.place || !state.weather) return;
  renderCurrent(state.place, state.weather);
  renderHourly(state.weather);
  renderForecast(state.weather);
}

function renderCurrent(place, weather) {
  const { current, daily } = weather;
  const { label, icon, theme } = describeWeather(current.weather_code, current.is_day === 1);
  document.body.dataset.sky = theme;

  els.location.textContent = placeLabel(place);
  els.localTime.textContent = `Local time: ${formatters.full.format(localDate(current.time))}`;
  els.condition.textContent = label;
  els.highLow.textContent = `H: ${temp(daily.temperature_2m_max[0])}  ·  L: ${temp(daily.temperature_2m_min[0])}`;
  els.currentIcon.textContent = icon;
  els.temperature.textContent = temp(current.temperature_2m);

  const uv = daily.uv_index_max[0];
  const details = [
    ["Feels like", temp(current.apparent_temperature)],
    ["Humidity", `${current.relative_humidity_2m}%`],
    ["Wind", speed(current.wind_speed_10m), compassDirection(current.wind_direction_10m)],
    ["UV index", uv == null ? "–" : Math.round(uv), uv == null ? null : uvLabel(uv)],
    ["Sunrise", formatters.time.format(localDate(daily.sunrise[0]))],
    ["Sunset", formatters.time.format(localDate(daily.sunset[0]))],
  ];

  els.details.replaceChildren(...details.map(([term, value, note]) => {
    const item = el("div");
    const dd = el("dd", null, String(value));
    if (note) dd.append(" ", el("small", null, note));
    item.append(el("dt", null, term), dd);
    return item;
  }));
  els.current.hidden = false;
}

function renderHourly(weather) {
  const { hourly } = weather;
  const items = hourly.time.map((time, i) => {
    const { label, icon } = describeWeather(hourly.weather_code[i], hourly.is_day[i] === 1);
    const rain = hourly.precipitation_probability[i];
    const li = el("li");
    const iconEl = el("span", "icon", icon);
    iconEl.setAttribute("role", "img");
    iconEl.setAttribute("aria-label", label);
    iconEl.title = label;
    li.append(
      el("span", "time", i === 0 ? "Now" : formatters.hour.format(localDate(time))),
      iconEl,
      el("span", "temp", temp(hourly.temperature_2m[i])),
      el("span", "rain", rain ? `💧${rain}%` : ""),
    );
    return li;
  });
  els.hourly.replaceChildren(...items);
  els.hourly.scrollLeft = 0;
  els.hourlySection.hidden = false;
}

function renderForecast(weather) {
  const { daily } = weather;
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const span = weekMax - weekMin || 1;

  const items = daily.time.map((date, i) => {
    const { label, icon } = describeWeather(daily.weather_code[i]);
    const min = daily.temperature_2m_min[i];
    const max = daily.temperature_2m_max[i];
    const rain = daily.precipitation_probability_max[i];

    const li = el("li");
    const iconEl = el("span", "icon", icon);
    iconEl.setAttribute("role", "img");
    iconEl.setAttribute("aria-label", label);
    iconEl.title = label;

    // The bar shows this day's range within the whole week's range.
    const range = el("span", "range");
    const fill = el("span");
    fill.style.left = `${((min - weekMin) / span) * 100}%`;
    fill.style.width = `${((max - min) / span) * 100}%`;
    range.append(fill);

    li.append(
      el("span", "day", i === 0 ? "Today" : formatters.weekday.format(localDate(`${date}T12:00`))),
      iconEl,
      el("span", "rain", rain ? `💧${rain}%` : ""),
      el("span", "min", temp(min)),
      range,
      el("span", "max", temp(max)),
    );
    return li;
  });

  els.forecast.replaceChildren(...items);
  els.forecastSection.hidden = false;
}

function renderRecent() {
  els.recent.replaceChildren(...state.recent.map((place) => {
    const button = el("button", null, `${countryFlag(place.country_code)} ${place.name}`);
    button.type = "button";
    button.title = placeLabel(place);
    button.addEventListener("click", () => loadPlace(place));
    return button;
  }));
  els.recent.hidden = state.recent.length === 0;
}

function setUnit(unit) {
  state.unit = unit;
  writeStorage(STORAGE.unit, unit);
  els.unitButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.unit === unit)));
  render();
}

// ---------- Loading weather ----------

function rememberPlace(place) {
  if (place.isCurrentLocation) return;
  const { name, admin1, country, country_code, latitude, longitude } = place;
  state.recent = [{ name, admin1, country, country_code, latitude, longitude }, ...state.recent.filter((p) => !isSameSpot(p, place))]
    .slice(0, MAX_RECENT);
  writeStorage(STORAGE.recent, state.recent);
  renderRecent();
}

// Coordinates go in the link too, so it reopens the same Paris (France vs. Texas).
function updateUrl(place) {
  const url = new URL(location.href);
  for (const key of ["city", "lat", "lon"]) url.searchParams.delete(key);
  if (!place.isCurrentLocation) {
    url.searchParams.set("city", place.name);
    url.searchParams.set("lat", place.latitude.toFixed(4));
    url.searchParams.set("lon", place.longitude.toFixed(4));
  }
  history.replaceState(null, "", url);
}

const isSameSpot = (a, b) => Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;

async function loadPlace(place) {
  closeSuggestions();
  setLoading(true);
  showStatus(`Loading weather for ${place.name}…`);
  try {
    const weather = await getForecast(place.latitude, place.longitude);
    state.place = place;
    state.weather = weather;
    render();
    hideStatus();
    rememberPlace(place);
    updateUrl(place);
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setLoading(false);
  }
}

async function loadCityByName(name) {
  const query = name.trim();
  if (!query) {
    showStatus("Please type a city name.", true);
    return;
  }
  closeSuggestions();
  setLoading(true);
  showStatus(`Searching for ${query}…`);
  try {
    const city = await findCity(query);
    await loadPlace(city);
  } catch (error) {
    setLoading(false);
    showStatus(error.message, true);
  }
}

function loadCurrentLocation() {
  if (!navigator.geolocation) {
    showStatus("Your browser doesn't support location. Search for a city instead.", true);
    return;
  }
  showStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      loadPlace({
        name: "📍 Your location",
        country: `${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)}`,
        latitude: coords.latitude,
        longitude: coords.longitude,
        isCurrentLocation: true,
      });
    },
    (error) => {
      const messages = {
        1: "Location access was blocked. Allow it in your browser settings, or search for a city instead.",
        2: "Your location isn't available right now. Search for a city instead.",
        3: "Finding your location took too long. Please try again.",
      };
      showStatus(messages[error.code] ?? messages[2], true);
    },
    { timeout: 10000, maximumAge: 10 * 60 * 1000 },
  );
}

// ---------- Search suggestions ----------

let suggestTimer;
let suggestController;

function closeSuggestions() {
  clearTimeout(suggestTimer);
  suggestController?.abort();
  state.suggestions = [];
  state.activeSuggestion = -1;
  els.suggestions.hidden = true;
  els.input.setAttribute("aria-expanded", "false");
  els.input.removeAttribute("aria-activedescendant");
}

function renderSuggestions() {
  els.suggestions.replaceChildren(...state.suggestions.map((place, i) => {
    const li = el("li");
    li.id = `suggestion-${i}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", String(i === state.activeSuggestion));
    const region = [place.admin1, place.country].filter(Boolean).join(", ");
    li.append(el("span", "flag", countryFlag(place.country_code)), el("span", null, place.name), el("span", "region", region));
    // mousedown (not click) so the input doesn't lose focus and close the list first.
    li.addEventListener("mousedown", (event) => {
      event.preventDefault();
      els.input.value = place.name;
      loadPlace(place);
    });
    return li;
  }));

  const open = state.suggestions.length > 0;
  els.suggestions.hidden = !open;
  els.input.setAttribute("aria-expanded", String(open));
  if (state.activeSuggestion >= 0) els.input.setAttribute("aria-activedescendant", `suggestion-${state.activeSuggestion}`);
  else els.input.removeAttribute("aria-activedescendant");
}

function requestSuggestions() {
  const query = els.input.value.trim();
  closeSuggestions();
  if (query.length < 2) return;

  // Wait until the user pauses typing, and cancel any request that's still running.
  suggestTimer = setTimeout(async () => {
    suggestController = new AbortController();
    try {
      state.suggestions = await searchCities(query, 5, { signal: suggestController.signal });
      state.activeSuggestion = -1;
      renderSuggestions();
    } catch {
      // Suggestions are optional; a failed request just shows none.
    }
  }, 250);
}

function handleSuggestionKeys(event) {
  const count = state.suggestions.length;
  if (event.key === "Escape") {
    closeSuggestions();
    return;
  }
  if (!count || !["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;

  if (event.key === "Enter") {
    if (state.activeSuggestion < 0) return; // let the form submit normally
    event.preventDefault();
    const place = state.suggestions[state.activeSuggestion];
    els.input.value = place.name;
    loadPlace(place);
    return;
  }

  event.preventDefault();
  const step = event.key === "ArrowDown" ? 1 : -1;
  state.activeSuggestion = (state.activeSuggestion + step + count) % count;
  renderSuggestions();
}

// ---------- Start up ----------

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadCityByName(els.input.value);
});
els.input.addEventListener("input", requestSuggestions);
els.input.addEventListener("keydown", handleSuggestionKeys);
els.input.addEventListener("blur", closeSuggestions);
els.locate.addEventListener("click", loadCurrentLocation);
els.unitButtons.forEach((button) => button.addEventListener("click", () => setUnit(button.dataset.unit)));

setUnit(state.unit);
renderRecent();

// Open a shared link like ?city=Paris&lat=33.66&lon=-95.56 at the exact place it points to.
async function loadFromLink(name, latitude, longitude) {
  const target = { latitude, longitude };
  const saved = state.recent.find((p) => isSameSpot(p, target));
  if (saved) return loadPlace(saved);
  try {
    const matches = await searchCities(name, 10);
    const match = matches.find((p) => isSameSpot(p, target));
    loadPlace(match ?? { name, latitude, longitude });
  } catch {
    loadPlace({ name, latitude, longitude });
  }
}

// A shared link wins, then the most recent search, then the default city.
const params = new URLSearchParams(location.search);
const linkCity = params.get("city");
const linkLat = parseFloat(params.get("lat"));
const linkLon = parseFloat(params.get("lon"));
if (linkCity && Number.isFinite(linkLat) && Number.isFinite(linkLon)) loadFromLink(linkCity, linkLat, linkLon);
else if (linkCity) loadCityByName(linkCity);
else if (state.recent.length) loadPlace(state.recent[0]);
else loadCityByName(DEFAULT_CITY);
