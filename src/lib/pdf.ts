function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[•·]/g, "-")
    .replace(/[—–]/g, "-")
    .replace(/[^\x20-\x7E]/g, "?");
}

function escapePdf(value: string) {
  return value.replace(/([\\()])/g, "\\$1");
}

function fit(value: unknown, width: number) {
  const text = ascii(value).replace(/\s+/g, " ").trim();
  if (text.length <= width) return text.padEnd(width);
  return `${text.slice(0, Math.max(1, width - 1))}.`;
}

export function downloadTablePdf({
  filename,
  title,
  headers,
  rows,
  widths,
}: {
  filename: string;
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  widths?: number[];
}) {
  const available = 94 - Math.max(0, headers.length - 1) * 3;
  const fallbackWidth = Math.max(8, Math.floor(available / headers.length));
  const columnWidths = headers.map(
    (_, index) => widths?.[index] ?? fallbackWidth,
  );
  const tableLine = (cells: Array<string | number>) =>
    cells.map((cell, index) => fit(cell, columnWidths[index])).join(" | ");
  const separator = columnWidths.map((width) => "-".repeat(width)).join("-+-");
  const lines = [
    ascii(title),
    `Dibuat: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`,
    "",
    tableLine(headers),
    separator,
    ...rows.map(tableLine),
  ];

  const linesPerPage = 52;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += linesPerPage) {
    pages.push(lines.slice(index, index + linesPerPage));
  }
  if (!pages.length) pages.push([ascii(title), "Tidak ada data."]);

  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = [
      "BT",
      "/F1 8 Tf",
      "36 806 Td",
      "13 TL",
      ...pageLines.flatMap((line) => [`(${escapePdf(line)}) Tj`, "T*"]),
      "ET",
    ].join("\n");
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] =
      `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  });

  const encoder = new TextEncoder();
  let pdf = "%PDF-1.4\n%RuangUji\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([encoder.encode(pdf)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
