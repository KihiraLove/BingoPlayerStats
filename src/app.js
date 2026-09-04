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
  rawColumnOrder,
  VIEW_COLUMNS
} from "./metrics.js";
import { parseUsernames } from "./utils.js";

const els = {
  usernames: document.querySelector("#usernames"),
  playerCount: document.querySelector("#player-count"),
  fetchButton: document.querySelector("#fetch-button"),
  clearButton: document.querySelector("#clear-button"),
  resolveGim: document.querySelector("#resolve-gim"),
  progressWrap: document.querySelector("#progress-wrap"),
  progressBar: document.querySelector("#progress-bar"),
  progressText: document.querySelector("#progress-text"),
  notice: document.querySelector("#notice"),
  resultsPanel: document.querySelector("#results-panel"),
  resultSummary: document.querySelector("#result-summary"),
  showRaw: document.querySelector("#show-raw"),
  table: document.querySelector("#results-table"),
  copySummary: document.querySelector("#copy-summary"),
  copyAll: document.querySelector("#copy-all"),
  downloadSummary: document.querySelector("#download-summary"),
  downloadAll: document.querySelector("#download-all")
};

const state = {
  results: [],
  running: false
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
  if (Object.prototype.hasOwnProperty.call(result.summary, column)) {
    return result.summary[column];
  }
  return result.raw?.[column] ?? "";
}

function displayedColumns() {
  if (!els.showRaw.checked) return VIEW_COLUMNS;
  return [...VIEW_COLUMNS, ...rawColumnOrder(state.results)];
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
    if (column === "Status") th.classList.add("status-column");
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

      if (column === "Status") {
        td.classList.add("status-cell", "status-" + result.statusLevel);
      }

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  const completed = state.results.filter(Boolean);
  const errors = completed.filter((result) => result.statusLevel === "error").length;
  const temple = completed.filter((result) => result.summary.Source === "TempleOSRS").length;

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
        errors + " player" + (errors === 1 ? "" : "s") + " could not be loaded. See the Status column.",
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
els.showRaw.addEventListener("change", renderTable);

els.copySummary.addEventListener("click", async () => {
  await copyText(toTsv(rowsForColumns(EXPORT_SUMMARY_COLUMNS)));
  setNotice("Summary copied as tab-separated values.");
});

els.copyAll.addEventListener("click", async () => {
  const columns = [...VIEW_COLUMNS, ...rawColumnOrder(state.results)];
  await copyText(toTsv(rowsForColumns(columns)));
  setNotice("Full table copied as tab-separated values.");
});

els.downloadSummary.addEventListener("click", () => {
  downloadText(
    timestampFilename("bingo-player-stats-summary"),
    toCsv(rowsForColumns(EXPORT_SUMMARY_COLUMNS)),
    "text/csv;charset=utf-8"
  );
});

els.downloadAll.addEventListener("click", () => {
  const columns = [...VIEW_COLUMNS, ...rawColumnOrder(state.results)];
  downloadText(
    timestampFilename("bingo-player-stats-full"),
    toCsv(rowsForColumns(columns)),
    "text/csv;charset=utf-8"
  );
});

updatePlayerCount();
