# ⛅ Weather Dashboard

A clean, responsive weather dashboard built with **plain HTML, CSS and JavaScript** — no frameworks, no build step, no API key.

**Live demo:** https://zzdiogo.github.io/weather-dashboard/

## Features

- 🔍 **Search any city** in the world
- 🌡️ **Current conditions** — temperature, feels-like, humidity, wind speed and a weather icon (with night icons after sunset)
- 📅 **7-day forecast** with daily highs/lows and chance of rain, in the city's local timezone
- 📱 **Mobile-friendly** layout that adapts from desktop to phone
- 🌗 **Light and dark mode** that follows your system setting
- ⚠️ **Clear error messages** when a city isn't found or the network is down
- 💾 Remembers the **last city** you searched

## How it works

The app uses two free [Open-Meteo](https://open-meteo.com/) APIs:

1. **Geocoding API** — converts the city name you type into latitude and longitude.
2. **Forecast API** — returns current weather and the 7-day forecast for those coordinates.

Weather conditions come back as [WMO weather codes](https://open-meteo.com/en/docs#weathervariables), which `app.js` maps to readable labels and emoji icons.

## Run it locally

No installation needed. Clone the repo and open `index.html`:

```bash
git clone https://github.com/zzdiogo/weather-dashboard.git
cd weather-dashboard
open index.html        # macOS (on Windows: start index.html)
```

Or serve it with a local web server if you prefer:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project structure

```
weather-dashboard/
├── index.html   # Page structure
├── style.css    # Styling, responsive layout, dark mode
└── app.js       # API calls, data handling and rendering
```

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
