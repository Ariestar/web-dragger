# web-dragger

A Tampermonkey / Violentmonkey userscript that brings intuitive markdown block drag-and-drop to web Markdown editors (GitHub, Gitea, GitLab).

Powered by the platform-agnostic core engine [md-dragger](https://github.com/Ariestar/md-dragger).

## Features

- **Block Drag-and-Drop**: Hover over any block to see the grab handle (`⋮⋮`), and drag to reorder paragraphs, headings, lists, code fences, and tables.
- **Nested List Indentation**: Drag list items horizontally to nest or outdent them naturally.
- **Visual Drop Seam**: Shows a clean, pixel-accurate indicator line with boundary snapping.
- **Zero Configuration**: Automatically detects Markdown editors on GitHub, Gitea, and GitLab.

## Installation

1. Install a userscript manager in your browser:
   - [Tampermonkey](https://www.tampermonkey.net/)
   - [Violentmonkey](https://violentmonkey.github.io/)
2. [Install web-dragger](https://raw.githubusercontent.com/Ariestar/web-dragger/main/dist/web-dragger.user.js).
3. Open any Markdown file editor on GitHub or Gitea (e.g. edit `README.md`), and start dragging!

This is an experimental userscript for testing the new Monaco adapter. It currently requires the page to expose `window.monaco`; browser integration still needs testing.
