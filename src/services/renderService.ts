import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({
  gfm: true,
  breaks: false,
  async: false
});

function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") {
    return html;
  }

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style"],
    FORBID_ATTR: ["style"]
  });
}

export function renderMarkdown(content: string): string {
  if (!content.trim()) {
    return "<p>Preview will appear here.</p>";
  }
  const rawHtml = marked.parse(content) as string;
  return sanitizeHtml(rawHtml);
}
