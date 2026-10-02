import type { editor } from 'monaco-editor';
import { mdDraggerMonaco } from 'md-dragger/adapter/monaco';
import { FloatingHandleWidget } from './handle';
import { injectStyles } from './styles';

declare global {
    interface Window {
        monaco?: typeof import('monaco-editor');
    }
}

function isMarkdownEditor(ed: editor.ICodeEditor): boolean {
    const model = ed.getModel();
    if (!model) return false;

    const lang = model.getLanguageId?.();
    if (lang === 'markdown') return true;

    const uri = model.uri?.path ?? '';
    if (uri.endsWith('.md') || uri.endsWith('.markdown')) return true;

    if (location.pathname.endsWith('.md') || location.pathname.endsWith('.markdown')) return true;

    return false;
}

function init(): void {
    injectStyles();

    const attached = new WeakSet<editor.ICodeEditor>();

    const attach = (ed: editor.ICodeEditor) => {
        if (attached.has(ed)) return;
        if (!isMarkdownEditor(ed)) return;

        attached.add(ed);

        const tabSize = ed.getModel()?.getOptions().tabSize ?? 4;
        const handleWidget = new FloatingHandleWidget();

        const detachHandle = handleWidget.attach(ed, tabSize);

        const detachDragger = mdDraggerMonaco(ed, {
            config: {
                tabSize,
                listIndentUnit: 2,
            },
            listIndentWidthPx: 20,
        });

        ed.onDidDispose(() => {
            detachHandle();
            detachDragger();
        });
    };

    const attachAll = (monacoObj: typeof import('monaco-editor')) => {
        for (const ed of monacoObj.editor.getEditors()) {
            attach(ed);
        }
        monacoObj.editor.onDidCreateEditor((ed) => {
            attach(ed);
        });
    };

    if (window.monaco?.editor) {
        attachAll(window.monaco);
        return;
    }

    let attempts = 0;
    const maxAttempts = 60; // 12 seconds polling
    const timer = setInterval(() => {
        attempts++;
        if (window.monaco?.editor) {
            clearInterval(timer);
            attachAll(window.monaco);
        } else if (attempts >= maxAttempts) {
            clearInterval(timer);
        }
    }, 200);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
