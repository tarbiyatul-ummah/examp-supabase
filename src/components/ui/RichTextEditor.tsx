import {
  Bold,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Underline,
} from "lucide-react";
import {
  type ClipboardEvent,
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export type RichTextDraftImage = {
  id: string;
  file?: File;
  previewUrl: string;
  altText: string;
  width?: number;
  height?: number;
};

type Props = {
  value: string;
  images: RichTextDraftImage[];
  onChange: (value: string, images: RichTextDraftImage[]) => void;
  onToast: (message: string) => void;
  onPreviewCreated: (url: string) => void;
  onPreviewRemoved: (image: RichTextDraftImage) => void;
};

const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function imageSize(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = url;
  });
}

export function RichTextEditor({
  value,
  images,
  onChange,
  onToast,
  onPreviewCreated,
  onPreviewRemoved,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  const updateToolbar = () => {
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      unordered: document.queryCommandState("insertUnorderedList"),
      ordered: document.queryCommandState("insertOrderedList"),
    });
  };

  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (
      editor &&
      selection?.rangeCount &&
      editor.contains(selection.anchorNode)
    ) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const emitChange = (nextImages = images) => {
    const editor = editorRef.current;
    if (!editor) return;
    const syncedImages = nextImages.map((image) => {
      const input = editor.querySelector<HTMLInputElement>(
        `[data-image-alt="${image.id}"]`,
      );
      return input ? { ...image, altText: input.value } : image;
    });
    onChange(editor.innerHTML, syncedImages);
    updateToolbar();
  };

  const runCommand = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitChange();
  };

  const toolbarMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    rememberSelection();
  };

  const insertNodeAtSelection = (node: Node) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = savedRange.current;
    if (selection && range && editor.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.append(node);
    }
    const trailingParagraph = document.createElement("p");
    trailingParagraph.append(document.createElement("br"));
    node.parentNode?.insertBefore(trailingParagraph, node.nextSibling);
    const nextRange = document.createRange();
    nextRange.selectNodeContents(trailingParagraph);
    nextRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
    savedRange.current = nextRange.cloneRange();
  };

  const selectImage = async (file?: File) => {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      onToast("Format gambar harus JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onToast("Gambar tidak boleh lebih dari 2,5 MB.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    try {
      const size = await imageSize(previewUrl);
      const image: RichTextDraftImage = {
        id: crypto.randomUUID(),
        file,
        previewUrl,
        altText: file.name.replace(/\.[^.]+$/, ""),
        ...size,
      };
      onPreviewCreated(previewUrl);
      const figure = document.createElement("figure");
      figure.className = "wysiwyg-image";
      figure.dataset.questionImageId = image.id;
      figure.contentEditable = "false";
      const imageElement = document.createElement("img");
      imageElement.src = previewUrl;
      imageElement.alt = image.altText;
      const controls = document.createElement("div");
      controls.className = "wysiwyg-image-controls";
      const altInput = document.createElement("input");
      altInput.dataset.imageAlt = image.id;
      altInput.value = image.altText;
      altInput.setAttribute("value", image.altText);
      altInput.maxLength = 500;
      altInput.placeholder = "Teks alternatif gambar";
      altInput.setAttribute("aria-label", "Teks alternatif gambar");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.removeImage = image.id;
      remove.setAttribute("aria-label", "Hapus gambar");
      remove.innerHTML = '<span aria-hidden="true">Hapus</span>';
      controls.append(altInput, remove);
      figure.append(imageElement, controls);
      insertNodeAtSelection(figure);
      emitChange([...images, image]);
    } catch {
      URL.revokeObjectURL(previewUrl);
      onToast("Gambar tidak dapat dibaca. Pilih file lain.");
    }
  };

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target as HTMLInputElement;
    if (target.matches?.("[data-image-alt]")) {
      target.setAttribute("value", target.value);
      const id = target.dataset.imageAlt;
      const image = editorRef.current?.querySelector<HTMLImageElement>(
        `[data-question-image-id="${id}"] img`,
      );
      if (image) image.alt = target.value;
    }
    emitChange();
  };

  const handleEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-remove-image]",
    );
    if (!target) return;
    event.preventDefault();
    const id = target.dataset.removeImage;
    const removed = images.find((image) => image.id === id);
    target.closest("[data-question-image-id]")?.remove();
    if (removed) onPreviewRemoved(removed);
    emitChange(images.filter((image) => image.id !== id));
  };

  const pastePlainText = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    document.execCommand(
      "insertText",
      false,
      event.clipboardData.getData("text/plain"),
    );
  };

  const buttons = [
    { command: "bold", label: "Tebal", icon: <Bold /> },
    { command: "italic", label: "Miring", icon: <Italic /> },
    { command: "underline", label: "Garis bawah", icon: <Underline /> },
    { command: "insertUnorderedList", state: "unordered", label: "Daftar poin", icon: <List /> },
    { command: "insertOrderedList", state: "ordered", label: "Daftar nomor", icon: <ListOrdered /> },
  ];

  return (
    <div className="wysiwyg-editor">
      <div className="wysiwyg-toolbar" role="toolbar" aria-label="Format isi soal">
        <div className="wysiwyg-format-buttons">
          {buttons.map((button) => (
            <button
              key={button.command}
              type="button"
              className={active[button.state || button.command] ? "active" : ""}
              aria-label={button.label}
              title={button.label}
              aria-pressed={Boolean(active[button.state || button.command])}
              onMouseDown={toolbarMouseDown}
              onClick={() => runCommand(button.command)}
            >
              {button.icon}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button secondary wysiwyg-image-button"
          onMouseDown={(event) => {
            toolbarMouseDown(event);
            rememberSelection();
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus /> Sisipkan gambar
        </button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            void selectImage(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      <div
        ref={editorRef}
        className="wysiwyg-content"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder="Tulis pertanyaan di sini..."
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={handleEditorClick}
        onKeyUp={() => {
          rememberSelection();
          updateToolbar();
        }}
        onMouseUp={() => {
          rememberSelection();
          updateToolbar();
        }}
        onBlur={rememberSelection}
        onPaste={pastePlainText}
      />
      <div className="wysiwyg-footer">
        <span>JPG, PNG, atau WebP · maksimal 2,5 MB.</span>
        <span>{images.length} gambar</span>
      </div>
    </div>
  );
}
