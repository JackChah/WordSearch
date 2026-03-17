# WordSearch Extension — Agent Task List

## Phase 1: Project Scaffold

- Create manifest.json with Manifest V3, service worker registration,
sidePanel permission, and broad host permissions
- Register the side panel to open when the extension icon is clicked
- Create sidepanel.html with: URL input, search term input, match type
selector (exact / case-insensitive / partial), Search button,
progress indicator, scrollable results list, and CSV export button
(hidden by default)
- Create style.css with clean minimal styles (white bg, sans-serif,
subtle borders, highlight style for matched terms in snippets,
full-height sidebar layout)
- Create sidepanel.js with UI logic wired to all elements in sidepanel.html
- Create background.js registered as a service worker

## Phase 2: Page Discovery

- Implement sitemap.xml fetch in background.js
- If sitemap returns 404 or fails, trigger nav fallback — do not stop
- Parse all  URLs from a valid sitemap XML response
- Implement recursive sitemap index handling (nested sitemaps)
- Implement fallback: fetch homepage HTML, extract all  links
inside  or  tags only
- Deduplicate and validate final URL list before searching

## Phase 3: Search Logic

- For each URL, fetch full page HTML via background.js
- Strip all HTML tags to extract visible text content only
- Extract page title from  tag before stripping HTML
- Implement exact match search against visible text
- Implement case-insensitive match search
- Implement partial word match (e.g. "run" matches "running")
- For each match: record page title, URL, total match count,
and up to 3 snippets (~60 chars of surrounding context each)

## Phase 4: Results Display & Export

- Show progress indicator during crawl: "Checking X of Y pages..."
- Render each matching page with: bold title, clickable URL,
match count, and up to 3 highlighted snippets
- Highlight the matched term inside each snippet
- Show "No matches found" message if zero results
- Reveal CSV export button only after results finish loading
- CSV export includes columns: Page Title, URL, Match Count, First Snippet
- Persist results in sidebar when user navigates to a new page
- Clear previous results and reset progress when a new search starts

