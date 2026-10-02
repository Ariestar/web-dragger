import fs from 'node:fs';
import esbuild from 'esbuild';

fs.mkdirSync('dist', { recursive: true });

const banner = `// ==UserScript==
// @name         Web Markdown Block Dragger (GitHub / Gitea)
// @namespace    https://github.com/Ariestar/web-dragger
// @version      0.1.0
// @description  Drag and drop markdown blocks in GitHub, Gitea, and GitLab online editors
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
    outfile: 'dist/web-dragger.user.js',
    sourcemap: false,
    minify: false,
});

console.log('✓ userscript built: dist/web-dragger.user.js');
