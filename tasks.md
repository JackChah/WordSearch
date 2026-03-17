# WordSearch Extension — Agent Task List

## Phase 1: Project Scaffold

- [x] Create manifest.json with Manifest V3, service worker registration,
      sidePanel permission, and broad host permissions
- [x] Register the side panel to open when the extension icon is clicked
- [x] Create sidepanel.html with: URL input, search term input, match type
      selector (exact / case-insensitive / partial), Search button,
      progress indicator, scrollable results list, and CSV export button
      (hidden by default)
- [x] Create style.css with clean minimal styles (white bg, sans-serif,
      subtle borders, highlight style for matched terms in snippets,
      full-height sidebar layout)
- [x] Create sidepanel.js with UI logic wired to all elements in sidepanel.html
- [x] Create background.js registered as a service worker

## Phase 2: Page Discovery

- [x] Implement sitemap.xml fetch in background.js
- [x] If sitemap returns 404 or fails, trigger nav fallback — do not stop
- [x] Parse all <loc> URLs from a valid sitemap XML response
- [x] Implement recursive sitemap index handling (nested sitemaps)
- [x] Implement fallback: fetch homepage HTML, extract all <a href> links
      inside <nav> or <header> tags only
- [x] Deduplicate and validate final URL list before searching

## Phase 3: Search Logic

- [x] For each URL, fetch full page HTML via background.js
- [x] Strip all HTML tags to extract visible text content only
- [x] Extract page title from <title> tag before stripping HTML
- [x] Implement exact match search against visible text
- [x] Implement case-insensitive match search
- [x] Implement partial word match (e.g. "run" matches "running")
- [x] For each match: record page title, URL, total match count,
      and up to 3 snippets (~60 chars of surrounding context each)

## Phase 4: Results Display & Export

- [x] Show progress indicator during crawl: "Checking X of Y pages..."
- [x] Render each matching page with: bold title, clickable URL,
      match count, and up to 3 highlighted snippets
- [x] Highlight the matched term inside each snippet
- [x] Show "No matches found" message if zero results
- [x] Reveal CSV export button only after results finish loading
- [x] CSV export includes columns: Page Title, URL, Match Count, First Snippet
- [x] Persist results in sidebar when user navigates to a new page
- [x] Clear previous results and reset progress when a new search starts
