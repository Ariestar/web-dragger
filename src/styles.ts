export const STYLES = `
/* Drag Handle in Margin */
.md-dragger-floating-handle {
    position: absolute;
    display: none;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: #656d76;
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 3px;
    font-size: 11px;
    line-height: 1;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    z-index: 999;
    transition: color 0.15s, background-color 0.15s, border-color 0.15s;
}

.md-dragger-floating-handle:hover {
    color: #1f2328;
    background: #eaecf0;
    border-color: #8c959f;
}

.md-dragger-floating-handle:active {
    cursor: grabbing;
}

/* Drop Seam Indicator */
.md-dragger-drop-seam {
    position: fixed;
    height: 2px;
    border-radius: 2px;
    background-color: #0969da;
    box-shadow: 0 0 4px rgba(9, 105, 218, 0.4);
    z-index: 10000;
    pointer-events: none;
}

.md-dragger-drop-seam.is-invalid {
    background-color: #cf222e;
    box-shadow: 0 0 4px rgba(207, 34, 46, 0.4);
}

/* Drag Source Block Highlight */
.md-dragger-drag-source {
    background-color: rgba(9, 105, 218, 0.08) !important;
    border-left: 3px solid #0969da !important;
}
`;

export function injectStyles(): void {
    if (document.getElementById('monaco-dragger-styles')) return;
    const style = document.createElement('style');
    style.id = 'monaco-dragger-styles';
    style.textContent = STYLES;
    (document.head || document.documentElement).appendChild(style);
}
