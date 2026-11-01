import { describe, expect, it } from "vitest";
import { normalizeRows } from "../src/lib/import";

const HEADER = ["ID подопечного", "Имя", "Возраст", "Желание", "Согласие на фото"];

describe("разбор файла импорта", () => {
  it("понимает русские заголовки и согласие на фото", () => {
    const { rows, missing } = normalizeRows([HEADER, ["ONA-1", "Амир", 8, "Мяч", "да"]]);
    expect(missing).toEqual([]);
    expect(rows[0]).toMatchObject({ line: 2, ward_id: "ONA-1", public_name: "Амир", age: "8", photo_public: true, errors: [] });
  });

  it("сообщает об отсутствующих колонках", () => {
    expect(normalizeRows([["Имя", "Возраст"]]).missing).toEqual(["ward_id", "wish_title"]);
  });

  it("находит дубли в файле и совпадения с базой", () => {
    const { rows } = normalizeRows(
      [HEADER, ["ONA-1", "А", 8, "Мяч"], ["ONA-1", "Б", 9, "Кукла"], ["ONA-2", "В", 9, "Книга"]],
      new Set(["ONA-2"]),
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toEqual(["ID повторяется в строке 2"]);
    expect(rows[2].errors).toEqual(["такой ID уже есть на сайте"]);
  });

  it("проверяет обязательные поля и возраст, пустые строки пропускает", () => {
    const { rows } = normalizeRows([HEADER, ["", "", "abc", ""], ["", "", "", ""], ["ONA-3", "Г", 99, "Мяч"]]);
    expect(rows).toHaveLength(2);
    expect(rows[0].errors).toEqual(["нет ID", "нет имени", "нет желания", "возраст должен быть числом от 0 до 21"]);
    expect(rows[1].errors).toEqual(["возраст должен быть числом от 0 до 21"]);
  });
});
