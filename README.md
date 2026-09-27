# CodingShuttle Focus Mode 🎯

> A clean, distraction-free Chrome/Chromium extension designed to optimize learning on [codingshuttle.com](https://www.codingshuttle.com).

Hides marketing banners, ad cards, floating widgets, and navigation clutter while providing active learning tools like highlighting, note-taking, Pomodoro timers, and progress tracking.

---

## ✨ Features

### 🛡️ Distraction Blocker
- **Top Navigation Bar**: Removes sticky headers, menu links, and promo buttons.
- **Ad & Promo Cards**: Eliminates inline marketing blocks (e.g. "From SDE to AI Engineering", price tags, batch announcements).
- **Right Sidebar Cleaner**: Strips ad widgets while dynamically expanding the reading area.
- **Floating Widgets**: Hides intrusive WhatsApp chat buttons and sticky CTA overlays.
- **Announcement Banners & Footers**: Removes notification strips and promotional footers.
- **MutationObserver**: Automatically catches dynamically injected popups and widgets.

### 📖 Reading & Focus
- **Reading Progress Bar**: Slim gradient indicator fixed at the top showing scroll completion.
- **Estimated Read Time**: Displays word count and estimated reading time directly beneath the lesson title.
- **Spotlight Mode**: Dims all content except the paragraph or code block currently hovered.
- **Pomodoro Timer**: Embedded 25-minute HUD with circular progress indicator, start/pause/reset controls, and desktop notification on completion.

### 🧠 Active Learning & Notes
- **Text Highlighter**: Highlight selections with 4 distinct colors. Highlights persist across page refreshes via `chrome.storage.local`.
- **Inline Paragraph Notes**: Margin-docked sticky notes (📝) for annotating explanations and definitions.
- **Copy Code Buttons**: Fast one-click code snippet copying with clipboard fallback for Chromium on Linux.
- **Floating Table of Contents**: Quick-jump index generated from `<h2>` and `<h3>` tags with active scroll-spy highlighting.
- **Mark as Done**: Track finished lessons with celebratory confetti and visual completion badges that persist locally.

---

## 🚀 Installation

### Chrome / Brave / Edge / Chromium (Windows & Linux)

1. Clone or download this repository:
   ```bash
   git clone <REPO_URL>
   ```
2. Open your browser and navigate to:
   - Chrome / Chromium: `chrome://extensions/`
   - Brave: `brave://extensions/`
   - Edge: `edge://extensions/`
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the `codingshuttle-focus-mode` directory.
6. Navigate to any article on [codingshuttle.com](https://www.codingshuttle.com) and start learning distraction-free!

---

## 🛠️ Project Structure

```text
codingshuttle-focus-mode/
├── manifest.json       # Manifest V3 configuration
├── content.js          # Core focus engine, DOM cleaner, and productivity suite
├── popup.html          # Extension dashboard & controls UI
├── popup.js            # Settings toggle handler & stats sync
└── icons/              # Extension icons (16px, 48px, 128px)
```

---

## 💻 Compatibility
- Fully compliant with **Chrome Manifest V3**.
- Works seamlessly on **Windows**, **macOS**, and **Linux** (including Chromium, Helium, Google Chrome, and Brave).
- Zero external dependencies.
