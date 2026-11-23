# Castward Stage 3 pre-study revisions

## Scope and baseline

- Repository: <https://github.com/jignacio1299/castward>
- Branch: `fix/study3-prestudy-readiness`; baseline: `cd45ff00ef9732bb70a1a7ffa9f70d82a5c1d7c2`.
- Verification date: November 22, 2026 (America/Chicago).
- Implementation commit: [`ebde433`](https://github.com/jignacio1299/castward/commit/ebde433da6cab60301a86de9bc2dc1d13702b436).
- Reviewed the implementation, README, package metadata, Pages workflow, and eight recent commits. Recent history introduced live weather/persistence (`b5d4b13`), hourly forecasts (`3955ce2`), forecast changes (`559094a`), and fixes (`cd45ff0`). No existing tests or mobile media queries were present.
- No R01–R13 specification document is included in the repository. Requirement IDs below are **unverified/unmapped**, not assertions of specification compliance. The CSS comment mentioning R02 alone does not define that requirement. The team must map these changes to its authoritative specification before final submission.
- No user-study records, transcripts, or participant data were created or changed. Synthetic regression notes exist only in disposable automated browser contexts. No merge or deployment was performed.

## Inspection plan and risks

1. Correct location request/reset state in [app.js](../app.js): new coordinates, source labels, preferences, and weather must agree even when requests finish out of order. Risk: stale async responses. Test delayed requests and reset after New York selection.
2. Require exact date/hour lookup and preserve unavailable API fields. Risk: missing values becoming reassuring zeros, or NWS timezone conversion shifting dates. Test missing dates/hours/fields, NWS fallback, and total failure.
3. Aggregate every hourly bucket intersecting the planned run and both comparison windows. Risk: endpoint off-by-one and midnight rollover. Test exact finishes, partial hours, next-day starts, precipitation/wind/temperature changes, and known adverse weather.
4. Keep official alerts separate and unverified states explicit. Risk: failed/unsupported alert checks looking clear. Test active, pending, malformed, rejected, and unsupported checks.
5. Retain the design while adding narrow-screen rules in [style.css](../style.css); verify all screens at 1280×900 and 375×812. Inspect rendered output and runtime errors.
6. Update [README.md](../README.md); add small Node/Playwright regressions and this evidence report. Avoid unrelated feature or dependency remediation.

## Completed changes

Each row's before-study status describes the revised branch, not the still-unmodified published website. Every implementation row is associated with commit `ebde433` linked above.

| Change | Why / previous behavior | Related requirement | Before-study status | Changed files | Evidence |
| --- | --- | --- | --- | --- | --- |
| QA-10: reset and location request consistency | Reset restored Chicago preferences but retained the previous source/coordinates and forecast. Requests now immediately clear old weather, identify new coordinates, reset official-alert state, and prevent superseded responses from rendering over the latest request. Reset saves defaults, refreshes Chicago weather, synchronizes unit/activity/preference/tag controls, and stops/hides the previous timer. | R01–R13 mapping unverified; location/preferences journey | **PASS locally** | [app.js](../app.js), [weather tests](../tests/weather.test.cjs), [browser tests](../tests/browser.test.cjs) | Delayed old-location response cannot replace latest weather. New York → reset yields Chicago name, 41.8818/-87.6232, new source, stored defaults, Fahrenheit, and no active timer at both viewports. |
| Exact hourly lookup and explicit missing values | Lookup previously returned another day's same hour or the first available record. Missing API measurements were replaced with 60°F, zero rain/wind, and invented humidity/clear conditions. Lookup now requires exact date/hour; numeric gaps remain unavailable. No-temperature clothing guidance is withheld while manual choices remain possible. | R01–R13 mapping unverified; forecast accuracy | **PASS locally** | [app.js](../app.js), [weather tests](../tests/weather.test.cjs), [browser tests](../tests/browser.test.cjs) | Exact matches succeed; missing hour/date returns unavailable. Year 2040 produces unavailable readiness, clothing explanation, and hourly values. No `null%`, fabricated 0%, or Dry appears for missing records. |
| Whole-run readiness and explanations | A quiet start could hide later storms, rain, wind, or temperature extremes. Every intersecting hour now contributes; the most adverse known class governs. Explanations show temperature range and peak rain chance/amount/wind. Partial coverage cannot confirm a good window, while known hazards remain visible. WMO freezing precipitation and snow-shower codes are recognized. | R01–R13 mapping unverified; whole-run readiness/explanations | **PASS locally** | [app.js](../app.js), [index.html](../index.html), [weather tests](../tests/weather.test.cjs), [browser tests](../tests/browser.test.cjs), [README.md](../README.md) | 06:30 + 30 min excludes 07:00; +31 min includes it. Later heat, cold, rain probability/amount, wind, fog, and freezing rain affect readiness. Missing temperature does not suppress a known storm. Metrics are explicitly labeled starting-hour values. |
| Midnight comparison, finish, and deadline handling | The later comparison option wrapped its clock to the same date. Comparison now retains next-day dates and uses full-day minute offsets for deadlines; selecting it updates date and time. Crossing-midnight finishes say next day. Home by earlier than start is interpreted as next day. Hourly card dates use calendar arithmetic independent of browser timezone. | R01–R13 mapping unverified; planning/comparison | **PASS locally** | [app.js](../app.js), [weather tests](../tests/weather.test.cjs), [browser tests](../tests/browser.test.cjs), [README.md](../README.md) | 23:30 + 60 min finishes 00:30 next day. Home by 00:45 is met; starting one hour later finishes 45 min late. Selecting that later slot advances the date. Unit checks cover month/year rollover and missing next-day coverage. |
| Source/fallback and official-alert handling | Unsupported alert lookups and malformed success responses could be labeled clear; failed checks could obscure weather hazards. They now remain unverified. Active/unverified alerts prevent an unqualified good-window state without hiding forecast hazards. NWS fallback retains the forecast location's timestamp date/hour, uses the highest wind value in a range, and marks absent precipitation amount/humidity unavailable. Requests have timeouts. Empty forecast payloads invoke fallback. Failed refreshes report failure. | R01–R13 mapping unverified; alerts/data-source transparency | **PASS with isolated failure tests; live primary verified** | [app.js](../app.js), [weather tests](../tests/weather.test.cjs), [README.md](../README.md) | Tests cover pending/active/failed/unsupported/malformed alerts, fallback fields, timezone preservation, wind ranges, and complete network failure. Real Open-Meteo and NWS alert requests both returned HTTP 200 for Chicago. Live NWS fallback was not forced against the public service. |
| QA-12: responsive layout and console review | No mobile breakpoint existed. Narrow headers/cards could exceed the viewport. Added single-column mobile layout, compact navigation/metrics, wrapping, and shrinkable grid children while retaining the existing visual design. Added an empty favicon declaration to avoid the observed missing-favicon console 404. | R01–R13 mapping unverified; responsive usability | **PASS in tested Chromium viewports** | [style.css](../style.css), [index.html](../index.html), [browser tests](../tests/browser.test.cjs) | All 11 screens checked for document overflow at 1280×900 and 375×812. Browser suite records zero console errors/page exceptions. Live recheck also recorded zero. Desktop preferences and live mobile running-window screenshots visually reviewed. Physical devices remain untested. |
| QA-02: documentation and repeatable regression commands | README described embedded default weather, optional fixed-grid NWS data, and session-only storage. It now describes actual live sources, fallback, localStorage contents, heuristics, study limits, and publishing verification. Added Node tests and a single Playwright development dependency; ignore generated test output/dependencies. | R01–R13 mapping unverified; implementation/study documentation | **PASS; requirement mapping pending team specification** | [README.md](../README.md), [package.json](../package.json), [lockfile](../package-lock.json), [.gitignore](../.gitignore), [tests](../tests/) | Documentation cross-checked against fetch URLs, storage key/state, and workflow. `npm test`: 19/19 pass; syntax/editor/whitespace checks pass. |

## Test evidence

Environment: Windows, Node v24.13.0, Playwright 1.65.1, installed Google Chrome. Browser regression contexts use America/Los_Angeles while Chicago is selected, to exercise location timestamps independently of the browser timezone. Automated fixtures are used only by tests, not by the production runtime.

| Check | Result | Evidence / boundary |
| --- | --- | --- |
| `npm test` | **PASS: 19 tests, 0 failures, 0 skipped** | 17 isolated weather checks and two browser journeys, one per viewport. |
| `node --check app.js` | **PASS** | JavaScript syntax check. |
| Editor Problems check | **PASS** | No diagnostics in changed application files or tests. |
| `git diff --check` | **PASS** | No whitespace defects. Local Git may print normal LF/CRLF conversion warnings. |
| Live Open-Meteo primary | **PASS** | Local revised app, real API request: HTTP 200; 72 hourly records; source `Open-Meteo Hourly (41.8818, -87.6232)`. Example returned first record was 2026-11-22T00:00, 51.7°F; this is an observed response, not a fixed expected production value. |
| Live NWS active alerts | **PASS** | HTTP 200; successful empty active-alert result for Chicago at check time. This is not a promise about future alerts. |
| Live console after favicon correction | **PASS** | Zero console errors and zero page exceptions in a fresh Chrome context. Initial missing-favicon 404 was observed and corrected. |
| Visual review | **PASS for reviewed screens** | Desktop preferences and 375×812 live running window inspected; original colors/cards/mascot/navigation retained. Automated overflow checks additionally visit every screen. Screenshots are local ignored test output, not participant artifacts. |
| Earlier test attempts | **Resolved test-authoring errors** | Corrected an expected deadline arithmetic value and selectors that tried to click controls on hidden screens. Final assertions were not weakened to mask application failures. |
| `npm audit` | **FAIL: 2 existing high-severity entries** | `serve` and its transitive `compression` dependency, GHSA-vc2v-76pw-4v95. Reported separately; no dependency upgrade attempted. This concerns the local server dependency, not JavaScript shipped to the browser by static Pages hosting. |

## Main user journeys

PASS means the stated checks passed on the local revised branch. It does not claim participant validation or approval to deploy.

| Journey | Status | Verification |
| --- | --- | --- |
| Plan run, finish time, Home by | **PASS** | Late-return warning, expected finish, midnight finish, and next-day deadline arithmetic. |
| Compare two start windows | **PASS** | Full-window explanations, duration/deadline checks, slot selection, next-day date retention. |
| Hourly forecasts and explanations | **PASS** | 24 dated cards, weather values, whole-run explanation, missing/out-of-range data. |
| Indoor alternative | **PASS** | Confirm indoor session and read saved status. |
| Running versus Run-walk | **PASS** | Activity toggles, walking-interval explanation, storage state. |
| Cooler / Usual / Warmer | **PASS** | Preference toggles; warmer/cooler produce different garment suggestions at the fixture temperature. |
| Manual clothing selections and saved summaries | **PASS** | Manual base deselection and shell selection appear in saved summary and survive reload. Historical snapshot limitation below still applies. |
| Notes, comfort tags, deletion, local persistence | **PASS** | Save synthetic note/tag, reload, verify, delete, reload again. No participant records used. |
| Fahrenheit/Celsius | **PASS** | Fixture 60°F displays 16°C; Celsius preference survives reload; reset restores Fahrenheit. |
| Location changes and reset | **PASS** | Quick-location button selects New York; source/coordinates agree; reset persists Chicago and fetches Chicago weather; stale request unit test. |
| Start/finish session timer | **PASS** | Start shows active panel; finish shows Run complete; reset removes previous timer. |
| Desktop / 375×812 mobile | **PASS in emulation** | Both browser journeys, all-screen overflow assertions, reviewed screenshots, no runtime errors. |
| Live primary forecast / US alert check | **PASS** | Actual successful API responses observed locally. |
| Published revised website | **NOT TESTED** | Approval/deployment has not occurred; published site still represents main. |
| Physical phones, Safari, Firefox, screen readers | **NOT TESTED** | Outside available verification. |

## Unresolved issues and limits

Additional findings are reported here without expanding the requested implementation scope:

1. **Requirement mapping:** obtain the team's authoritative R01–R13 specification and map the rows above. No requirement IDs were invented.
2. **Existing HTML interpolation:** session-note text and some geocoding/search content are interpolated through `innerHTML`. Text containing markup can be interpreted as HTML. This needs a separate escaping/DOM-construction correction; these tests do not claim security clearance.
3. **Existing form validation gaps:** planning controls specify duration bounds, but navigation does not enforce validity before calculation. Invalid/negative durations and unusual date inputs need a separate input-validation pass. The required ordinary durations and forecast-out-of-range dates were tested.
4. **Historical state limits:** the edited plan is not restored as a draft after reload. Saved run summaries are text snapshots; clothing summaries regenerate from current controls/weather rather than retaining immutable past outfits. This existing model is documented, not redesigned.
5. **Clock/DST limits:** initial defaults use device time, not the newly selected city's current clock. Repeated/skipped local hours at daylight-saving transitions are not disambiguated. A Home by time earlier than start now explicitly means next day in calculations/documentation; there is no separate deadline-date picker.
6. **Forecast limits:** hourly location data cannot describe exact minute changes, individual routes/surfaces, gusts, air quality, UV, pollen, heat index, or individual medical risk. Clothing remains based on the starting hour. Heuristics are prototype recommendations, not validated safety standards.
7. **Alert/network limits:** alerts are current checks, not future-run warnings. Refresh before departure; there is no continuous refresh. NWS coverage is US-specific. NWS fallback lacks precipitation amount and therefore remains partial. Restricted storage can prevent persistence. The 15-second timeout path is implemented; a real 15-second public-service timeout was not deliberately induced.
8. **Dependency audit:** two high-severity advisory entries remain in local serving dependencies. Handle dependency remediation separately from this study revision.
9. **Verification boundaries:** physical devices, other browser engines, browser geolocation permission flows, real city-search/reverse-geocoding services, and real active severe-alert conditions were not manually verified. Fallback/failed/unsupported/active alerts were checked with isolated tests. No participant study was conducted.

## Verify the published result after approved deployment

1. Approve the PR before merging. The existing workflow deploys pushes to main, so merge approval also needs to account for that deployment trigger. This revision did not dispatch it.
2. Wait for the Pages deployment of the approved commit to succeed. Open <https://jignacio1299.github.io/castward/> in a fresh browser profile or private window, hard-refresh, and confirm the deployed commit/workflow corresponds to the PR.
3. Open DevTools Network and Console. Reload; confirm a real Open-Meteo hourly request and a separate `api.weather.gov/alerts/active?point=...` request. Verify source coordinates, retrieval label, and response status. No embedded scenarios should appear as weather. Record service failures honestly rather than requiring a particular live forecast.
4. Plan a 60-minute run starting at `:30` within available dates. Check expected finish and Home by, the whole-run ranges, Why this state, and the hourly records on both sides of the boundary. Compare the next start and select it. Repeat at 23:30; confirm next-day finish/date and comparison behavior.
5. Choose a date beyond the three-day horizon. Confirm unavailable/partial guidance and missing measurements, with no other day's data substituted. Return to an available date.
6. Try Running/Run-walk and each comfort preference. Manually change clothing checkboxes, save, add a nonparticipant verification note/tag, reload, verify persistence, delete the note, and reload again. Confirm indoor session and unit-switch journeys. Do not reuse participant records for this check.
7. Change location to New York and then reset. Watch immediately during loading and after completion: Chicago name, coordinates, source, unit controls, and stored defaults must agree. Rapidly change cities to check late-response behavior. Where alerts cannot be checked, verify the explicit unverified message; do not treat it as no warnings.
8. At desktop and 375×812, visit all screens, scroll hourly cards, verify controls remain reachable and no page-wide horizontal overflow occurs. Repeat the critical steps on an actual study phone/browser. Record any Console errors with screen, action, browser, and API status.
9. Record published verification as PASS/FAIL/NOT TESTED with date, deployed commit, device, and source status. Do not mark participant readiness from local automation alone.
