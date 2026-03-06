import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ViewMode } from "../state/documentStore";

const PREVIEW_DEBOUNCE_MS = 120;
const LARGE_FILE_PREVIEW_DEBOUNCE_MS = 420;
const LARGE_FILE_THRESHOLD_BYTES = 1024 * 1024;

function getUtf8SizeInBytes(content: string): number {
  return new TextEncoder().encode(content).length;
}

type UsePreviewSyncInput = {
  content: string;
  mode: ViewMode;
  workspaceRef: RefObject<HTMLElement | null>;
};

type UsePreviewSyncResult = {
  previewContent: string;
  isLargeDocument: boolean;
  refreshPreview: (content?: string) => void;
};

export function usePreviewSync({
  content,
  mode,
  workspaceRef
}: UsePreviewSyncInput): UsePreviewSyncResult {
  const [previewContent, setPreviewContent] = useState("");
  const latestContentRef = useRef(content);

  const contentSizeBytes = useMemo(() => getUtf8SizeInBytes(content), [content]);
  const isLargeDocument = contentSizeBytes > LARGE_FILE_THRESHOLD_BYTES;
  const previewDebounceMs = isLargeDocument ? LARGE_FILE_PREVIEW_DEBOUNCE_MS : PREVIEW_DEBOUNCE_MS;

  useEffect(() => {
    latestContentRef.current = content;
  }, [content]);

  const refreshPreview = useCallback((nextContent?: string) => {
    setPreviewContent(nextContent ?? latestContentRef.current);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewContent(content);
    }, previewDebounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [content, previewDebounceMs]);

  useEffect(() => {
    if (mode !== "split" || !workspaceRef.current) {
      return;
    }

    const editor = workspaceRef.current.querySelector<HTMLElement>(".cm-scroller");
    const preview = workspaceRef.current.querySelector<HTMLElement>(".preview-pane");
    if (!editor || !preview) {
      return;
    }
    const editorElement = editor;
    const previewElement = preview;

    let syncSource: "editor" | "preview" | null = null;

    function onEditorScroll() {
      if (syncSource === "preview") {
        return;
      }
      syncSource = "editor";
      const maxScroll = editorElement.scrollHeight - editorElement.clientHeight;
      const ratio = maxScroll > 0 ? editorElement.scrollTop / maxScroll : 0;
      previewElement.scrollTop =
        ratio * (previewElement.scrollHeight - previewElement.clientHeight);
      requestAnimationFrame(() => {
        syncSource = null;
      });
    }

    function onPreviewScroll() {
      if (syncSource === "editor") {
        return;
      }
      syncSource = "preview";
      const maxScroll = previewElement.scrollHeight - previewElement.clientHeight;
      const ratio = maxScroll > 0 ? previewElement.scrollTop / maxScroll : 0;
      editorElement.scrollTop = ratio * (editorElement.scrollHeight - editorElement.clientHeight);
      requestAnimationFrame(() => {
        syncSource = null;
      });
    }

    editorElement.addEventListener("scroll", onEditorScroll);
    previewElement.addEventListener("scroll", onPreviewScroll);
    return () => {
      editorElement.removeEventListener("scroll", onEditorScroll);
      previewElement.removeEventListener("scroll", onPreviewScroll);
    };
  }, [mode, workspaceRef]);

  return {
    previewContent,
    isLargeDocument,
    refreshPreview
  };
}
