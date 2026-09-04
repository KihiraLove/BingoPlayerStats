# Bingo Player Stats

A browser-only Old School RuneScape player-stat checker aimed at bingo organisers.

Paste one RuneScape name per line (or paste a column directly from Excel/Google Sheets), fetch the players, then copy the resulting table back into a spreadsheet as TSV or download it as CSV.

## Data flow

1. **Primary:** official OSRS HiScores, requested through the OSRS Wiki CORS proxy so the static GitHub Pages app can access Jagex's public endpoint from a browser.
2. **Account classification:** official specialist HiScore boards are probed for level-3, 1-defence, UIM, HCIM and IM classification. TempleOSRS player info is used opportunistically to identify GIM accounts.
3. **Local efficiency metrics:** EHP/EHB are calculated in the browser. The efficiency algorithm and rate configurations are adapted from the MIT-licensed Wise Old Man project; see `THIRD_PARTY_NOTICES.md`.
4. **Fallback:** if the official HiScores lookup fails, TempleOSRS is queried. If Temple reports the player was last checked more than one hour ago, the app requests a datapoint refresh before loading Temple stats.

## Output

The summary starts with the same fields as the original `_smallPersonalProjects/get_from_temple/main.py` tool:

- Username
- Gamemode
- EHP
- Special EHP
- EHB
- Special EHB

The viewer can also expose raw skill XP and boss/activity scores. Use **Copy summary**, **Copy all**, **Download summary CSV**, or **Download all CSV** for spreadsheet workflows.

## Run locally

No build step or backend is required.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly with a `file://` URL is not recommended because browsers apply stricter module/CORS rules to local files.

## Tests

```bash
node --test
```

There are no npm dependencies.

## GitHub Pages

The repository contains a Pages workflow in `.github/workflows/pages.yml`. In GitHub, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions** once, then pushes to `main` deploy automatically.

## Accuracy and third-party services

- HiScore values originate from Jagex's public Old School HiScores.
- The OSRS Wiki proxy only solves browser CORS; it does not replace the underlying Jagex data source.
- TempleOSRS metrics are used as-is when the Temple fallback is selected.
- Locally calculated metrics use vendored open-source efficiency algorithms/rates. They should not be assumed to match TempleOSRS exactly after either project's rate tables change.
- GIM has no individual Jagex HiScore board. When Temple identifies a GIM while the primary source remains Jagex, the local special metric currently uses the Ironman efficiency profile as the closest available local profile.

## Rate limits

The app processes players with conservative concurrency and retries transient responses. Avoid repeatedly refreshing very large lists; Jagex and TempleOSRS are shared public services.
