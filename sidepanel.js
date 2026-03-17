// ─── Element refs ─────────────────────────────────────────────────────────────
const urlInput       = document.getElementById("url-input");
const termInput      = document.getElementById("term-input");
const matchTypeEl    = document.getElementById("match-type");
const scanModeEl     = document.getElementById("scan-mode");
const scanModeHint   = document.getElementById("scan-mode-hint");
const searchBtn      = document.getElementById("search-btn");
const progressSection = document.getElementById("progress-section");
const progressBar    = document.getElementById("progress-bar");
const progressText   = document.getElementById("progress-text");
const resultsSection = document.getElementById("results-section");
const resultsSummary = document.getElementById("results-summary");
const resultsList    = document.getElementById("results-list");
const cancelBtn      = document.getElementById("cancel-btn");
const useCurrentTab  = document.getElementById("use-current-tab");
const clearBtn       = document.getElementById("clear-btn");
const exportActions  = document.getElementById("export-actions");
const sheetsBtn      = document.getElementById("sheets-btn");
const exportBtn      = document.getElementById("export-btn");
const emptyState     = document.getElementById("empty-state");
const errorState     = document.getElementById("error-state");
const errorMessage   = document.getElementById("error-message");

// ─── State ────────────────────────────────────────────────────────────────────
let currentResults = [];
let lastTerm = "";
let lastDomain = "";
let port = null; // persistent connection keeps the MV3 service worker alive

// ─── Restore persisted results on open ───────────────────────────────────────
chrome.storage.session.get(["results", "term", "url", "matchType", "scanMode", "domain"], (stored) => {
  if (stored.results?.length) {
    urlInput.value = stored.url || "";
    termInput.value = stored.term || "";
    matchTypeEl.value = stored.matchType || "case-insensitive";
    scanModeEl.value = stored.scanMode || "sitemap";
    scanModeHint.textContent = SCAN_HINTS[scanModeEl.value];
    lastTerm = stored.term || "";
    lastDomain = stored.domain || "";
    currentResults = stored.results;
    renderResults(stored.results, stored.term);
  }
});

// ─── "Use current tab" toggle ─────────────────────────────────────────────────
useCurrentTab.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) return;
    try {
      const u = new URL(tab.url);
      urlInput.value = u.origin + "/";
    } catch (_) {}
  });
});

// ─── Scan mode hint ───────────────────────────────────────────────────────────
const SCAN_HINTS = {
  sitemap: "Uses sitemap.xml to find all pages on the site.",
  nav:     "Only scans pages linked from the main navigation — typically 5–20 pages.",
};
scanModeEl.addEventListener("change", () => {
  scanModeHint.textContent = SCAN_HINTS[scanModeEl.value];
});

// ─── Search button ────────────────────────────────────────────────────────────
searchBtn.addEventListener("click", startSearch);
termInput.addEventListener("keydown", (e) => { if (e.key === "Enter") startSearch(); });

function startSearch() {
  const rawUrl = urlInput.value.trim();
  const term   = termInput.value.trim();

  if (!rawUrl || !term) {
    showError("Please enter both a URL and a search term.");
    return;
  }

  let rootUrl;
  try {
    rootUrl = new URL(rawUrl.startsWith("http") ? rawUrl : "https://" + rawUrl).href;
  } catch (_) {
    showError("Please enter a valid URL (e.g. https://example.com).");
    return;
  }

  const matchType = matchTypeEl.value;
  const scanMode  = scanModeEl.value;
  lastTerm = term;
  lastDomain = new URL(rootUrl).hostname.replace(/^www\./, "");
  currentResults = [];

  // Reset UI for new search
  resetUI();
  show(progressSection);
  searchBtn.disabled = true;
  searchBtn.textContent = "Searching…";

  // Open (or reopen) a persistent port so the service worker stays alive
  // for the full crawl — a one-shot sendMessage lets Chrome kill the worker.
  if (port) { try { port.disconnect(); } catch (_) {} }
  port = chrome.runtime.connect({ name: "wordsearch" });

  port.onMessage.addListener((msg) => {
    switch (msg.type) {
      case "PROGRESS": handleProgress(msg.payload); break;
      case "RESULTS":  handleResults(msg.payload);  break;
      case "ERROR":    handleError(msg.payload);    break;
    }
  });

  port.onDisconnect.addListener(() => { port = null; });

  port.postMessage({ type: "START_SEARCH", payload: { rootUrl, term, matchType, scanMode } });
}

// ─── Clear button ─────────────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  urlInput.value = "";
  termInput.value = "";
  resetUI();
});

// ─── Cancel button ────────────────────────────────────────────────────────────
cancelBtn.addEventListener("click", () => {
  if (port) { try { port.disconnect(); } catch (_) {} port = null; }
  searchBtn.disabled = false;
  searchBtn.textContent = "Search";
  hide(progressSection);
  // Show whatever partial results arrived before cancel
  if (currentResults.length) {
    renderResults(currentResults, lastTerm);
  }
});

