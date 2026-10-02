import type { editor } from 'monaco-editor';
import { detectBlock } from 'md-dragger/domain';
import { HANDLE_CLASS, lineAtPoint, monacoDoc } from 'md-dragger/adapter/monaco';

export class FloatingHandleWidget {
    private readonly domNode: HTMLElement;
    private attachedEditor: editor.ICodeEditor | null = null;

    constructor() {
        this.domNode = document.createElement('div');
        this.domNode.className = `${HANDLE_CLASS} md-dragger-floating-handle`;
        this.domNode.innerHTML = '⋮⋮';
        this.domNode.title = 'Drag to move block';
    }

    getDomNode(): HTMLElement {
        return this.domNode;
    }

    attach(editorInstance: editor.ICodeEditor, tabSize: number): () => void {
        this.attachedEditor = editorInstance;
        const domNode = editorInstance.getDomNode();
        if (!domNode) return () => {};

        domNode.appendChild(this.domNode);

        const onMouseMove = (event: MouseEvent) => {
            const model = editorInstance.getModel();
            if (!model) {
                this.hide();
                return;
            }

            const hitLine = lineAtPoint(editorInstance, { x: event.clientX, y: event.clientY });
            if (!hitLine || hitLine < 1 || hitLine > model.getLineCount()) {
                this.hide();
                return;
            }

            const doc = monacoDoc(model);
            const block = detectBlock(doc, hitLine, { tabSize });
            if (!block) {
                this.hide();
                return;
            }

            const blockStart = block.lines.startLine;
            const layout = editorInstance.getLayoutInfo();
            const scrollTop = editorInstance.getScrollTop();
            const topPx = editorInstance.getTopForLineNumber(blockStart) - scrollTop;
            const leftPx = Math.max(2, layout.contentLeft - 22);

            this.show(blockStart, topPx, leftPx);
        };

        const onMouseLeave = () => {
            this.hide();
        };

        domNode.addEventListener('mousemove', onMouseMove);
        domNode.addEventListener('mouseleave', onMouseLeave);

        return () => {
            domNode.removeEventListener('mousemove', onMouseMove);
            domNode.removeEventListener('mouseleave', onMouseLeave);
            this.domNode.remove();
            this.attachedEditor = null;
        };
    }

    show(line: number, topPx: number, leftPx: number): void {
        this.domNode.setAttribute('data-block-start', String(line));
        this.domNode.style.top = `${topPx}px`;
        this.domNode.style.left = `${leftPx}px`;
        this.domNode.style.display = 'flex';
    }

    hide(): void {
        this.domNode.style.display = 'none';
    }
}
