import { describe, it, expect } from "vitest";
import {
  applyDocumentAction,
  getInitialDocumentState,
  type DocumentModel
} from "./documentStore";

describe("getInitialDocumentState", () => {
  it("returns correct default values", () => {
    const state = getInitialDocumentState();
    expect(state.path).toBeNull();
    expect(state.content).toBe("");
    expect(state.isDirty).toBe(false);
  });

  it("has path defaulting to null", () => {
    expect(getInitialDocumentState().path).toBeNull();
  });

  it("has isDirty defaulting to false", () => {
    expect(getInitialDocumentState().isDirty).toBe(false);
  });

  it("has content defaulting to empty string", () => {
    expect(getInitialDocumentState().content).toBe("");
  });

  it("has updatedAt as a reasonable timestamp", () => {
    const before = Date.now();
    const state = getInitialDocumentState();
    const after = Date.now();
    expect(state.updatedAt).toBeGreaterThanOrEqual(before);
    expect(state.updatedAt).toBeLessThanOrEqual(after);
  });
});

describe("applyDocumentAction", () => {
  function createDocument(overrides: Partial<DocumentModel> = {}): DocumentModel {
    return {
      path: "/tmp/original.md",
      content: "# Original",
      isDirty: false,
      updatedAt: 100,
      ...overrides
    };
  }

  it("replaces the document when opening a file", () => {
    const previous = createDocument({ isDirty: true, updatedAt: 100 });

    const next = applyDocumentAction(previous, {
      type: "documentOpened",
      document: {
        path: "/tmp/next.md",
        content: "# Next",
        isDirty: false,
        updatedAt: 200
      }
    });

    expect(next).toEqual({
      path: "/tmp/next.md",
      content: "# Next",
      isDirty: false,
      updatedAt: 200
    });
  });

  it("marks the document dirty when content changes", () => {
    const next = applyDocumentAction(createDocument(), {
      type: "documentEdited",
      content: "# Updated",
      updatedAt: 300
    });

    expect(next.content).toBe("# Updated");
    expect(next.isDirty).toBe(true);
    expect(next.updatedAt).toBe(300);
  });

  it("clears dirty state and updates the saved path", () => {
    const next = applyDocumentAction(
      createDocument({
        path: null,
        content: "# Updated",
        isDirty: true,
        updatedAt: 300
      }),
      {
        type: "documentSaved",
        path: "/tmp/saved.md",
        updatedAt: 400
      }
    );

    expect(next.path).toBe("/tmp/saved.md");
    expect(next.content).toBe("# Updated");
    expect(next.isDirty).toBe(false);
    expect(next.updatedAt).toBe(400);
  });
});
