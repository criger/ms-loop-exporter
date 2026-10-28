# Loop Board Exporter

A small **Microsoft Edge / Google Chrome extension** for exporting a Microsoft Loop **Board** to structured JSON, readable Markdown for AI analysis, or an Excel-compatible CSV.

**Developed by Cristhian Gertner.** This is an independent, personal open-source project; it is not an official Microsoft or employer product.

## What it does

- Exports the **current Loop Board view**. Apply any filters in Loop **before** opening a card.
- Reads all cards in the filtered view, including their **dynamic fields, owners, status, creation/completion dates and rich-text notes**.
- Preserves Markdown lists, emphasis, links, mentions, and the original HTML if you explicitly enable it.
- Converts Loop date pills such as `Today`, `Yesterday`, `Tomorrow`, and dated relative displays into **absolute `YYYY-MM-DD` dates in the exported notes** when they can be resolved.
- Opens a **local report page** with JSON / Markdown / CSV tabs and a read-only text area, **Copy** and **Download** buttons.
- Offers **English and Norwegian** UI, including the result viewer. Language choice is saved locally.
- Stores reports in the browser's local IndexedDB; no remote API calls or AI integration.

> **Important:** This is a snapshot of the current card content, **not** a historical audit trail. The active Loop filter determines which cards will be exported.

## Install in Microsoft Edge

1. Download this repository as a ZIP (**Code → Download ZIP**) and extract it, or clone the repository.
2. Open **`edge://extensions`** in Microsoft Edge.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the **repository root** — the folder containing `manifest.json`.
6. Pin **Loop Board Exporter** to the browser toolbar if you wish.

For Google Chrome, use **`chrome://extensions`**, enable **Developer mode**, and click **Load unpacked**. Select the same repository root.

When updating a locally loaded extension, replace or update the source folder and select **Reload** on the extension's card. Refresh your Loop browser tab afterwards.

## Export a Board

1. Open Microsoft Loop in Edge or Chrome.
2. Navigate to a **Board**.
3. Optionally apply filters in Loop (e.g. `Status = Completed` or `Created after date`).
4. **Open any card** from the filtered view. Its navigation counter should show only the filtered set (for example, `1 of 7`).
5. Click the extension icon. Choose **English** or **Norsk**, and optionally enable **Include original HTML**.
6. Click **Export N cards**. The extension navigates through the filtered cards using Loop's own previous/next controls.
7. A new tab opens with **JSON**, **Markdown · AI** and **CSV · Excel**. Review the content, copy it, or download it.

If you do not have a card open, the disabled button instructs you to open one. The close button **×** and **Esc** dismiss the panel. Closing the panel does not interrupt a running export; the Cancel button does.

### Data fields

The tested Loop Board has these fields: `Title`, `Status`, `Opprettet` (Created), `Utført dato` (Completed date), and `Ansvarlig` (Owner). Additional fields are exported dynamically. Titles are pure text; creation dates are stored in the separate `Opprettet` Date field.

The extension does not create these fields for you, does not edit Loop data, and does not automatically assign creation dates.

## Formats

| Format | Best for | Notes |
| --- | --- | --- |
| **JSON** | Programmatic processing and high-fidelity re-analysis | Full fields, note blocks, normalized dates, selected metadata. Optional raw HTML. |
| **Markdown (.md)** | Pasting into an approved AI for activity summaries | Readable text with dates normalized in notes; removes known user/tracking URL parameters. |
| **CSV (.csv)** | Excel and other spreadsheets | One row per card, columns for all dynamic fields and **Notes 1, Notes 2, ...**. CSV uses UTF-8 BOM and quoted multiline cells. |

**Excel note limit:** Excel cells hold a maximum of **32,767 characters**. To avoid truncation, the CSV generator splits long note text into separate numbered note columns with a 30,000-character cap per cell. Multiline text remains inside the quoted CSV cell. CSV escapes double quotes and neutralizes potentially executable spreadsheet formula prefixes.

CSV is the pragmatic Excel route. A styled Excel workbook and DOCX are **not included** in this release. They may be added later, with separate formatting and validation tests.

## Privacy and security

**No upload, remote tracking or AI invocation.** Only the active Microsoft Loop tab is accessed after clicking the toolbar icon. Permissions: `activeTab`, `scripting`, `storage`.

The extension uses a Manifest V3 background service worker with local IndexedDB for large reports. Language is saved locally in Chrome storage. Saved reports remain in that browser profile until its data is cleared or the extension is uninstalled.

**Confidentiality still matters.** A local exporter does not make confidential Loop data safe to share with a public AI. Check your company's AI/data handling policy, and review reports for names, links or sensitive business details before sharing them.

Raw JSON may include original field values, links and user names. Known tracking parameters are removed from readable Markdown and CSV links, but the optional raw HTML retains the original source.

## Limitations

- Uses **Loop's rendered DOM**, not a documented Microsoft API. UI changes can break selectors.
- Tested manually against a filtered Board with 7 and 9 cards in the earlier exporter; the new v0.6 UI and date-output code still require a real Loop smoke test.
- Only **Board card dialog** exports are supported; general Loop Pages, file attachments and embedded images are not fully exported.
- If Loop virtualizes cards, this version relies on its native filtered card dialog navigation; it does not scan the Board grid.
- Date pills without a year are interpreted relative to the export day. Extremely old or ambiguous dates may require review.
- `cardKeyCandidate` comes from an internal Fluid component and is **not** a guaranteed stable Loop card identifier.
- Some editor-generated empty paragraphs are kept so the source structure is not silently discarded.

## Developers

No runtime packages, bundler or network access required. Files are plain JavaScript, CSS and HTML.

```text
manifest.json
src/
  background.js      # Extension messages and IndexedDB
  dates.js           # Loop date parsing and URL cleanup
  extractor.js       # Card DOM extraction and navigation
  panel.js           # Bilingual in-page UI and export orchestration
  formats.js         # Markdown and Excel-compatible CSV
  report.js          # Result page controller
ui/
  report.html
  report.css
  help.html
icons/
  icon16.png
  icon32.png
  icon48.png
  icon128.png
tests/
  smoke.test.cjs
```

Run syntax and export-format tests:

```bash
node --test tests/smoke.test.cjs
node --check src/background.js
node --check src/dates.js
node --check src/extractor.js
node --check src/panel.js
node --check src/formats.js
node --check src/report.js
```

For a manual Loop smoke test: filter the Board to 1–3 cards, open one, run the export, and verify that JSON/Markdown/CSV all include the expected cards, field dates and note text. Then test both languages, closing/reopening the panel, copy/download, and a cancelled export.

## License

Copyright © 2026 Cristhian Gertner. Distributed under **[CC BY 4.0](LICENSE)** in line with the author's other public work. See [ATTRIBUTION.md](ATTRIBUTION.md). A software-oriented license may be considered for future versions.

Microsoft Loop, Edge, Chrome and their respective trademarks belong to their owners. This project is not affiliated with or endorsed by Microsoft or Google.
