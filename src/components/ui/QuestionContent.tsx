import type { ReactNode } from "react";

type NodeValue = Record<string, unknown>;

function renderNode(value: unknown, key: string): ReactNode {
  if (!value || typeof value !== "object") return null;
  const node = value as NodeValue;
  const content = Array.isArray(node.content) ? node.content : [];
  const children = content.map((child, index) =>
    renderNode(child, `${key}-${index}`),
  );

  if (node.type === "text") {
    let result: ReactNode = String(node.text ?? "");
    const marks = Array.isArray(node.marks) ? node.marks : [];
    for (const mark of marks) {
      const type = (mark as NodeValue).type;
      if (type === "bold") result = <strong>{result}</strong>;
      if (type === "italic") result = <em>{result}</em>;
      if (type === "underline") result = <u>{result}</u>;
    }
    return <span key={key}>{result}</span>;
  }
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "paragraph") return <p key={key}>{children}</p>;
  if (node.type === "bulletList") return <ul key={key}>{children}</ul>;
  if (node.type === "orderedList") return <ol key={key}>{children}</ol>;
  if (node.type === "listItem") return <li key={key}>{children}</li>;
  if (node.type === "image") {
    const attrs = (node.attrs || {}) as NodeValue;
    if (typeof attrs.url !== "string") return null;
    return (
      <figure className="question-content-media" key={key}>
        <img src={attrs.url} alt={String(attrs.altText || "Gambar soal")} />
      </figure>
    );
  }
  return <span key={key}>{children}</span>;
}

export function QuestionContent({
  document,
  className = "",
}: {
  document: Record<string, unknown>;
  className?: string;
}) {
  const content = Array.isArray(document.content) ? document.content : [];
  return (
    <div className={`rich-question-content ${className}`.trim()}>
      {content.map((node, index) => renderNode(node, String(index)))}
    </div>
  );
}
