import { useCallback, useReducer, useState } from "react";
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

  const onSave = useCallback(async (): Promise<boolean> => {
    setIsBusy(true);
    try {
      const savedPath = await saveFile(documentState);
      dispatch({
        type: "documentSaved",
        path: savedPath
      });
      setStatusMessage("Saved.");
      return true;
    } catch (error) {
      if (error instanceof FileOperationCancelledError) {
        setStatusMessage("Save cancelled.");
        return false;
      }
      if (error instanceof FileOperationError) {
        setStatusMessage(error.message);
        return false;
      }
      setStatusMessage("Save failed.");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [documentState]);

  const onSaveAs = useCallback(async (): Promise<boolean> => {
    setIsBusy(true);
    try {
      const savedPath = await saveFileAs(documentState);
      dispatch({
        type: "documentSaved",
        path: savedPath
      });
      setStatusMessage("Saved as new file.");
      return true;
    } catch (error) {
      if (error instanceof FileOperationCancelledError) {
        setStatusMessage("Save As cancelled.");
        return false;
      }
      if (error instanceof FileOperationError) {
        setStatusMessage(error.message);
        return false;
      }
      setStatusMessage("Save As failed.");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [documentState]);

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