function handleProgress({ message, checked, total }) {
  progressText.textContent = message;
  if (total > 0) {
    progressBar.style.width = `${Math.round((checked / total) * 100)}%`;
  } else {
    // Indeterminate — pulse to ~50%
    progressBar.style.width = "40%";
  }
}

function handleResults(results) {
  searchBtn.disabled = false;
  searchBtn.textContent = "Search";
  hide(progressSection);

  currentResults = results;
  persistResults();
  renderResults(results, lastTerm);
}

function handleError(message) {
  searchBtn.disabled = false;
  searchBtn.textContent = "Search";
  hide(progressSection);
  showError(message);
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function renderResults(results, term) {
  resultsList.innerHTML = "";

  if (!results.length) {
    show(emptyState);
    return;
  }

  const total = results.reduce((sum, r) => sum + r.count, 0);
  resultsSummary.textContent = `${results.length} page${results.length !== 1 ? "s" : ""} · ${total} match${total !== 1 ? "es" : ""}`;

  results.forEach((r) => {
    const card = document.createElement("div");
    card.className = "result-card";

    const title = document.createElement("div");
    title.className = "result-title";
    title.title = r.title;
    title.textContent = r.title;

    const link = document.createElement("a");
    link.className = "result-url";
    link.href = r.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = r.url;
    link.title = r.url;

    const count = document.createElement("span");
    count.className = "result-count";
    count.textContent = `${r.count} match${r.count !== 1 ? "es" : ""}`;

    const snippetsWrap = document.createElement("div");
    snippetsWrap.className = "result-snippets";

    r.snippets.forEach((text) => {
      const s = document.createElement("div");
      s.className = "snippet";
      s.innerHTML = highlightTerm(escapeHtml(text), escapeHtml(term));
      snippetsWrap.appendChild(s);
    });

    card.appendChild(title);
    card.appendChild(link);
    card.appendChild(count);
    card.appendChild(snippetsWrap);
    resultsList.appendChild(card);
  });

  show(resultsSection);
  show(clearBtn);
  show(exportActions);
}

// ─── Highlight matched term in snippet text ───────────────────────────────────
function highlightTerm(escapedText, escapedTerm) {
  // Re-escape the term for use in regex, then wrap matches in <mark>
  const pattern = new RegExp(escapeRegex(escapedTerm), "gi");
  return escapedText.replace(pattern, (m) => `<mark>${m}</mark>`);
}

// ─── Open in Google Sheets (Sheets API) ──────────────────────────────────────
sheetsBtn.addEventListener("click", async () => {
  if (!currentResults.length) return;

  sheetsBtn.disabled = true;
  sheetsBtn.textContent = "Creating sheet…";

  try {
    const token = await getGoogleToken();
    const title = `${lastDomain} — WordSearch`;
    const spreadsheetId = await createSpreadsheet(token, title);
    await populateSpreadsheet(token, spreadsheetId, currentResults);
    chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` });
  } catch (e) {
    showError(`Sheets export failed: ${e.message}`);
  } finally {
    sheetsBtn.disabled = false;
    sheetsBtn.textContent = "Open in Sheets";
  }
});

function getGoogleToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

async function createSpreadsheet(token, title) {
  const resp = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { title } }),
  });
  if (!resp.ok) throw new Error(`Could not create sheet (${resp.status})`);
  const data = await resp.json();
  return data.spreadsheetId;
}

async function populateSpreadsheet(token, spreadsheetId, results) {
  const headers = ["Page Title", "URL", "Match Count", "First Snippet"];
  const rows = results.map((r) => [
    r.title,
    r.url,
    r.count,
    r.snippets[0] || "",
  ]);
  const values = [headers, ...rows];

  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );
  if (!resp.ok) throw new Error(`Could not populate sheet (${resp.status})`);
}

// ─── CSV export ───────────────────────────────────────────────────────────────
exportBtn.addEventListener("click", () => {
  if (!currentResults.length) return;

  const headers = ["Page Title", "URL", "Match Count", "First Snippet"];
  const rows = currentResults.map((r) => [
    csvCell(r.title),
    csvCell(r.url),
    r.count,
    csvCell(r.snippets[0] || ""),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(lastDomain)}-wordsearch.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

function csvCell(val) {
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9]/gi, "-").slice(0, 40).toLowerCase();
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function persistResults() {
  chrome.storage.session.set({
    results: currentResults,
    term: lastTerm,
    domain: lastDomain,
    url: urlInput.value.trim(),
    matchType: matchTypeEl.value,
    scanMode: scanModeEl.value,
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function resetUI() {
  hide(resultsSection);
  hide(clearBtn);
  hide(exportActions);
  hide(emptyState);
  hide(errorState);
  resultsList.innerHTML = "";
  progressBar.style.width = "0%";
  progressText.textContent = "Starting…";

  // Clear persisted results so navigating away doesn't show stale data
  chrome.storage.session.remove(["results", "term", "url", "matchType"]);
}

function showError(msg) {
  errorMessage.textContent = msg;
  show(errorState);
}

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
