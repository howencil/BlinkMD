import { useCallback, useReducer, useRef, useState } from "react";
import {
  applyDocumentAction,
  getInitialDocumentState,
  type DocumentModel
} from "../state/documentStore";
import {
  FileOperationCancelledError,
  FileOperationError,
  openFile,
  openFileByPath,
  saveFile,
  saveFileAs
} from "../services/fileService";

type SaveMessages = {
  success: string;
  cancelled: string;
  failed: string;
};

type UseDocumentSessionInput = {
  isTauriRuntime: boolean;
};

type UseDocumentSessionResult = {
  documentState: DocumentModel;
  isBusy: boolean;
  statusMessage: string;
  setStatusMessage: (message: string) => void;
  onOpen: () => Promise<DocumentModel | null>;
  onOpenDroppedPath: (path: string, ignoredFileCount: number) => Promise<DocumentModel | null>;
  onSave: () => Promise<boolean>;
  onSaveAs: () => Promise<boolean>;
  onContentChange: (content: string) => void;
};

function getOpenCancelledMessage(): string {
  return "Open cancelled.";
}

export function useDocumentSession({
  isTauriRuntime
}: UseDocumentSessionInput): UseDocumentSessionResult {
  const [documentState, dispatch] = useReducer(applyDocumentAction, undefined, getInitialDocumentState);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  // 使用 ref 跟踪最新 documentState，避免 onSave/onSaveAs 频繁重建
  const documentStateRef = useRef(documentState);
  documentStateRef.current = documentState;

  const reportOpenError = useCallback((error: unknown) => {
    if (error instanceof FileOperationCancelledError) {
      setStatusMessage(getOpenCancelledMessage());
      return;
    }
    if (error instanceof FileOperationError) {
      setStatusMessage(error.message);
      return;
    }
    setStatusMessage("Open failed.");
  }, []);

  const confirmOpenWhenDirty = useCallback(async (): Promise<boolean> => {
    if (!documentState.isDirty) {
      return true;
    }

    if (isTauriRuntime) {
      const { ask } = await import("@tauri-apps/plugin-dialog");
      return ask("You have unsaved changes. Continue opening another file?", {
        title: "Unsaved Changes",
        kind: "warning",
        okLabel: "Continue",
        cancelLabel: "Cancel"
      });
    }

    return window.confirm("You have unsaved changes. Continue opening another file?");
  }, [documentState.isDirty, isTauriRuntime]);

  const applyOpenedDocument = useCallback((nextDocument: DocumentModel, message: string) => {
    dispatch({
      type: "documentOpened",
      document: nextDocument
    });
    setStatusMessage(message);
  }, []);

  const onOpen = useCallback(async (): Promise<DocumentModel | null> => {
    const shouldContinue = await confirmOpenWhenDirty();
    if (!shouldContinue) {
      return null;
    }

    setIsBusy(true);
    try {
      const nextDocument = await openFile();
      applyOpenedDocument(nextDocument, "File opened.");
      return nextDocument;
    } catch (error) {
      reportOpenError(error);
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [applyOpenedDocument, confirmOpenWhenDirty, reportOpenError]);

  const onOpenDroppedPath = useCallback(
    async (path: string, ignoredFileCount: number): Promise<DocumentModel | null> => {
      if (isBusy) {
        setStatusMessage("Drop ignored because another operation is running.");
        return null;
      }

      const shouldContinue = await confirmOpenWhenDirty();
      if (!shouldContinue) {
        setStatusMessage(getOpenCancelledMessage());
        return null;
      }

      setIsBusy(true);
      try {
        const nextDocument = await openFileByPath(path);
        applyOpenedDocument(
          nextDocument,
          ignoredFileCount > 0
            ? `File opened. Ignored ${ignoredFileCount} additional dropped file(s).`
            : "File opened."
        );
        return nextDocument;
      } catch (error) {
        reportOpenError(error);
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [applyOpenedDocument, confirmOpenWhenDirty, isBusy, reportOpenError]
  );

  // 通用保存操作辅助函数
  const performSave = useCallback(
    async (
      operation: (doc: DocumentModel) => Promise<string>,
      messages: SaveMessages
    ): Promise<boolean> => {
      setIsBusy(true);
      try {
        const savedPath = await operation(documentStateRef.current);
        dispatch({
          type: "documentSaved",
          path: savedPath
        });
        setStatusMessage(messages.success);
        return true;
      } catch (error) {
        if (error instanceof FileOperationCancelledError) {
          setStatusMessage(messages.cancelled);
          return false;
        }
        if (error instanceof FileOperationError) {
          setStatusMessage(error.message);
          return false;
        }
        setStatusMessage(messages.failed);
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [dispatch, setStatusMessage]
  );

  const onSave = useCallback(
    () =>
      performSave(saveFile, {
        success: "Saved.",
        cancelled: "Save cancelled.",
        failed: "Save failed."
      }),
    [performSave]
  );

  const onSaveAs = useCallback(
    () =>
      performSave(saveFileAs, {
        success: "Saved as new file.",
        cancelled: "Save As cancelled.",
        failed: "Save As failed."
      }),
    [performSave]
  );

  const onContentChange = useCallback((content: string) => {
    dispatch({
      type: "documentEdited",
      content
    });
  }, []);

  return {
    documentState,
    isBusy,
    statusMessage,
    setStatusMessage,
    onOpen,
    onOpenDroppedPath,
    onSave,
    onSaveAs,
    onContentChange
  };
}
