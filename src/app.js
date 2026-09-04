import {
  classifyFromHiscores,
  fetchHiscore,
  fetchTempleFallback
} from "./data.js";
import {
  computeHiscoreResult,
  computeTempleResult,
  EXPORT_SUMMARY_COLUMNS,
  makeErrorResult,
  outputValue,
  VIEW_COLUMNS
} from "./metrics.js";
import {
  SELECTABLE_STAT_COLUMNS,
  SKILL_STAT_ROWS,
  STAT_GROUPS
} from "./stat-catalog.js";
import { parseUsernames } from "./utils.js";

const CONSENT_COOKIE = "bps_cookie_consent";
const CONFIG_COOKIE = "bps_output_config";
const CONFIG_VERSION = 1;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const els = {
  usernames: document.querySelector("#usernames"),
  playerCount: document.querySelector("#player-count"),
  fetchButton: document.querySelector("#fetch-button"),
  clearButton: document.querySelector("#clear-button"),
  resolveGim: document.querySelector("#resolve-gim"),
  customizeEnabled: document.querySelector("#customize-enabled"),
  customOptions: document.querySelector("#custom-options"),
  statGroups: document.querySelector("#stat-groups"),
  useSpecial: document.querySelector("#use-special"),
  progressWrap: document.querySelector("#progress-wrap"),
  progressBar: document.querySelector("#progress-bar"),
  progressText: document.querySelector("#progress-text"),
  notice: document.querySelector("#notice"),
  resultsPanel: document.querySelector("#results-panel"),
  resultSummary: document.querySelector("#result-summary"),
  table: document.querySelector("#results-table"),
  copySummary: document.querySelector("#copy-summary"),
  copyAll: document.querySelector("#copy-all"),
  downloadSummary: document.querySelector("#download-summary"),
  downloadAll: document.querySelector("#download-all"),
  cookieBanner: document.querySelector("#cookie-consent"),
  cookieAccept: document.querySelector("#cookie-accept"),
  cookieDecline: document.querySelector("#cookie-decline"),
  cookieSettings: document.querySelector("#cookie-settings")
};

const state = {
  results: [],
  running: false,
  cookieConsent: null
};

function setNotice(message = "", level = "info") {
  els.notice.hidden = !message;
  els.notice.textContent = message;
  els.notice.className = "notice" + (level === "error" ? " error" : "");
}

function updatePlayerCount() {
  const count = parseUsernames(els.usernames.value).length;
  els.playerCount.textContent = count + (count === 1 ? " player" : " players");
}

function setProgress(done, total, current = "") {
  els.progressWrap.hidden = total === 0;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  els.progressBar.style.width = percent + "%";
  els.progressText.textContent = total === 0
    ? ""
    : done + "/" + total + " complete" + (current ? " — " + current : "");
}

function makeStatCheckbox(column, text, className = "checkbox stat-option") {
  const label = document.createElement("label");
  label.className = className;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = true;
  input.dataset.statColumn = column;

  const caption = document.createElement("span");
  caption.textContent = text;

  label.append(input, caption);
  return label;
}

function renderStatOptions() {
  els.statGroups.replaceChildren();

  const skillsSection = document.createElement("section");
  skillsSection.className = "stat-group skills-group";

  const skillsHeading = document.createElement("h3");
  skillsHeading.textContent = "Skills";
  skillsSection.appendChild(skillsHeading);

  const skillOptions = document.createElement("div");
  skillOptions.className = "skill-stat-options";

  for (const skill of SKILL_STAT_ROWS) {
    const row = document.createElement("div");
    row.className = "skill-stat-row";

    const name = document.createElement("span");
    name.className = "skill-stat-name";
    name.textContent = skill.label;

    row.append(
      name,
      makeStatCheckbox(skill.levelColumn, "Level", "checkbox skill-stat-checkbox"),
      makeStatCheckbox(skill.xpColumn, "XP", "checkbox skill-stat-checkbox")
    );
    skillOptions.appendChild(row);
  }

  skillsSection.appendChild(skillOptions);
  els.statGroups.appendChild(skillsSection);

  for (const group of STAT_GROUPS) {
    const section = document.createElement("section");
    section.className = "stat-group";

    const heading = document.createElement("h3");
    heading.textContent = group.label;
    section.appendChild(heading);

    const options = document.createElement("div");
    options.className = "stat-options";

    for (const column of group.columns) {
      const displayText = group.id === "bosses"
        ? column.replace(/ KC$/, "")
        : column;
      options.appendChild(makeStatCheckbox(column, displayText));
    }

    section.appendChild(options);
    els.statGroups.appendChild(section);
  }
}

function selectedStatColumns() {
  const selected = new Set(
    Array.from(els.statGroups.querySelectorAll("input[data-stat-column]:checked"))
      .map((input) => input.dataset.statColumn)
  );

  return SELECTABLE_STAT_COLUMNS.filter((column) => selected.has(column));
}

