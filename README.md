# MD Viewer

An installable, offline-first Markdown viewer built for Android and the web. Files are parsed entirely in the browser and are never uploaded.

## Features

- CommonMark and GitHub-flavored Markdown, including tables, task lists, strikethrough, autolinks, and fenced code
- KaTeX equations using `$...$`, `$$...$$`, `\\(...\\)`, and `\\[...\\]`
- Footnotes, definition lists, abbreviations, superscript, subscript, highlights, insertions, emoji shortcodes, and sanitized inline HTML
- Mermaid diagrams and syntax-highlighted code blocks
- Markdown plus logs, plain text, CSV/TSV, JSON, YAML, XML, configuration files, source code, and other common text formats
- Local file picker, drag and drop, clipboard paste, Android Web Share Target, and experimental PWA file associations
- Multiple closable file tabs, including multi-file picker, drop, and launch support, with per-tab scroll positions
- Device-local tab restoration so Android sharing adds a tab without discarding files already open
- Direction-aware app header and an accessible full-height scroll grabber for long files
- Installable and fully usable offline after the first visit
- Responsive light/dark reading interface and print styles

## Run locally

```bash
npm install
npm run dev
```

Validate a production build with:

```bash
npm test
npm run build
```

## Android install and opening files

1. Open the GitHub Pages site in Chrome on Android.
2. Tap **Install** in the app, or use Chrome's **Install app** menu item.
3. In Files, Drive, a notes app, or another app, share a Markdown, log, or text file and choose **MD Viewer**.

The manifest also declares `.md` file associations. Direct “Open with” behavior depends on browser and Android support; sharing to the installed app is the dependable Android path. The File Handling API is also wired up for Chromium platforms that expose it.

## Privacy and safety

Rendering happens locally. Open tab contents are stored only in this app's browser storage so they can survive Android share-target navigation; closing a tab removes it from the saved session. Shared content is kept only long enough for the installed app to receive it, then removed from its temporary browser cache. Raw HTML is sanitized, Mermaid runs in strict mode, and KaTeX trust is disabled.
