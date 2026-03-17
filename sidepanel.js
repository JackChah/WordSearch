// ─── Element refs ─────────────────────────────────────────────────────────────
const urlInput       = document.getElementById("url-input");
const termInput      = document.getElementById("term-input");
const matchTypeEl    = document.getElementById("match-type");
const searchBtn      = document.getElementById("search-btn");
const progressSection = document.getElementById("progress-section");
const progressBar    = document.getElementById("progress-bar");
const progressText   = document.getElementById("progress-text");
const resultsSection = document.getElementById("results-section");
const resultsSummary = document.getElementById("results-summary");
const resultsList    = document.getElementById("results-list");
const exportActions  = document.getElementById("export-actions");
const sheetsBtn      = document.getElementById("sheets-btn");
const sheetsToast    = document.getElementById("sheets-toast");
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
chrome.storage.session.get(["results", "term", "url", "matchType", "domain"], (stored) => {
  if (stored.results?.length) {
    urlInput.value = stored.url || "";
    termInput.value = stored.term || "";
    matchTypeEl.value = stored.matchType || "case-insensitive";
    lastTerm = stored.term || "";
    lastDomain = stored.domain || "";
    currentResults = stored.results;
    renderResults(stored.results, stored.term);
  }
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

  port.postMessage({ type: "START_SEARCH", payload: { rootUrl, term, matchType } });
}

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
  show(exportActions);
}

// ─── Highlight matched term in snippet text ───────────────────────────────────
function highlightTerm(escapedText, escapedTerm) {
  // Re-escape the term for use in regex, then wrap matches in <mark>
  const pattern = new RegExp(escapeRegex(escapedTerm), "gi");
  return escapedText.replace(pattern, (m) => `<mark>${m}</mark>`);
}

// ─── Open in Google Sheets ────────────────────────────────────────────────────
// Copies TSV to clipboard (pastes perfectly into Sheets) and opens a new Sheet.
sheetsBtn.addEventListener("click", async () => {
  if (!currentResults.length) return;

  const headers = ["Page Title", "URL", "Match Count", "First Snippet"];
  const rows = currentResults.map((r) => [
    r.title,
    r.url,
    r.count,
    r.snippets[0] || "",
  ]);

  const tsv = [headers, ...rows]
    .map((row) => row.map((cell) => String(cell).replace(/\t/g, " ").replace(/\n/g, " ")).join("\t"))
    .join("\n");

  try {
    await navigator.clipboard.writeText(tsv);
  } catch (_) {
    // Fallback for any clipboard permission edge cases
    const ta = document.createElement("textarea");
    ta.value = tsv;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  // Open a new Sheet pre-titled with the domain name
  const sheetTitle = encodeURIComponent(`${lastDomain} — WordSearch`);
  chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/create?title=${sheetTitle}` });

  // Show paste reminder
  show(sheetsToast);
  setTimeout(() => hide(sheetsToast), 6000);
});

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
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function resetUI() {
  hide(resultsSection);
  hide(exportActions);
  hide(sheetsToast);
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
