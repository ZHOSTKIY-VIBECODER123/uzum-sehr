export type ImportRow = {
  line: number;
  ward_id: string;
  public_name: string;
  age: string;
  city: string;
  wish_title: string;
  description: string;
  photo_public: boolean;
  errors: string[];
};

const ALIASES: Record<string, string> = {
  id: "ward_id",
  "id подопечного": "ward_id",
  ward_id: "ward_id",
  "уникальный id": "ward_id",
  имя: "public_name",
  псевдоним: "public_name",
  "имя/псевдоним": "public_name",
  "имя или псевдоним": "public_name",
  public_name: "public_name",
  name: "public_name",
  возраст: "age",
  age: "age",
  город: "city",
  city: "city",
  желание: "wish_title",
  мечта: "wish_title",
  wish: "wish_title",
  wish_title: "wish_title",
  описание: "description",
  description: "description",
  "согласие на фото": "photo_public",
  "разрешение на фото": "photo_public",
  photo_public: "photo_public",
};

export const TEMPLATE_CSV = "﻿ID подопечного;Имя;Возраст;Город;Желание;Описание;Согласие на фото\nONA-0001;Амир;8;Ташкент;Футбольный мяч;Амир любит спорт и давно мечтает о собственном мяче.;нет\n";

const TRUE_VALUES = new Set(["да", "yes", "true", "1", "+"]);

export function normalizeRows(table: unknown[][], existing: Set<string> = new Set()): { rows: ImportRow[]; missing: string[] } {
  const [header = [], ...data] = table;
  const columns = header.map((cell) => ALIASES[String(cell ?? "").replace(/^﻿/, "").trim().toLowerCase()]);
  const required = ["ward_id", "public_name", "age", "wish_title"];
  const missing = required.filter((name) => !columns.includes(name));

  const seen = new Map<string, number>();
  const rows: ImportRow[] = [];

  data.forEach((cells, index) => {
    if (cells.every((cell) => String(cell ?? "").trim() === "")) return;
    const value = (name: string) => {
      const position = columns.indexOf(name);
      return position < 0 ? "" : String(cells[position] ?? "").trim();
    };
    const row: ImportRow = {
      line: index + 2,
      ward_id: value("ward_id"),
      public_name: value("public_name"),
      age: value("age"),
      city: value("city"),
      wish_title: value("wish_title"),
      description: value("description"),
      photo_public: TRUE_VALUES.has(value("photo_public").toLowerCase()),
      errors: [],
    };
    if (!row.ward_id) row.errors.push("нет ID");
    if (!row.public_name) row.errors.push("нет имени");
    if (!row.wish_title) row.errors.push("нет желания");
    const age = Number(row.age);
    if (row.age === "" || !Number.isInteger(age) || age < 0 || age > 21) row.errors.push("возраст должен быть числом от 0 до 21");
    if (row.ward_id) {
      const duplicate = seen.get(row.ward_id);
      if (duplicate) row.errors.push(`ID повторяется в строке ${duplicate}`);
      else seen.set(row.ward_id, row.line);
      if (existing.has(row.ward_id)) row.errors.push("такой ID уже есть на сайте");
    }
    rows.push(row);
  });

  return { rows, missing };
}
