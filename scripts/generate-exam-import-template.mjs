import fs from "node:fs/promises";
import path from "node:path";
import writeExcelFile from "write-excel-file/node";

const headers = [
  "No",
  "Tipe Soal",
  "Pertanyaan",
  "Pilihan A",
  "Pilihan B",
  "Pilihan C",
  "Pilihan D",
  "Pilihan E",
  "Pilihan F",
  "Pilihan G",
  "Pilihan H",
  "Jawaban Benar",
  "Bobot",
];

const headerCell = (value) => ({
  value,
  fontWeight: "bold",
  textColor: "#FFFFFF",
  backgroundColor: "#167D73",
  borderColor: "#C7D8D5",
  borderStyle: "thin",
  align: "center",
  alignVertical: "center",
  wrap: true,
  height: 34,
});

const emptyCell = () => ({
  value: null,
  borderColor: "#DDE7E5",
  borderStyle: "thin",
  alignVertical: "top",
  wrap: true,
  height: 30,
});

const questionData = [
  headers.map(headerCell),
  ...Array.from({ length: 25 }, () => headers.map(emptyCell)),
];

const note = (value, options = {}) => ({
  value,
  wrap: true,
  alignVertical: "top",
  borderColor: "#DDE7E5",
  borderStyle: "thin",
  ...options,
});

const guideData = [
  [
    note("Template Import Soal RuangUji", {
      columnSpan: 4,
      fontWeight: "bold",
      fontSize: 18,
      textColor: "#FFFFFF",
      backgroundColor: "#173F3B",
      height: 38,
    }),
    null,
    null,
    null,
  ],
  [
    note("Isi soal hanya pada sheet “Soal”. Jangan mengubah nama header. Satu baris mewakili satu soal.", {
      columnSpan: 4,
      backgroundColor: "#EAF5F3",
      height: 34,
    }),
    null,
    null,
    null,
  ],
  [null, null, null, null],
  ["Kolom", "Wajib", "Format yang diterima", "Keterangan"].map(headerCell),
  [note("Tipe Soal"), note("Ya"), note("Pilihan ganda / Isian angka / Isian pendek / Isian panjang"), note("Isian panjang hanya dapat dipakai pada mode Koreksi admin.")],
  [note("Pertanyaan"), note("Ya"), note("Teks biasa"), note("Baris baru di dalam sel akan dipertahankan sebagai paragraf.")],
  [note("Pilihan A–H"), note("Untuk pilihan ganda"), note("Minimal Pilihan A dan B; maksimal H"), note("Jangan memberi celah, misalnya mengisi D saat C kosong.")],
  [note("Jawaban Benar"), note("Ya, kecuali isian panjang"), note("A–H untuk pilihan ganda; teks/angka untuk isian"), note("Untuk pilihan ganda juga boleh menulis isi opsi yang benar.")],
  [note("Bobot"), note("Tidak"), note("Angka lebih dari 0"), note("Kosong berarti bobot 1.")],
  [null, null, null, null],
  [
    note("Contoh pengisian", {
      columnSpan: 4,
      fontWeight: "bold",
      backgroundColor: "#F1EDFB",
    }),
    null,
    null,
    null,
  ],
  ["Tipe Soal", "Pertanyaan", "Pilihan/Jawaban", "Bobot"].map(headerCell),
  [note("Pilihan ganda"), note("Ibu kota Indonesia adalah ..."), note("A: Bandung | B: Jakarta | Jawaban: B"), note(1)],
  [note("Isian angka"), note("Hasil 12 × 3 adalah ..."), note("Jawaban: 36"), note(2)],
  [note("Isian pendek"), note("Planet tempat manusia tinggal adalah ..."), note("Jawaban: Bumi"), note(1)],
  [note("Isian panjang"), note("Jelaskan proses fotosintesis."), note("Tidak memakai jawaban benar; dikoreksi admin."), note(3)],
];

const outputDirectory = path.resolve("public", "templates");
await fs.mkdir(outputDirectory, { recursive: true });
await writeExcelFile(
  [
    {
      data: questionData,
      sheet: "Soal",
      columns: [
        { width: 7 },
        { width: 20 },
        { width: 48 },
        ...Array.from({ length: 8 }, () => ({ width: 24 })),
        { width: 22 },
        { width: 10 },
      ],
      stickyRowsCount: 1,
      stickyColumnsCount: 3,
      showGridLines: false,
      orientation: "landscape",
      zoomScale: 0.85,
    },
    {
      data: guideData,
      sheet: "Petunjuk",
      columns: [{ width: 24 }, { width: 18 }, { width: 46 }, { width: 54 }],
      stickyRowsCount: 4,
      showGridLines: false,
      zoomScale: 0.95,
    },
  ],
  undefined,
  { fontFamily: "Calibri", fontSize: 11 },
).toFile(path.join(outputDirectory, "template-import-soal-ruanguji.xlsx"));

console.log("Template Excel berhasil dibuat di public/templates/template-import-soal-ruanguji.xlsx");
