import { useEffect } from "react";
import { resolveShortcutCommand } from "./shortcutKeymap";
import {
  executeShortcutCommand,
  isTauriShortcutCommand,
  TAURI_SHORTCUT_EVENT
} from "./shortcutCommands";
import type { ViewMode } from "../state/documentStore";

type UseKeyboardShortcutsInput = {
  isBusy: boolean;
  isTauriRuntime: boolean;
  onOpen: () => Promise<unknown>;
  onSave: () => Promise<unknown>;
  onSaveAs: () => Promise<unknown>;
  switchMode: (nextMode: ViewMode, message?: string) => void;
};

export function useKeyboardShortcuts({
  isBusy,
  isTauriRuntime,
  onOpen,
  onSave,
  onSaveAs,
  switchMode
}: UseKeyboardShortcutsInput) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = resolveShortcutCommand(event);
      if (!command) {
        return;
      }

      event.preventDefault();
      executeShortcutCommand(command, {
        isBusy,
        onOpen,
        onSave,
        onSaveAs,
        switchMode
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isBusy, onOpen, onSave, onSaveAs, switchMode]);

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    let disposed = false;
    let unlistenShortcut: null | (() => void) = null;

    async function setupTauriShortcutListeners() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const offShortcut = await listen<string>(TAURI_SHORTCUT_EVENT, (event) => {
          if (!isTauriShortcutCommand(event.payload)) {
            return;
          }
          executeShortcutCommand(event.payload, {
            isBusy,
            onOpen,
            onSave,
            onSaveAs,
            switchMode
          });
        });
        if (disposed) {
          offShortcut();
          return;
        }
        unlistenShortcut = offShortcut;
      } catch {
        unlistenShortcut = null;
      }
    }

    void setupTauriShortcutListeners();

    return () => {
      disposed = true;
      unlistenShortcut?.();
    };
  }, [isBusy, isTauriRuntime, onOpen, onSave, onSaveAs, switchMode]);
}
