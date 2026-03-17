// Open the side panel whenever the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ─── Long-lived port connection ───────────────────────────────────────────────
// Using a persistent port keeps the MV3 service worker alive for the full crawl.
// A one-shot sendMessage allows Chrome to terminate the worker mid-search.
let activePort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "wordsearch") return;
  activePort = port;

  port.onMessage.addListener((msg) => {
    if (msg.type === "START_SEARCH") {
      runSearch(msg.payload).catch((e) => postError(e.message));
    }
  });

  port.onDisconnect.addListener(() => {
    activePort = null;
  });
});

// ─── Orchestrator ─────────────────────────────────────────────────────────────
async function runSearch({ rootUrl, term, matchType }) {
  postStatus("Discovering pages…", 0, 0);

  let urls;
  try {
    urls = await discoverUrls(rootUrl);
  } catch (e) {
    postError(`Page discovery failed: ${e.message}`);
    return;
  }

  // Always search at least the root URL even if discovery finds nothing
  if (!urls.length) urls = [rootUrl];

  const results = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((url) => searchPage(url, term, matchType))
    );
    batchResults.forEach((r) => { if (r) results.push(r); });
    postStatus(`Checked ${Math.min(i + CONCURRENCY, urls.length)} of ${urls.length} pages…`, i + CONCURRENCY, urls.length);
  }

  postResults(results);
}

// ─── Page discovery ──────────────────────────────────────────────────────────

async function discoverUrls(rootUrl) {
  const origin = new URL(rootUrl).origin;
  const sitemapUrls = await trySitemap(origin);
  if (sitemapUrls) return sitemapUrls;

  // Fallback: scrape nav/header links from the homepage
  return await navFallback(rootUrl, origin);
}

async function trySitemap(origin) {
  // Cover sitemap locations used by WordPress, Yoast, standard installs, etc.
  const paths = [
    "/sitemap_index.xml",
    "/sitemap.xml",
    "/wp-sitemap.xml",
    "/sitemap-index.xml",
    "/page-sitemap.xml",
  ];
  for (const path of paths) {
    try {
      const resp = await fetchWithTimeout(`${origin}${path}`, 8000);
      if (!resp.ok) continue;
      const xml = await resp.text();
      if (!xml.includes("<loc>")) continue;
      const urls = await parseSitemap(xml, origin);
      if (urls.length) return urls;
    } catch (_) {
      // try next
    }
  }
  return null;
}

async function parseSitemap(xml, origin) {
  // Use regex extraction instead of DOMParser to avoid MV3 service worker quirks.

  // Sitemap index: contains <sitemap><loc>...</loc></sitemap>
  const sitemapLocs = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>([\s\S]*?)<\/loc>/gi)]
    .map((m) => m[1].trim());

  if (sitemapLocs.length) {
    const nested = await Promise.all(
      sitemapLocs.map(async (childUrl) => {
        try {
          const resp = await fetchWithTimeout(childUrl, 8000);
          if (!resp.ok) return [];
          const childXml = await resp.text();
          return parseSitemap(childXml, origin);
        } catch (_) {
          return [];
        }
      })
    );
    return dedup(nested.flat(), origin);
  }

  // Regular sitemap: <url><loc>...</loc></url>
  const urlLocs = [...xml.matchAll(/<url>[\s\S]*?<loc>([\s\S]*?)<\/loc>/gi)]
    .map((m) => m[1].trim());

  // Some sitemaps just have bare <loc> tags — catch those too
  const bareLocs = urlLocs.length
    ? urlLocs
    : [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => m[1].trim());

  return dedup(bareLocs, origin);
}

async function navFallback(rootUrl, origin) {
  try {
    const resp = await fetchWithTimeout(rootUrl, 8000);
    if (!resp.ok) return [rootUrl];
    const html = await resp.text();

    // Extract href values from <nav> and <header> sections using regex,
    // avoiding DOMParser which is unreliable in MV3 service workers.
    const navSections = [...html.matchAll(/<(?:nav|header)[\s\S]*?<\/(?:nav|header)>/gi)]
      .map((m) => m[0]);

    const raw = navSections.length ? navSections.join(" ") : html;
    const hrefs = [...raw.matchAll(/href=["']([^"'#?][^"']*?)["']/gi)]
      .map((m) => m[1].trim());

    const links = hrefs
      .map((href) => {
        try { return new URL(href, rootUrl).href; } catch (_) { return null; }
      })
      .filter(Boolean);

    return dedup([rootUrl, ...links], origin);
  } catch (_) {
    return [rootUrl];
  }
}

function dedup(urls, origin) {
  const seen = new Set();
  const valid = [];
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      // Same origin only; skip anchors, mailto, tel, etc.
      if (u.origin !== origin) continue;
      const clean = u.origin + u.pathname + u.search;
      if (seen.has(clean)) continue;
      seen.add(clean);
      valid.push(clean);
    } catch (_) {
      // malformed URL — skip
    }
  }
  return valid;
}

// ─── Per-page search ──────────────────────────────────────────────────────────

async function searchPage(url, term, matchType) {
  try {
    const resp = await fetchWithTimeout(url, 10000);
    if (!resp.ok) return null;
    const html = await resp.text();
    const { title, text } = extractText(html);
    const matches = findMatches(text, term, matchType);
    if (!matches.count) return null;
    return { url, title, count: matches.count, snippets: matches.snippets };
  } catch (_) {
    return null;
  }
}

function extractText(html) {
  // DOMParser is unreliable inside MV3 service workers (body can be null,
  // textContent empty). Regex stripping is simpler and works everywhere.

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "(No title)";

  const text = html
    // Drop content that is never visible to users
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Strip all remaining tags
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { title, text: decodeEntities(text) };
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function findMatches(text, term, matchType) {
  let regex;
  switch (matchType) {
    case "exact":
      regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "g");
      break;
    case "partial":
      regex = new RegExp(escapeRegex(term), "gi");
      break;
    case "case-insensitive":
    default:
      regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
      break;
  }

  const allMatches = [...text.matchAll(regex)];
  const count = allMatches.length;
  if (!count) return { count: 0, snippets: [] };

  // Up to 3 snippets with ~60 chars of surrounding context
  const snippets = allMatches.slice(0, 3).map(({ index }) => {
    const start = Math.max(0, index - 60);
    const end = Math.min(text.length, index + term.length + 60);
    let snippet = text.slice(start, end).trim();
    if (start > 0) snippet = "…" + snippet;
    if (end < text.length) snippet = snippet + "…";
    return snippet;
  });

  return { count, snippets };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── Messaging to side panel (via persistent port) ────────────────────────────

function postStatus(message, checked, total) {
  try { activePort?.postMessage({ type: "PROGRESS", payload: { message, checked, total } }); } catch (_) {}
}

function postResults(results) {
  try { activePort?.postMessage({ type: "RESULTS", payload: results }); } catch (_) {}
}

function postError(message) {
  try { activePort?.postMessage({ type: "ERROR", payload: message }); } catch (_) {}
}
