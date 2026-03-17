# Chrome Web Store — Submission Prep

## Status: Ready to submit (pending steps below)

---

## Assets Checklist

| Asset | Status | File |
|---|---|---|
| Icon 16×16 | ✅ Ready | `icons/icon16.png` |
| Icon 48×48 | ✅ Ready | `icons/icon48.png` |
| Icon 128×128 | ✅ Ready | `icons/icon128.png` |
| Promo tile 440×280 | ✅ Ready | `icons/promo_440x280.png` |
| Privacy policy | ✅ Written | `privacy.html` — needs hosting |
| Screenshots | ⬜ Needed | At least 1 at 1280×800 or 640×400 |

---

## Pending Steps

### 1. Host the privacy policy
Upload `privacy.html` to any public URL, e.g.:
- GitHub Pages: `https://yourusername.github.io/wordsearch/privacy`
- Your own site: `https://yoursite.com/wordsearch-privacy`

### 2. Take a screenshot
With the extension open and showing results, take a screenshot.
Recommended size: **1280×800**. Chrome's built-in screenshot:
- Open DevTools in the side panel → Ctrl+Shift+P → "Capture screenshot"

### 3. Create a developer account
One-time $5 fee: https://chrome.google.com/webstore/devconsole

### 4. Submit
Go to Developer Dashboard → Add new item → Upload the extension folder as a ZIP.

---

## Store Listing Copy

**Name:** WordSearch — Site-Wide Text Finder

**Short description (132 chars max):**
Find any word or phrase across every page of a website. Free alternative to Screaming Frog for copy audits and brand updates.

**Detailed description:**
WordSearch scans an entire website and finds every page where a specific word or phrase appears — perfect for:

• Tracking down old brand names or outdated copy
• Verifying a word has been removed from a site after an update
• Auditing a client's website before or after a migration

Just paste a URL, type your search term, and hit Search. The extension discovers pages via sitemap or navigation links, checks each one, and shows you exactly where the term appears with context snippets.

**Features:**
- Whole-word, case-insensitive, and partial match modes
- Progress bar with live page count
- Results with highlighted snippets and direct links
- One-click export to Google Sheets or CSV
- Results persist while you browse — no need to re-run

No account required. No data sent anywhere. Everything runs locally in your browser.

**Category:** Productivity

**Language:** English

---

## Permissions Justification (for review form)

**host_permissions `<all_urls>`:**
The user enters the website URL they want to scan. The extension must be able to fetch pages from any domain the user specifies — it has no way of knowing in advance which site will be entered. The permission is used solely to fetch publicly accessible pages of the user-chosen website.

---

## Contact / Support
Jalywebops@gmail.com
