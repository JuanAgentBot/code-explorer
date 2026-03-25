import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from "@codemirror/language";
import {
  defaultKeymap,
  indentWithTab,
  history,
  historyKeymap,
} from "@codemirror/commands";
import {
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

const voidTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "0.85rem",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
    overflow: "auto",
  },
  ".cm-gutters": {
    background: "transparent",
    border: "none",
    color: "var(--text-dim)",
  },
  ".cm-activeLineGutter": {
    background: "transparent",
    color: "var(--text)",
  },
  ".cm-activeLine": {
    background: "rgba(255, 255, 255, 0.03)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--accent)",
  },
  ".cm-selectionBackground": {
    background: "rgba(192, 132, 252, 0.15) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    background: "rgba(192, 132, 252, 0.25) !important",
  },
});

/**
 * Create a CodeMirror editor with TypeScript highlighting.
 * Returns helpers to get/set content and listen for changes.
 */
export function createEditor(
  parent: HTMLElement,
  initialCode: string,
  onChange: (code: string) => void,
) {
  let debounceTimer: ReturnType<typeof setTimeout>;

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initialCode,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        javascript({ typescript: true }),
        oneDark,
        voidTheme,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              onChange(view.state.doc.toString());
            }, 300);
          }
        }),
      ],
    }),
  });

  return {
    getCode: () => view.state.doc.toString(),
    setCode: (code: string) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      });
    },
  };
}
