import { describe, expect, it, vi } from "vitest";
import { executeShortcutCommand, isTauriShortcutCommand } from "./shortcutCommands";

describe("executeShortcutCommand", () => {
  it("routes mode commands through switchMode with the expected status message", () => {
    const switchMode = vi.fn();

    executeShortcutCommand("preview", {
      isBusy: false,
      onOpen: vi.fn(),
      onSave: vi.fn(),
      onSaveAs: vi.fn(),
      switchMode
    });

    expect(switchMode).toHaveBeenCalledWith("preview", "Switched to preview mode.");
  });

  it("does not run open/save commands while busy", () => {
    const onOpen = vi.fn();
    const onSave = vi.fn();
    const onSaveAs = vi.fn();

    executeShortcutCommand("open", {
      isBusy: true,
      onOpen,
      onSave,
      onSaveAs,
      switchMode: vi.fn()
    });
    executeShortcutCommand("save", {
      isBusy: true,
      onOpen,
      onSave,
      onSaveAs,
      switchMode: vi.fn()
    });
    executeShortcutCommand("saveAs", {
      isBusy: true,
      onOpen,
      onSave,
      onSaveAs,
      switchMode: vi.fn()
    });

    expect(onOpen).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(onSaveAs).not.toHaveBeenCalled();
  });
});

describe("isTauriShortcutCommand", () => {
  it("accepts mode commands only", () => {
    expect(isTauriShortcutCommand("edit")).toBe(true);
    expect(isTauriShortcutCommand("preview")).toBe(true);
    expect(isTauriShortcutCommand("split")).toBe(true);
    expect(isTauriShortcutCommand("save")).toBe(false);
    expect(isTauriShortcutCommand("unknown")).toBe(false);
  });
});
