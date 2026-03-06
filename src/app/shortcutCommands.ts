import type { ViewMode } from "../state/documentStore";
import type { ShortcutCommand } from "./shortcutKeymap";

export const TAURI_SHORTCUT_EVENT = "blinkmd://shortcut";

export type TauriShortcutCommand = Extract<ShortcutCommand, "edit" | "preview" | "split">;

type ShortcutExecutionInput = {
  isBusy: boolean;
  onOpen: () => Promise<unknown>;
  onSave: () => Promise<unknown>;
  onSaveAs: () => Promise<unknown>;
  switchMode: (nextMode: ViewMode, message?: string) => void;
};

const MODE_SWITCH_CONFIG: Record<TauriShortcutCommand, { mode: ViewMode; message: string }> = {
  edit: {
    mode: "edit",
    message: "Switched to edit mode."
  },
  preview: {
    mode: "preview",
    message: "Switched to preview mode."
  },
  split: {
    mode: "split",
    message: "Switched to split mode."
  }
};

export function isTauriShortcutCommand(value: unknown): value is TauriShortcutCommand {
  return value === "edit" || value === "preview" || value === "split";
}

export function executeShortcutCommand(
  command: ShortcutCommand,
  input: ShortcutExecutionInput
) {
  if (command === "open") {
    if (!input.isBusy) {
      void input.onOpen();
    }
    return;
  }

  if (command === "save") {
    if (!input.isBusy) {
      void input.onSave();
    }
    return;
  }

  if (command === "saveAs") {
    if (!input.isBusy) {
      void input.onSaveAs();
    }
    return;
  }

  const modeSwitch = MODE_SWITCH_CONFIG[command];
  input.switchMode(modeSwitch.mode, modeSwitch.message);
}
