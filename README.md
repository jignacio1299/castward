# Castward

Castward is a browser-based running planner built with HTML, CSS, and JavaScript for a CS 422 functional-prototype user study. Plan a run, review weather across its duration, compare two starts, choose clothing, and save a session reflection. No account, backend, or API key is required.

## Run locally

Use Node.js 20 or newer for the server and test tooling (verification used Node 24 and Chrome):

```sh
npm ci
npm start
```

Open the address printed by the server. It normally uses port 3000; an occupied port can cause it to choose another. In Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`. Use HTTP locally rather than opening the HTML file directly, so browser storage, permissions, and requests behave consistently.

## Weather sources and behavior

- **Open-Meteo Forecast API:** requests three days of hourly temperature, precipitation probability and amount, weather code, wind speed/direction, and relative humidity at the selected coordinates, with `timezone=auto`. Model selection is handled by Open-Meteo. [API documentation](https://open-meteo.com/en/docs).
- **US National Weather Service:** checks official active alerts at the selected point separately from Castward recommendations. A successful empty alert response means no active NWS alerts were returned at retrieval time. Failed, malformed, pending, or unsupported checks do **not** mean there are no warnings. Outside US coverage, consult the local weather authority. [NWS API documentation](https://www.weather.gov/documentation/services-web-api).
- **Forecast fallback:** when Open-Meteo fails or has no hourly records, the app requests NWS point metadata and its hourly forecast. NWS does not provide precipitation amount through that response, so amount is unavailable and readiness remains partial. When both forecast sources fail, the app shows an unavailable state. Forecast requests have a 15-second timeout per request; fallback involves additional sequential requests.
- **Location:** city search uses Open-Meteo geocoding. Browser geolocation requires permission and a secure context (HTTPS or localhost); OpenStreetMap Nominatim supplies an optional place name. Coordinates remain usable if reverse geocoding fails.

The production app always requests live data. [demo-data.json](./demo-data.json) is a historical reference and is not loaded as production weather. There is no silent embedded-weather fallback.

## Planning and recommendations

Run date and time are interpreted as wall-clock times at the forecast location. Readiness checks every hourly bucket overlapping `[start, finish)`; a run ending exactly on the hour does not include the following bucket. Midnight crossings use the next calendar date. Missing hours or required measurements produce an explicit partial/unavailable state, never another date's weather.

The window and comparison explanations show the temperature range, highest precipitation chance, heaviest hourly precipitation, and strongest sustained wind. Individual metric cards and clothing suggestions describe the starting hour; hourly cards show changes. The second comparison option starts one hour later and retains its next-day date when selected. A Home by clock time earlier than the start is interpreted as the next day. Finish time is running time only; allow time for travel and changing.

Castward uses prototype heuristics, not medical or official warning criteria:

- **Reconsider:** thunder/severe/freezing/ice/hail conditions, precipitation probability at least 60%, hourly precipitation at least 5 mm, sustained wind at least 25 mph, or temperature at/below 10°F or at/above 95°F.
- **Use caution:** rain/showers/drizzle/snow/fog, precipitation probability at least 20%, sustained wind at least 16 mph, or temperature at/below 32°F or at/above 80°F.
- A good window requires complete required hourly inputs and a successful NWS alert check with no active alerts returned. Known hazards remain visible even with partial data. Active or unverified alerts prevent an unqualified good-window recommendation.

Clothing heuristics support Running/Run-walk and Cooler/Usual/Warmer. Manual checkboxes take priority and persist. Without a temperature, suggestions are withheld; manual selections remain available. Official NWS messages are displayed under **Official alerts**, separately from **Castward recommendation**.

## Local persistence and privacy

The `castward_user_state_v1` localStorage entry stores location, units, activity, clothing preference, manual clothing overrides, selected comfort tag, session notes, and the most recently saved run/timer state. Data survives reloads in the same browser/origin until reset or browser storage is cleared. There is no application upload of notes. Weather/geocoding providers receive the coordinates or city query needed for their requests.

The currently edited date, start, duration, and Home by fields are not persisted as a draft; saved sessions contain a text snapshot. The clothing summary is regenerated from current controls and weather rather than maintained as an immutable historical outfit. Clearing saved notes and resetting preferences also restores Chicago, Fahrenheit, Run-walk, and Usual, clears manual selections and saved sessions, stops the timer, and fetches a new Chicago forecast. Restricted storage may prevent persistence.

## Verification

```sh
npm test
npm run test:unit
npm run test:browser
```

Tests use Node's test runner and Playwright with installed Google Chrome. Set `CASTWARD_BROWSER=msedge` for an installed Edge instead. No browser download is performed by the suite. The browser tests serve the app on a temporary loopback port and intercept weather requests only inside disposable browser contexts; their deterministic data and regression notes never enter the published app or study records. Tests check desktop 1280×900 and mobile 375×812 layouts, flows, persistence, and console errors. Screenshots are written to ignored `test-results/`.

See [pre-study revisions and evidence](./docs/study3-prestudy-revisions.md) for results, commit references, unresolved issues, and post-deployment checks.

## Study limitations

- Forecasts describe a point and hourly model output, not observed route conditions or minute-by-minute weather. They cannot establish that a run or surface is safe.
- No air-quality, pollen, UV, route inspection, or individualized medical assessment is provided. Temperature heuristics do not calculate heat index or wind chill. Wind gusts are not requested.
- Alerts are current retrieval-time checks, not a guarantee for a future planned run. Refresh and consult official sources before departure. Weather is fetched on load, location selection, reset, or manual refresh; it does not continuously refresh.
- The requested forecast horizon is three days. Other dates and uncovered portions remain unavailable. Network access and service availability are required.
- Initial date/start defaults use the device clock. Selected planning times use the forecast location's clock. Daylight-saving repeated/skipped local hours are not explicitly disambiguated.
- Testing covers Chromium desktop and emulated mobile. Physical mobile devices, Safari/Firefox, screen readers, and participant usability outcomes require separate checks.

## Publishing

The existing [Pages workflow](./.github/workflows/deploy-pages.yml) deploys pushes to `main`; it can also be manually dispatched. Submit and review changes on a dedicated branch. Do not merge or deploy until approved. Published site: <https://jignacio1299.github.io/castward/>.

## Project files

- [index.html](./index.html): screens and controls
- [style.css](./style.css): visual design and responsive layout
- [app.js](./app.js): navigation, live weather, planning, recommendations, and persistence
- [tests/](./tests/): isolated weather and browser regressions
- [package.json](./package.json): server and test commands

## License

The package metadata declares MIT. No standalone license file is included in this repository.
