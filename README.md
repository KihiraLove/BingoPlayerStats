# Bingo Player Stats

A browser-only Old School RuneScape player-stat checker aimed at bingo organisers.

Paste one RuneScape name per line (or paste a column directly from Excel/Google Sheets), fetch the players, then copy the resulting table back into a spreadsheet as TSV or download it as CSV.

## Data flow

1. **Primary:** official OSRS HiScores, requested through the OSRS Wiki CORS proxy so the static GitHub Pages app can access Jagex's public endpoint from a browser.
2. **Account classification:** official specialist HiScore boards are probed for level-3, 1-defence, UIM, HCIM and IM classification. HCIM membership is validated against the current account stats so dead HCIM accounts that have progressed beyond their frozen Hardcore snapshot are classified as regular Ironman. TempleOSRS player info is always used to identify GIM accounts where possible. If the gamemode cannot be resolved, the app defaults to **Main**.
3. **Local efficiency metrics:** EHP/EHB are calculated in the browser. The efficiency algorithm and rate configurations are adapted from the MIT-licensed Wise Old Man project; see `THIRD_PARTY_NOTICES.md`.
4. **Fallback:** if the official HiScores lookup fails, TempleOSRS is queried. If Temple reports the player was last checked more than one hour ago, the app requests a datapoint refresh before loading Temple stats.

## Output

The compact output contains:

- Username
- Gamemode
- EHP
- EHB
- Total Level
- Total XP

The **Use special EHP/EHB where applicable** option keeps the same EHP/EHB columns but substitutes the applicable special efficiency value for accounts that have one. It does not add separate Special EHP or Special EHB columns.

HiScores, TempleOSRS and Wise Old Man profile links are independent output options and default to off. Enable **stat customisation** separately to add individual skill levels, skill XP, bosses and activities; those detailed stat options are selected by default.

Spreadsheet output intentionally omits Build, Source, Status, League Points and Grid Points. Activity headings that represent counts/ranks directly (including clues, collections logged, Colosseum glory, Bounty Hunter, PvP Arena, rifts closed, LMS, Lunar Chests and Barrows Chests) have no `Score` suffix. Other boss/activity columns use `KC`.

Use **Copy** or **Download CSV** to export the currently configured output.

## Preferences and cookies

The site has no backend and does not store usernames or player stats.

With consent, it stores the output configuration in a functional browser cookie so the following settings can be restored on the next visit:

- whether stat customisation is enabled;
- which optional stat and profile-link columns are selected;
- whether special EHP/EHB substitution is enabled.

The consent choice itself is stored separately so the banner does not need to be shown on every visit. Declining removes the configuration cookie.

## Run locally

No build step or backend is required.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly with a `file://` URL is not recommended because browsers apply stricter module/CORS rules to local files.

## Tests

```bash
npm test
```

There are no npm dependencies.

## GitHub Pages

The repository contains a Pages workflow in `.github/workflows/pages.yml`. Pushes to `main` deploy automatically through GitHub Actions.

## Accuracy and third-party services

- HiScore values originate from Jagex's public Old School HiScores.
- The OSRS Wiki proxy only solves browser CORS; it does not replace the underlying Jagex data source.
- TempleOSRS metrics are used as-is when the Temple fallback is selected.
- Locally calculated metrics use vendored open-source efficiency algorithms/rates. They should not be assumed to match TempleOSRS exactly after either project's rate tables change.
- GIM has no individual Jagex HiScore board. When Temple identifies a GIM while the primary source remains Jagex, the local special metric currently uses the Ironman efficiency profile as the closest available local profile.

## Rate limits

The app processes players with conservative concurrency and retries transient responses. Avoid repeatedly refreshing very large lists; Jagex and TempleOSRS are shared public services.
