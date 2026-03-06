import { useEffect, useState, type RefObject } from "react";

const DROP_SUPPORTED_EXTENSIONS = [".md", ".markdown", ".txt"];
const DROP_UNSUPPORTED_FILE_MESSAGE = "Drop ignored: only .md/.markdown/.txt are supported.";

function isSupportedDropPath(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return DROP_SUPPORTED_EXTENSIONS.some((extension) => normalizedPath.endsWith(extension));
}

function isPointInsideRect(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function isDropPositionInsideWorkspace(rect: DOMRect, position: { x: number; y: number }): boolean {
  const scale = window.devicePixelRatio || 1;
  if (isPointInsideRect(rect, position.x, position.y)) {
    return true;
  }
  if (scale <= 1) {
    return false;
  }
  return isPointInsideRect(rect, position.x / scale, position.y / scale);
}

type UseTauriDragDropInput = {
  isTauriRuntime: boolean;
  workspaceRef: RefObject<HTMLElement | null>;
  onOpenDroppedPath: (path: string, ignoredFileCount: number) => Promise<unknown>;
  setStatusMessage: (message: string) => void;
};

export function useTauriDragDrop({
  isTauriRuntime,
  workspaceRef,
  onOpenDroppedPath,
  setStatusMessage
}: UseTauriDragDropInput) {
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    let disposed = false;
    let unlistenDragDrop: null | (() => void) = null;

    function isInsideWorkspace(position: { x: number; y: number }): boolean {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return false;
      }
      const rect = workspace.getBoundingClientRect();
      return isDropPositionInsideWorkspace(rect, position);
    }

    async function setupTauriDropListeners() {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const currentWebview = getCurrentWebview();
        const offDragDrop = await currentWebview.onDragDropEvent((event) => {
          if (event.payload.type === "leave") {
            setIsDragActive(false);
            return;
          }

          const inWorkspace = isInsideWorkspace(event.payload.position);
          if (event.payload.type === "enter" || event.payload.type === "over") {
            setIsDragActive(inWorkspace);
            return;
          }

          setIsDragActive(false);
          if (!inWorkspace) {
            return;
          }

          const droppedPaths = event.payload.paths;
          const selectedPath = droppedPaths.find((path) => isSupportedDropPath(path));
          if (!selectedPath) {
            setStatusMessage(DROP_UNSUPPORTED_FILE_MESSAGE);
            return;
          }

          const ignoredFileCount = droppedPaths.length - 1;
          void onOpenDroppedPath(selectedPath, ignoredFileCount);
        });

        if (disposed) {
          offDragDrop();
          return;
        }
        unlistenDragDrop = offDragDrop;
      } catch {
        setIsDragActive(false);
      }
    }

    void setupTauriDropListeners();

    return () => {
      disposed = true;
      unlistenDragDrop?.();
    };
  }, [isTauriRuntime, onOpenDroppedPath, setStatusMessage, workspaceRef]);

  return {
    isDragActive
  };
}
