import type {
  ApiExam,
  ApiMediaAsset,
  ApiQuestion,
  ApiStudent,
} from "../domain/api";
import type { Exam, Question, Student } from "../domain/models";

const colors = ["#7b61d1", "#e9764a", "#19877a", "#d39b22"];

export function documentText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("content" in value && Array.isArray(value.content)) {
    return value.content.map(documentText).filter(Boolean).join(" ").trim();
  }
  return "";
}

export function textDocument(text: string): Record<string, unknown> {
  return {
    type: "doc",
    content: text.trim()
      ? [
          {
            type: "paragraph",
            content: [{ type: "text", text: text.trim() }],
          },
        ]
      : [],
  };
}

export function questionDocument(
  text: string,
  image?: ApiMediaAsset,
): Record<string, unknown> {
  const document = textDocument(text);
  if (!image) return document;
  return {
    ...document,
    content: [
      ...((document.content as unknown[]) || []),
      {
        type: "image",
        attrs: {
          bucketId: image.bucketId,
          objectPath: image.objectPath,
          mimeType: image.mimeType,
          byteSize: image.byteSize,
          altText: image.altText,
          ...(image.width ? { width: image.width } : {}),
          ...(image.height ? { height: image.height } : {}),
        },
      },
    ],
  };
}

export function htmlText(html: string): string {
  const container = window.document.createElement("div");
  container.innerHTML = html;
  container
    .querySelectorAll("[data-question-image-id]")
    .forEach((element) => element.remove());
  return (container.textContent || "").replace(/\s+/g, " ").trim();
}

type DocumentNode = Record<string, unknown>;

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function documentImages(value: unknown): ApiMediaAsset[] {
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  const own = documentImage(node);
  if (node.type === "image" && own) return [own];
  return Array.isArray(node.content)
    ? node.content.flatMap((child) => documentImages(child))
    : [];
}

export function documentHtml(
  value: unknown,
  imageIds: ReadonlyMap<string, string> = new Map(),
): string {
  if (!value || typeof value !== "object") return "";
  const node = value as Record<string, unknown>;
  const children = () =>
    Array.isArray(node.content)
      ? node.content.map((child) => documentHtml(child, imageIds)).join("")
      : "";
  if (node.type === "doc") return children();
  if (node.type === "text") {
    let result = escapeHtml(node.text);
    const marks = Array.isArray(node.marks) ? node.marks : [];
    for (const mark of marks as Array<Record<string, unknown>>) {
      if (mark.type === "bold") result = `<strong>${result}</strong>`;
      if (mark.type === "italic") result = `<em>${result}</em>`;
      if (mark.type === "underline") result = `<u>${result}</u>`;
    }
    return result;
  }
  if (node.type === "hardBreak") return "<br>";
  if (node.type === "paragraph") return `<p>${children() || "<br>"}</p>`;
  if (node.type === "bulletList") return `<ul>${children()}</ul>`;
  if (node.type === "orderedList") return `<ol>${children()}</ol>`;
  if (node.type === "listItem") return `<li>${children()}</li>`;
  if (node.type === "image") {
    const image = documentImage(node);
    if (!image) return "";
    const id = imageIds.get(image.objectPath) || crypto.randomUUID();
    return `<figure class="wysiwyg-image" data-question-image-id="${escapeHtml(id)}" contenteditable="false"><img src="${escapeHtml(image.url || "")}" alt="${escapeHtml(image.altText)}"><div class="wysiwyg-image-controls"><input data-image-alt="${escapeHtml(id)}" value="${escapeHtml(image.altText)}" maxlength="500" placeholder="Teks alternatif gambar" aria-label="Teks alternatif gambar"><button type="button" data-remove-image="${escapeHtml(id)}" aria-label="Hapus gambar"><span aria-hidden="true">Hapus</span></button></div></figure>`;
  }
  return children();
}

function inlineDocumentNodes(
  node: Node,
  inheritedMarks: Array<{ type: string }> = [],
): DocumentNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    return text
      ? [{ type: "text", text, ...(inheritedMarks.length ? { marks: inheritedMarks } : {}) }]
      : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === "BR") return [{ type: "hardBreak" }];

  const marks = [...inheritedMarks];
  if (["B", "STRONG"].includes(node.tagName)) marks.push({ type: "bold" });
  if (["I", "EM"].includes(node.tagName)) marks.push({ type: "italic" });
  if (node.tagName === "U") marks.push({ type: "underline" });
  if (node.tagName === "SPAN") {
    if (/bold|[6-9]00/.test(node.style.fontWeight)) marks.push({ type: "bold" });
    if (node.style.fontStyle === "italic") marks.push({ type: "italic" });
    if (node.style.textDecoration.includes("underline"))
      marks.push({ type: "underline" });
  }
  return [...node.childNodes].flatMap((child) =>
    inlineDocumentNodes(child, marks),
  );
}

function imageDocumentNode(
  element: HTMLElement,
  mediaById: Record<string, ApiMediaAsset>,
): DocumentNode[] {
  const id = element.dataset.questionImageId;
  const image = id ? mediaById[id] : undefined;
  if (!image) return [];
  const altInput = element.querySelector<HTMLInputElement>("[data-image-alt]");
  return [
    {
      type: "image",
      attrs: {
        bucketId: image.bucketId,
        objectPath: image.objectPath,
        mimeType: image.mimeType,
        byteSize: image.byteSize,
        altText: altInput?.value.trim() || image.altText,
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {}),
      },
    },
  ];
}