function displayedColumns() {
  if (!els.customizeEnabled.checked) return VIEW_COLUMNS;
  return [...VIEW_COLUMNS, ...selectedStatColumns()];
}

function readCookie(name) {
  const prefix = encodeURIComponent(name) + "=";
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

function writeCookie(name, value, maxAge = COOKIE_MAX_AGE) {
  let cookie =
    encodeURIComponent(name) +
    "=" +
    encodeURIComponent(value) +
    "; Path=/; Max-Age=" +
    maxAge +
    "; SameSite=Lax";

  if (location.protocol === "https:") cookie += "; Secure";
  document.cookie = cookie;
}

function deleteCookie(name) {
  writeCookie(name, "", 0);
}

function currentPreferences() {
  const checked = new Set(
    Array.from(els.statGroups.querySelectorAll("input[data-stat-column]:checked"))
      .map((input) => input.dataset.statColumn)
  );

  return {
    v: CONFIG_VERSION,
    c: els.customizeEnabled.checked ? 1 : 0,
    s: els.useSpecial.checked ? 1 : 0,
    g: els.resolveGim.checked ? 1 : 0,
    b: SELECTABLE_STAT_COLUMNS.map((column) => checked.has(column) ? "1" : "0").join("")
  };
}

function applyPreferences(preferences) {
  if (!preferences || preferences.v !== CONFIG_VERSION) return;

  els.customizeEnabled.checked = preferences.c === 1;
  els.useSpecial.checked = preferences.s !== 0;
  els.resolveGim.checked = preferences.g !== 0;

  if (typeof preferences.b === "string") {
    const inputs = new Map(
      Array.from(els.statGroups.querySelectorAll("input[data-stat-column]"))
        .map((input) => [input.dataset.statColumn, input])
    );

    SELECTABLE_STAT_COLUMNS.forEach((column, index) => {
      const input = inputs.get(column);
      if (input && index < preferences.b.length) {
        input.checked = preferences.b[index] !== "0";
      }
    });
  }

  els.customOptions.hidden = !els.customizeEnabled.checked;
}

function persistPreferences() {
  if (state.cookieConsent !== "accepted") return;
  writeCookie(CONFIG_COOKIE, JSON.stringify(currentPreferences()));
}

function loadCookiePreferences() {
  state.cookieConsent = readCookie(CONSENT_COOKIE);

  if (state.cookieConsent === "accepted") {
    const saved = readCookie(CONFIG_COOKIE);
    if (saved) {
      try {
        applyPreferences(JSON.parse(saved));
      } catch (_error) {
        deleteCookie(CONFIG_COOKIE);
      }
    }
  }

  els.cookieBanner.hidden = state.cookieConsent === "accepted" || state.cookieConsent === "declined";
}

function acceptCookies() {
  state.cookieConsent = "accepted";
  writeCookie(CONSENT_COOKIE, "accepted");
  persistPreferences();
  els.cookieBanner.hidden = true;
}

function declineCookies() {
  state.cookieConsent = "declined";
  writeCookie(CONSENT_COOKIE, "declined");
  deleteCookie(CONFIG_COOKIE);
  els.cookieBanner.hidden = true;
}

async function lookupPlayer(username) {
  let hiscoreError;

  try {
    const hiscore = await fetchHiscore(username, "normal");
    const classification = await classifyFromHiscores(
      username,
      hiscore,
      els.resolveGim.checked
    );

    return computeHiscoreResult(username, hiscore, classification);
  } catch (error) {
    hiscoreError = error;
  }

  try {
    const fallback = await fetchTempleFallback(username);
    return computeTempleResult(username, fallback);
  } catch (templeError) {
    const hiscoreMessage = hiscoreError instanceof Error ? hiscoreError.message : String(hiscoreError);
    const templeMessage = templeError instanceof Error ? templeError.message : String(templeError);
    return makeErrorResult(
      username,
      new Error("HiScores: " + hiscoreMessage + ". TempleOSRS: " + templeMessage + ".")
    );
  }
}

async function runPool(items, concurrency, worker, onDone) {
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;

      const value = await worker(items[index], index);
      onDone(value, index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );

  await Promise.all(workers);
}

function rowValue(result, column) {
  return outputValue(result, column, els.useSpecial.checked);
}

function renderTable() {
  const columns = displayedColumns();
  const thead = els.table.querySelector("thead");
  const tbody = els.table.querySelector("tbody");

  thead.replaceChildren();
  tbody.replaceChildren();

  const headRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = column;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  for (const result of state.results) {
    if (!result) continue;

    const tr = document.createElement("tr");
    columns.forEach((column) => {
      const td = document.createElement("td");
      const value = rowValue(result, column);
      td.textContent = value === null || value === undefined ? "" : String(value);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  const completed = state.results.filter(Boolean);
  const errors = completed.filter((result) => result.statusLevel === "error").length;
  const temple = completed.filter((result) => result.source === "TempleOSRS").length;

  els.resultSummary.textContent =
    completed.length +
    " player" +
    (completed.length === 1 ? "" : "s") +
    " · " +
    temple +
    " Temple fallback" +
    (temple === 1 ? "" : "s") +
    " · " +
    errors +
    " error" +
    (errors === 1 ? "" : "s");
}

function rowsForColumns(columns) {
  return [
    columns,
    ...state.results
      .filter(Boolean)
      .map((result) => columns.map((column) => rowValue(result, column)))
  ];
}

function quoteCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function toCsv(rows) {
  return rows.map((row) => row.map(quoteCsv).join(",")).join("\r\n");
}

function toTsv(rows) {
  return rows
    .map((row) =>
      row.map((value) =>
        (value === null || value === undefined ? "" : String(value))
          .replace(/\t/g, " ")
          .replace(/\r?\n/g, " ")
      ).join("\t")
    )
    .join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (_error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function downloadText(filename, text, type) {
  const blob = new Blob(["\ufeff", text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function timestampFilename(base) {
  const date = new Date().toISOString().slice(0, 10);
  return base + "-" + date + ".csv";
}

async function handleFetch() {
  if (state.running) return;

  const usernames = parseUsernames(els.usernames.value);
  if (usernames.length === 0) {
    setNotice("Paste at least one RuneScape username first.", "error");
    return;
  }

  state.running = true;
  state.results = new Array(usernames.length);
  els.fetchButton.disabled = true;
  els.clearButton.disabled = true;
  els.resolveGim.disabled = true;
  els.resultsPanel.hidden = false;
  setNotice("");
  setProgress(0, usernames.length, "starting");
  renderTable();

  let completed = 0;

  try {
    await runPool(
      usernames,
      2,
      async (username) => {
        setProgress(completed, usernames.length, username);
        return lookupPlayer(username);
      },
      (result, index) => {
        state.results[index] = result;
        completed += 1;
        setProgress(completed, usernames.length, result.summary.Username || usernames[index]);
        renderTable();
      }
    );

    const errors = state.results.filter((result) => result.statusLevel === "error").length;
    if (errors > 0) {
      setNotice(
        errors +
          " player" +
          (errors === 1 ? "" : "s") +
          " could not be loaded; their stat cells are blank.",
        "error"
      );
    }
  } finally {
    state.running = false;
    els.fetchButton.disabled = false;
    els.clearButton.disabled = false;
    els.resolveGim.disabled = false;
  }
}

function handlePreferenceChange() {
  els.customOptions.hidden = !els.customizeEnabled.checked;
  persistPreferences();
  renderTable();
}

renderStatOptions();
loadCookiePreferences();
updatePlayerCount();

els.usernames.addEventListener("input", updatePlayerCount);
els.fetchButton.addEventListener("click", handleFetch);
els.clearButton.addEventListener("click", () => {
  if (state.running) return;
  els.usernames.value = "";
  state.results = [];
  els.resultsPanel.hidden = true;
  els.progressWrap.hidden = true;
  setNotice("");
  updatePlayerCount();
});

els.customizeEnabled.addEventListener("change", handlePreferenceChange);
els.useSpecial.addEventListener("change", handlePreferenceChange);
els.resolveGim.addEventListener("change", persistPreferences);
els.statGroups.addEventListener("change", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.dataset.statColumn) {
    persistPreferences();
    renderTable();
  }
});

els.copySummary.addEventListener("click", async () => {
  await copyText(toTsv(rowsForColumns(EXPORT_SUMMARY_COLUMNS)));
  setNotice("Summary copied as tab-separated values.");
});

els.copyAll.addEventListener("click", async () => {
  const columns = displayedColumns();
  await copyText(toTsv(rowsForColumns(columns)));
  setNotice("Configured output copied as tab-separated values.");
});

els.downloadSummary.addEventListener("click", () => {
  downloadText(
    timestampFilename("bingo-player-stats-summary"),
    toCsv(rowsForColumns(EXPORT_SUMMARY_COLUMNS)),
    "text/csv;charset=utf-8"
  );
});

els.downloadAll.addEventListener("click", () => {
  const columns = displayedColumns();
  downloadText(
    timestampFilename("bingo-player-stats-configured"),
    toCsv(rowsForColumns(columns)),
    "text/csv;charset=utf-8"
  );
});

els.cookieAccept.addEventListener("click", acceptCookies);
els.cookieDecline.addEventListener("click", declineCookies);
els.cookieSettings.addEventListener("click", () => {
  els.cookieBanner.hidden = false;
});
