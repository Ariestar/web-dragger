import fs from 'node:fs';
import esbuild from 'esbuild';

fs.mkdirSync('dist', { recursive: true });

const banner = `// ==UserScript==
// @name         Monaco Markdown Block Dragger (GitHub / Gitea)
// @namespace    https://github.com/Ariestar/md-dragger
// @version      0.1.0
// @description  Drag and drop markdown blocks in GitHub, Gitea, and GitLab online Monaco editors
// @author       Ariestar
// @match        https://github.com/*
// @match        https://*.github.com/*
// @match        https://gitea.com/*
// @match        https://*.gitea.io/*
// @match        https://gitlab.com/*
// @match        https://*.gitlab.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
`;

await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    format: 'iife',
    banner: { js: banner },
    outfile: 'dist/monaco-dragger.user.js',
    sourcemap: false,
    minify: false,
});

console.log('✓ userscript built: dist/monaco-dragger.user.js');
