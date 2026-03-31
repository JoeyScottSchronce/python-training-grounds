import { useEffect, useMemo, type MutableRefObject } from 'react';
import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';

const THEME_ID = 'pythonmaster-dark';

const beforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#050507',
      'editor.foreground': '#e2e8f0',
      'editorLineNumber.foreground': '#3b82f680',
      'editorCursor.foreground': '#60a5fa',
      'editor.selectionBackground': '#1e3a5f',
      'editor.lineHighlightBackground': '#0c0d12',
    },
  });
};

export type PythonCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  showWhitespace: boolean;
  editorRef: MutableRefObject<Monaco.editor.IStandaloneCodeEditor | null>;
  className?: string;
};

export function PythonCodeEditor({
  value,
  onChange,
  readOnly,
  showWhitespace,
  editorRef,
  className = '',
}: PythonCodeEditorProps) {
  const options = useMemo<Monaco.editor.IStandaloneEditorConstructionOptions>(
    () => ({
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
      renderWhitespace: showWhitespace ? 'all' : 'none',
      minimap: { enabled: false },
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 0,
      glyphMargin: false,
      scrollBeyondLastLine: false,
      fontSize: 17,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      lineHeight: 28,
      wordWrap: 'on',
      padding: { top: 12, bottom: 12 },
      readOnly,
      automaticLayout: true,
      smoothScrolling: true,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
    }),
    [showWhitespace, readOnly]
  );

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    return () => {
      editorRef.current = null;
    };
  }, [editorRef]);

  return (
    <div className={`relative min-h-[280px] h-[min(420px,45vh)] w-full ${className}`}>
      <Editor
        height="100%"
        width="100%"
        defaultLanguage="python"
        theme={THEME_ID}
        value={value}
        options={options}
        beforeMount={beforeMount}
        onMount={onMount}
        onChange={(v) => onChange(v ?? '')}
        loading={null}
      />
    </div>
  );
}
