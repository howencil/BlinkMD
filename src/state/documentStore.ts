export type ViewMode = "edit" | "preview" | "split";

export type DocumentModel = {
  path: string | null;
  content: string;
  isDirty: boolean;
  updatedAt: number;
};

export type DocumentAction =
  | {
      type: "documentOpened";
      document: DocumentModel;
    }
  | {
      type: "documentEdited";
      content: string;
      updatedAt?: number;
    }
  | {
      type: "documentSaved";
      path: string;
      updatedAt?: number;
    };

export function getInitialDocumentState(): DocumentModel {
  return {
    path: null,
    content: "",
    isDirty: false,
    updatedAt: Date.now()
  };
}

export function applyDocumentAction(
  previous: DocumentModel,
  action: DocumentAction
): DocumentModel {
  if (action.type === "documentOpened") {
    return action.document;
  }

  if (action.type === "documentEdited") {
    return {
      ...previous,
      content: action.content,
      isDirty: true,
      updatedAt: action.updatedAt ?? Date.now()
    };
  }

  return {
    ...previous,
    path: action.path,
    isDirty: false,
    updatedAt: action.updatedAt ?? Date.now()
  };
}
