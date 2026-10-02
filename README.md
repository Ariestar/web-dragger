# monaco-dragger

A Tampermonkey / Violentmonkey userscript that brings intuitive markdown block drag-and-drop to Monaco Editor on the web (GitHub, Gitea, GitLab).

Powered by the platform-agnostic core engine [md-dragger](https://github.com/Ariestar/md-dragger).

## Features

- **Block Drag-and-Drop**: Hover over any block to see the grab handle (`⋮⋮`), and drag to reorder paragraphs, headings, lists, code fences, and tables.
- **Nested List Indentation**: Drag list items horizontally to nest or outdent them naturally.
- **Visual Drop Seam**: Shows a clean, pixel-accurate indicator line with boundary snapping.
- **Zero Configuration**: Automatically detects Monaco editors on GitHub, Gitea, and GitLab.

## Installation

1. Install a userscript manager in your browser:
   - [Tampermonkey](https://www.tampermonkey.net/)
   - [Violentmonkey](https://violentmonkey.github.io/)
2. Open or install `dist/monaco-dragger.user.js`.
3. Open any Markdown file editor on GitHub or Gitea (e.g. edit `README.md`), and start dragging!
