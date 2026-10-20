# ⛅ Weather Dashboard

A clean, responsive weather dashboard built with **plain HTML, CSS and JavaScript** — no frameworks, no build step, no API key.

**Live demo:** https://zzdiogo.github.io/weather-dashboard/

## Features

- 🔍 **Search any city** with **live suggestions** as you type (with country flags and keyboard navigation), so you can pick the right Paris — France or Texas
- 📍 **Use my location** to get the weather where you are
- 🌡️ **Current conditions** — temperature, feels-like, today's high/low, humidity, wind speed and direction, UV index, sunrise and sunset, plus the city's local time
- 🕐 **Hourly forecast** for the next 24 hours
- 📅 **7-day forecast** with chance of rain and temperature range bars to compare days at a glance
- 🔁 **°C / °F switch** (wind switches to mph too), remembered between visits
- 🎨 **Background that matches the weather** — sunny, clear night, cloudy, rain, snow, storm or fog
- 🕘 **Recent searches** as one-tap buttons
- 🔗 **Shareable links** — the URL updates as you search, e.g. `?city=Tokyo`
- 📱 **Mobile-friendly** layout and 🌗 **light/dark mode** that follows your system setting
- ⚠️ **Clear error messages** when a city isn't found, location is blocked, or the network is down

## How it works

The app uses two free [Open-Meteo](https://open-meteo.com/) APIs:

1. **Geocoding API** — converts the city name you type into latitude and longitude (and powers the suggestions).
2. **Forecast API** — returns current, hourly and 7-day weather for those coordinates, in the city's local timezone.

Your unit choice and recent searches are stored in your browser's `localStorage` — nothing is sent anywhere else.

Weather conditions come back as [WMO weather codes](https://open-meteo.com/en/docs#weathervariables), which `app.js` maps to readable labels and emoji icons.

## Run it locally

No installation needed. Clone the repo and open `index.html`:

```bash
git clone https://github.com/zzdiogo/weather-dashboard.git
cd weather-dashboard
open index.html        # macOS (on Windows: start index.html)
```

Or serve it with a local web server (needed for "Use my location", which browsers only allow on `https://` or `localhost`):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
weather-dashboard/
├── index.html   # Page structure
├── style.css    # Styling, responsive layout, dark mode
└── app.js       # API calls, search suggestions, units and rendering
```

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
