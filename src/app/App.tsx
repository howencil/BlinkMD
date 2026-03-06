import { useCallback, useMemo, useRef, useState } from "react";
import { EditorPane } from "../editor/EditorPane";
import { PreviewPane } from "../preview/PreviewPane";
import { type ViewMode } from "../state/documentStore";
import brandLogo from "../assets/logo-transparent.png";
import { useCloseGuard } from "./useCloseGuard";
import { useDocumentSession } from "./useDocumentSession";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { usePreviewSync } from "./usePreviewSync";
import { useTauriDragDrop } from "./useTauriDragDrop";
import "./App.css";

const CJK_CHAR_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const LATIN_CHAR_REGEX = /[\p{Script=Latin}]/u;

function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) {
    return 0;
  }

  const cjkCharCount = (content.match(CJK_CHAR_REGEX) ?? []).length;
  const latinWordCount = content
    .split(/\s+/)
    .filter(Boolean)
    .reduce((count, token) => count + (LATIN_CHAR_REGEX.test(token) ? 1 : 0), 0);

  return cjkCharCount + latinWordCount;
}

function getFileName(path: string | null): string {
  if (!path) {
    return "Untitled.md";
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "Untitled.md";
}

export function App() {
  type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };
  const isTauriRuntime = Boolean((window as TauriWindow).__TAURI_INTERNALS__);

  const [mode, setMode] = useState<ViewMode>("edit");
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const workspaceRef = useRef<HTMLElement>(null);

  const {
    documentState,
    isBusy,
    statusMessage,
    setStatusMessage,
    onOpen,
    onOpenDroppedPath,
    onSave,
    onSaveAs,
    onContentChange
  } = useDocumentSession({ isTauriRuntime });

  const { previewContent, isLargeDocument, refreshPreview } = usePreviewSync({
    content: documentState.content,
    mode,
    workspaceRef
  });

  const switchMode = useCallback(
    (nextMode: ViewMode, message?: string, previewSourceContent?: string) => {
      if (nextMode === "preview" || nextMode === "split") {
        refreshPreview(previewSourceContent);
      }
      setMode(nextMode);
      if (message) {
        setStatusMessage(message);
      }
    },
    [refreshPreview, setStatusMessage]
  );

  const handleOpen = useCallback(async () => {
    const nextDocument = await onOpen();
    if (!nextDocument) {
      return;
    }

    switchMode("preview", undefined, nextDocument.content);
    setCursor({ line: 1, column: 1 });
  }, [onOpen, switchMode]);

  const handleOpenDroppedPath = useCallback(
    async (path: string, ignoredFileCount: number) => {
      const nextDocument = await onOpenDroppedPath(path, ignoredFileCount);
      if (!nextDocument) {
        return null;
      }

      switchMode("preview", undefined, nextDocument.content);
      setCursor({ line: 1, column: 1 });
      return nextDocument;
    },
    [onOpenDroppedPath, switchMode]
  );

  useKeyboardShortcuts({
    isBusy,
    isTauriRuntime,
    onOpen: handleOpen,
    onSave,
    onSaveAs,
    switchMode
  });

  const { closeConfirmVisible, onCloseConfirmSave, onCloseConfirmDiscard, onCloseConfirmCancel } =
    useCloseGuard({
      isDirty: documentState.isDirty,
      isTauriRuntime,
      onSave,
      setStatusMessage
    });

  const { isDragActive } = useTauriDragDrop({
    isTauriRuntime,
    workspaceRef,
    onOpenDroppedPath: handleOpenDroppedPath,
    setStatusMessage
  });

  const wordCount = useMemo(() => countWords(documentState.content), [documentState.content]);
  const dirtyStatusText = documentState.isDirty ? "Dirty ● Unsaved" : "Dirty ○ Saved";

  function onCursorChange(nextCursor: { line: number; column: number }) {
    setCursor(nextCursor);
  }

  const workspaceClassName = [
    "workspace",
    mode === "split" ? "workspace-split" : "",
    isDragActive ? "is-drag-active" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app-shell">
      <header className="topbar" role="banner">
        <div className="topbar-left">
          <img src={brandLogo} alt="BlinkMD logo" className="brand-logo" />
          <span>BlinkMD</span>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={() => void handleOpen()} disabled={isBusy}>
            {isBusy ? "Working..." : "Open"}
          </button>
          <button type="button" onClick={() => void onSave()} disabled={isBusy}>
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              const nextMode = mode === "edit" ? "split" : mode === "split" ? "preview" : "edit";
              switchMode(nextMode);
            }}
            disabled={isBusy}
          >
            {mode === "edit" ? "Split" : mode === "split" ? "Preview" : "Edit"}
          </button>
        </div>
      </header>

      <main ref={workspaceRef} className={workspaceClassName} role="main">
        {mode === "edit" && (
          <EditorPane
            content={documentState.content}
            onContentChange={onContentChange}
            onCursorChange={onCursorChange}
          />
        )}
        {mode === "split" && (
          <>
            <EditorPane
              content={documentState.content}
              onContentChange={onContentChange}
              onCursorChange={onCursorChange}
            />
            <PreviewPane content={previewContent} />
          </>
        )}
        {mode === "preview" && <PreviewPane content={previewContent} />}
      </main>

      <footer className="statusbar" role="contentinfo">
        <span
          className={documentState.isDirty ? "status-dirty is-dirty" : "status-dirty is-clean"}
          aria-label={dirtyStatusText}
        >
          {dirtyStatusText}
        </span>
        <span>{getFileName(documentState.path)}</span>
        <span>Words {wordCount}</span>
        {isLargeDocument ? <span>Large File Mode</span> : null}
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="status-message" aria-live="polite">
          {statusMessage}
        </span>
      </footer>

      {closeConfirmVisible && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Unsaved changes">
          <div className="modal-box">
            <p className="modal-message">You have unsaved changes.</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn-primary" onClick={() => void onCloseConfirmSave()}>
                Save
              </button>
              <button type="button" className="modal-btn modal-btn-danger" onClick={() => void onCloseConfirmDiscard()}>
                Don&apos;t Save
              </button>
              <button type="button" className="modal-btn" onClick={onCloseConfirmCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
