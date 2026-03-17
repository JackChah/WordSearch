# WordSearch — Site-Wide Text Finder

A free Chrome extension that scans every page of a website and finds exactly where a word or phrase appears. Built as a practical alternative to Screaming Frog for copy audits, brand updates, and content migrations.

---

## What it does

Paste a URL, type a search term, hit Search. WordSearch discovers every page on the site (via sitemap or navigation links), fetches each one, and shows you every page where your term appears — with highlighted context snippets and direct links.

**Typical use cases:**
- A client spotted an old brand name somewhere on their site — find every instance
- Verify a word has been fully removed after a copy update
- Audit a site for outdated terms before or after a migration

---

## Features

- **Three match modes** — Case-insensitive (whole word), Exact (case-sensitive), Partial (matches inside words)
- **Two scan modes** — Full site via sitemap, or Main pages only via nav/header links
- **Live progress bar** with page count and Cancel button
- **Highlighted snippets** showing context around each match
- **Google Sheets export** — creates a new titled sheet and populates it instantly via the Sheets API
- **CSV export** as a fallback
- **"Use current tab" toggle** — auto-fills the URL field from your active browser tab
- **Results persist** in the sidebar as you browse — no need to re-run
- No account required · No data sent to any server · Everything runs locally

---

## Installation

### Load unpacked (development)
1. Clone or download this repository
2. Open Chrome → go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `WordSearch` folder
5. Click the extension icon in the toolbar to open the side panel

### Chrome Web Store
*(Coming soon)*

---

## Google Sheets Integration Setup

The "Open in Sheets" button uses the Google Sheets API to create and populate a sheet directly. A one-time setup is required:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project
2. Enable the **Google Sheets API**
3. Create an **OAuth 2.0 Client ID** (application type: Chrome Extension)
4. Paste your Client ID into `manifest.json` under `oauth2.client_id`
5. Reload the extension

On first use you'll be prompted to sign in with Google — after that it's one click.

---

## How it works

- **Page discovery** — Tries `sitemap.xml`, `sitemap_index.xml`, and WordPress variants first. Falls back to scraping `<nav>` and `<header>` links if no sitemap is found.
- **Crawling** — Fetches pages 4 at a time via the background service worker. All processing is local.
- **Text extraction** — Strips `<script>`, `<style>`, and all HTML tags via regex to get clean visible text.
- **Search** — Regex-based matching with configurable word boundary rules.
- **Persistence** — Results stored in `chrome.storage.session` so they survive page navigation.

Built with **Manifest V3**, long-lived port connections to keep the service worker alive during large crawls.

---

## Privacy

No data is collected, stored externally, or transmitted to any server controlled by this extension. See the full [Privacy Policy](https://jackchah.github.io/WordSearch-Privacy/privacy.html).

---

## Contact

Jalywebops@gmail.com
