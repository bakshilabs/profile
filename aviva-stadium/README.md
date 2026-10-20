# Aviva Stadium: sun and thermal comfort

An interactive analysis of sun exposure and outdoor thermal comfort at the Aviva Stadium in Dublin, with a short film made from the same results.

- [Open the analysis](./)
- [Watch the film](film/aviva-solar-comfort.mp4)

## What it shows

The analysis covers the pitch and the seating bowl for every hour of a typical year. It uses 5,656 points, placed 1.2 m above the pitch and the seats and about 2.5 m apart. For each point and hour it gives:

- whether the point can see the sun;
- the solar energy that reaches it;
- the thermal stress a person would feel there, using the Universal Thermal Climate Index (UTCI).

The page has filters for the period, the hours of the day, the surfaces and the stand section. A 3D view, sliders for the date and time, a compare mode, charts, tables and CSV downloads let you explore the results.

For the whole year between 08:00 and 20:00, averaged over all points, 29% of hours have no thermal stress, 71% have cold stress and 0.1% have heat stress. In the same window the pitch has about 1,400 hours of direct sun a year and the seats about 530.

## How it was made

1. Rays are traced from every point to the sun position at the middle of each of the 8,760 hours of the year, through the 3D model, to find sun and shade. Rays across the sky give the sky view factor of each point.
2. Radiant temperature comes from the SolarCal model, using the share of the body in direct sun and the sky view factor. UTCI then follows from air temperature, radiant temperature, wind speed and humidity.
3. Seats are treated as seated people and the pitch as standing people.
4. The page reads the results as files and calculates the totals for the chosen period in the browser.

## Assumptions and limits

- Roof panels are treated as opaque, although the real roof lets some light through.
- Nearby buildings and trees are not modelled.
- Wind is the weather-station value and is not reduced for shelter inside the bowl.
- A typical year has ordinary days, including cloudy ones. The clear-day buttons jump to the clearest day within a week of the solstices and the March equinox.
- The compass direction of the model was found from satellite imagery and is accurate to about 2 degrees.
- The results come from a model and were not measured on site.

## What is in this folder

- `index.html`, `assets/` and `data/` make up the page.
- `aviva_stadium.glb` is the stadium model, compressed for the web.
- `film/` holds the film.
- `source/` holds the scripts and page code that produced the results.

## Reproducing the results

The original model file is too large for this repository. Download it from the link in the credits and save it as `source/aviva_stadium.glb`. Download the Dublin Airport weather file named in the credits and save its `.epw` file in `source/analysis/weather/`.

```
cd source/analysis
npm install
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python export_sun.py
node annual_exposure.mjs ../aviva_stadium.glb
node terrace.mjs
.venv/bin/python dashboard_data.py

cd ../viewer
mkdir -p public && ln -s ../../aviva_stadium.glb public/aviva_stadium.glb
npm install
npx vite --open /analysis.html
```

The page uses the typefaces from the Bakshi Labs site. To see them in development, copy that site's `assets/fonts` folder to `source/viewer/public/fonts`.

## Credits

- Stadium model by S.Gandini, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). [Original model](https://sketchfab.com/3d-models/aviva-stadium-d62b3a640ccb421487a650e9074609be). The model was compressed for the web, and its colours and transparency were changed.
- Weather: the Dublin Airport typical year for 2011 to 2025 (TMYx) from [Climate.OneBuilding](https://climate.onebuilding.org/), which builds its files from public weather observations and reanalysis data. Lawrie and Crawley, Development of Global Typical Meteorological Years (TMYx). This folder includes the hourly values the page needs and not the original file.
