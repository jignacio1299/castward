# Castward

Castward is a small, browser-based running planner. It helps you choose a run time, check the weather for the whole run, decide what to wear, and save a quick note about how the session felt.

It is a functional prototype built with plain HTML, CSS, and JavaScript. The default demo uses embedded weather data, so it is predictable and works without an API key.

## What you can try

- Plan a run by start time, duration, and return target
- Review temperature, rain chance, wind, alerts, and hourly conditions
- Compare two possible start times
- Get clothing suggestions for running or run-walk sessions
- Adjust suggestions with a warmer or cooler preference
- Save a clothing plan and add a session note
- Switch between Fahrenheit and Celsius
- Try a live hourly forecast from the National Weather Service

## Run the app

You need Node.js 18 or newer.

```bash
npm install
npm start
```

Then open the local address printed in the terminal. With the included `serve` command, it is usually:

<http://localhost:3000>

The app is static, so you can also open `index.html` directly. Running the local server is recommended because it gives you the same experience as a simple hosted demo.

## Deploy on GitHub Pages

Pushes to `main` automatically deploy the site through GitHub Pages. In the repository settings, set **Pages** to use **GitHub Actions** as the build and deployment source. The published URL will be shown on the workflow run and in the repository's Pages settings.

## Quick click-through demo

For the most reliable demonstration, use the default embedded study scenario:

1. Open Castward and click **Plan a run**.
2. Leave the default Chicago values in place and click **See conditions**.
3. Review the planned window, rain chance, wind, and alert message.
4. Click **Compare times** and choose either available time slot.
5. Open **Clothing**, select **Run-walk**, and try **Warmer** or **Cooler**.
6. Click **Save clothing plan**, then open **Saved** to see it.
7. Add a short note such as “The light layer worked well” and click **Save session note**.
8. Open **Preferences** to switch scenarios or change units.

To try live data, open **Preferences** and click **Live NWS API Fetch**. The app requests hourly data for Chicago from the National Weather Service. If that request is unavailable, the embedded demo remains usable.

## Project files

- `index.html` - screens and accessible controls
- `style.css` - responsive layout and visual styling
- `app.js` - navigation, weather logic, recommendations, comparisons, and notes
- `demo-data.json` - reference copy of the deterministic demo scenarios
- `package.json` - local static server configuration

## Notes about data

The default experience does not require an account, backend, or API key. Clothing selections and notes live only in the current browser session and are not uploaded anywhere.

The optional live mode uses the public National Weather Service hourly forecast endpoint for a fixed Chicago grid point. A live request can fail because of network access, service availability, or browser security rules; that failure does not replace the deterministic demo data with fake “clear” conditions.

## License

This project is released under the MIT license.
