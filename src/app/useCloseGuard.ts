import { useEffect, useRef, useState } from "react";
import { resolveCloseRequest } from "./closeGuard";

let globalCloseGuardUnlisten: null | (() => void) = null;

type UseCloseGuardInput = {
  isDirty: boolean;
  isTauriRuntime: boolean;
  onSave: () => Promise<boolean>;
  setStatusMessage: (message: string) => void;
};

type UseCloseGuardResult = {
  closeConfirmVisible: boolean;
  onCloseConfirmSave: () => Promise<void>;
  onCloseConfirmDiscard: () => Promise<void>;
  onCloseConfirmCancel: () => void;
};

export function useCloseGuard({
  isDirty,
  isTauriRuntime,
  onSave,
  setStatusMessage
}: UseCloseGuardInput): UseCloseGuardResult {
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const closeGuardActiveRef = useRef(false);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (isTauriRuntime) {
      return;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isDirty, isTauriRuntime]);

  async function closeWindow() {
    const { invoke } = await import("@tauri-apps/api/core");
    closeGuardActiveRef.current = true;
    try {
      await invoke("exit_app");
    } catch (error) {
      closeGuardActiveRef.current = false;
      throw error;
    }
  }

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    let disposed = false;
    let unlistenClose: null | (() => void) = null;

    async function setupCloseGuard() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      globalCloseGuardUnlisten?.();
      globalCloseGuardUnlisten = null;

      const offClose = await appWindow.onCloseRequested(async (event) => {
        const isProgrammaticClose = closeGuardActiveRef.current;
        const decision = resolveCloseRequest({
          isDirty,
          forceCloseOnce: isProgrammaticClose
        });
        closeGuardActiveRef.current = decision.nextForceCloseOnce;

        if (decision.shouldBlock) {
          event.preventDefault();
          setCloseConfirmVisible(true);
          return;
        }

        if (isProgrammaticClose) {
          return;
        }

        event.preventDefault();
        try {
          await closeWindow();
        } catch {
          setStatusMessage("Close failed.");
        }
      });

      if (disposed) {
        offClose();
        return;
      }
      globalCloseGuardUnlisten = offClose;
      unlistenClose = () => {
        if (globalCloseGuardUnlisten === offClose) {
          globalCloseGuardUnlisten = null;
        }
        offClose();
      };
    }

    void setupCloseGuard();

    return () => {
      disposed = true;
      unlistenClose?.();
      closeGuardActiveRef.current = false;
    };
  }, [isDirty, isTauriRuntime, setStatusMessage]);

  async function onCloseConfirmSave() {
    setCloseConfirmVisible(false);
    const saved = await onSaveRef.current();
    if (saved) {
      try {
        await closeWindow();
      } catch {
        setStatusMessage("Close failed.");
      }
      return;
    }

    setStatusMessage("Close cancelled because save did not complete.");
  }

  async function onCloseConfirmDiscard() {
    setCloseConfirmVisible(false);
    try {
      await closeWindow();
    } catch {
      setStatusMessage("Close failed.");
    }
  }

  function onCloseConfirmCancel() {
    setCloseConfirmVisible(false);
  }

  return {
    closeConfirmVisible,
    onCloseConfirmSave,
    onCloseConfirmDiscard,
    onCloseConfirmCancel
  };
}