function blockDocumentNodes(
  node: Node,
  mediaById: Record<string, ApiMediaAsset>,
): DocumentNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const content = inlineDocumentNodes(node);
    return content.length ? [{ type: "paragraph", content }] : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.matches("figure[data-question-image-id]")) {
    return imageDocumentNode(node, mediaById);
  }
  if (node.tagName === "UL" || node.tagName === "OL") {
    const items = [...node.children]
      .filter((child) => child.tagName === "LI")
      .map((item) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: inlineDocumentNodes(item),
          },
        ],
      }));
    return items.length
      ? [{ type: node.tagName === "UL" ? "bulletList" : "orderedList", content: items }]
      : [];
  }
  const nestedBlocks = [...node.children].some((child) =>
    ["DIV", "P", "UL", "OL", "FIGURE"].includes(child.tagName),
  );
  if (nestedBlocks) {
    return [...node.childNodes].flatMap((child) =>
      blockDocumentNodes(child, mediaById),
    );
  }
  return [{ type: "paragraph", content: inlineDocumentNodes(node) }];
}

export function richTextDocument(
  html: string,
  mediaById: Record<string, ApiMediaAsset> = {},
): Record<string, unknown> {
  const container = window.document.createElement("div");
  container.innerHTML = html;
  return {
    type: "doc",
    content: [...container.childNodes].flatMap((node) =>
      blockDocumentNodes(node, mediaById),
    ),
  };
}

export function documentImage(value: unknown): ApiMediaAsset | undefined {
  if (!value || typeof value !== "object") return undefined;
  const node = value as Record<string, unknown>;
  if (node.type === "image" && node.attrs && typeof node.attrs === "object") {
    const attrs = node.attrs as Record<string, unknown>;
    if (typeof attrs.objectPath !== "string") return undefined;
    return {
      bucketId: "question-media",
      objectPath: attrs.objectPath,
      url: typeof attrs.url === "string" ? attrs.url : undefined,
      mimeType:
        typeof attrs.mimeType === "string" ? attrs.mimeType : "image/jpeg",
      byteSize: Number(attrs.byteSize || 0),
      altText:
        typeof attrs.altText === "string" ? attrs.altText : "Gambar soal",
      width: typeof attrs.width === "number" ? attrs.width : undefined,
      height: typeof attrs.height === "number" ? attrs.height : undefined,
    };
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const image = documentImage(child);
      if (image) return image;
    }
  }
  return undefined;
}

function phaseFor(level: ApiExam["targetLevel"], grades: number[]) {
  if (!level || !grades.length) return "-";
  const phases = grades.map((grade) => {
    if (grade <= 2) return "A";
    if (grade <= 4) return "B";
    if (grade <= 6) return "C";
    if (grade <= 9) return "D";
    if (grade === 10) return "E";
    return "F";
  });
  return [...new Set(phases)].join(", ");
}

export function mapStudent(student: ApiStudent): Student {
  return {
    id: student.id,
    name: student.name,
    code: student.codeHint ? `••••${student.codeHint}` : "Tersimpan",
    level: student.level,
    grade: student.grade,
    className: String(student.grade),
    phase: student.phase,
    status: student.status === "active" ? "Aktif" : "Nonaktif",
    assigned: student.assignmentCount ?? 0,
  };
}

export function mapExam(exam: ApiExam, index = 0): Exam {
  const status = exam.status === "draft"
    ? "Draf"
    : exam.status === "archived" ||
        (exam.assignmentCount > 0 && exam.completedAttemptCount >= exam.assignmentCount)
      ? "Selesai"
      : exam.activeAttemptCount > 0 || exam.completedAttemptCount > 0
        ? "Berlangsung"
        : "Terbit";
  const parts = exam.name.split(/\s+[—–-]\s+/);
  return {
    id: exam.id,
    title: exam.name,
    shortTitle: parts.at(-1) || exam.name,
    subject: parts.length > 1 ? parts[0] : "Ujian",
    description: documentText(exam.descriptionDoc),
    duration: Math.max(1, Math.round(exam.durationSeconds / 60)),
    questions: exam.questionCount,
    participants: exam.assignmentCount,
    status,
    mode:
      exam.gradingMode === "manual_review"
        ? "Koreksi admin"
        : "Nilai langsung",
    color: colors[index % colors.length],
    level: exam.targetLevel || "SMP",
    grades: exam.targetGrades || [],
    phase: phaseFor(exam.targetLevel, exam.targetGrades),
    version: exam.currentVersion,
    averageScore: exam.averageScore,
    activeAttempts: exam.activeAttemptCount,
    completedAttempts: exam.completedAttemptCount,
    allowReattempt: exam.allowReattempt,
    publishedAt:
      exam.status === "published"
        ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
            new Date(exam.updatedAt),
          )
        : undefined,
  };
}

const questionTypes: Record<ApiQuestion["type"], Question["type"]> = {
  multiple_choice: "Pilihan ganda",
  numeric: "Isian angka",
  short_text: "Isian pendek",
  long_text: "Isian panjang",
};

export function mapQuestion(question: ApiQuestion): Question {
  const options = [...(question.options || [])].sort(
    (a, b) => a.position - b.position,
  );
  return {
    id: question.id,
    examId: question.examId,
    type: questionTypes[question.type],
    weight: question.weight,
    prompt: documentText(question.contentDoc),
    options: options.map((option) => documentText(option.contentDoc)),
    answer: options.findIndex((option) => option.isCorrect),
  };
}
