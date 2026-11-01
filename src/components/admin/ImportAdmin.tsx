"use client";

import { CheckCircle2, Download, FileUp, XCircle } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";
import { humanError, rpc } from "@/lib/api";
import { normalizeRows, TEMPLATE_CSV, type ImportRow } from "@/lib/import";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { AdminTitle, GhostButton, Notice, Panel, PrimaryButton } from "./AdminShell";

async function readTable(file: File): Promise<unknown[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsx } = await import("read-excel-file/browser");
    const sheets = await readXlsx(file);
    return sheets[0].data as unknown[][];
  }
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  return parsed.data;
}

export function ImportAdmin() {
  const client = supabaseBrowser();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    setRows(null);
    try {
      const table = await readTable(file);
      const firstPass = normalizeRows(table);
      const existing = await rpc<string[]>(client, "admin_check_ward_ids", {
        p_ids: firstPass.rows.map((row) => row.ward_id).filter(Boolean),
      });
      const result = normalizeRows(table, new Set(existing));
      setFileName(file.name);
      setMissing(result.missing);
      setRows(result.rows);
    } catch (failure) {
      setError(`Не удалось прочитать файл. ${humanError(failure)}`);
    } finally {
      setBusy(false);
    }
  };

  const invalid = rows?.filter((row) => row.errors.length > 0).length ?? 0;
  const valid = rows ? rows.length - invalid : 0;

  const submit = async () => {
    if (!rows || invalid > 0 || missing.length > 0) return;
    setBusy(true);
    setError(null);
    try {
      const payload = rows.map((row) => ({
        ward_id: row.ward_id,
        public_name: row.public_name,
        age: Number(row.age),
        city: row.city,
        wish_title: row.wish_title,
        description: row.description,
        photo_public: row.photo_public,
      }));
      const { created } = await rpc<{ created: number }>(client, "admin_import_wishes", { p_rows: payload });
      setDone(created);
      setRows(null);
    } catch (failure) {
      setError(humanError(failure));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "shablon-zhelaniy.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AdminTitle title="Массовая загрузка" hint="Загрузи Excel (.xlsx) или CSV. Сначала покажем предпросмотр и проверим ID, в базу ничего не попадёт до подтверждения.">
        <GhostButton type="button" onClick={downloadTemplate} className="flex items-center gap-1.5"><Download size={15} /> Скачать шаблон</GhostButton>
      </AdminTitle>

      <div className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        {done !== null && <Notice kind="ok">Создано карточек: {done}. Они уже на ёлке.</Notice>}

        <Panel>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/25 px-6 py-10 text-center transition hover:border-lime/60 hover:bg-white/[0.03]">
            <FileUp className="text-lime" />
            <span className="font-bold">{busy ? "Читаю файл…" : "Выбрать файл"}</span>
            <span className="text-xs text-mist">Колонки: ID подопечного, Имя, Возраст, Желание. Необязательные: Город, Описание, Согласие на фото</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv"
              className="sr-only"
              data-testid="import-input"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </Panel>

        {rows && (
          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-extrabold">{fileName}</p>
                <p className="text-sm text-mist" data-testid="import-summary">Готово к загрузке: {valid}, с ошибками: {invalid}</p>
              </div>
              <PrimaryButton type="button" disabled={busy || invalid > 0 || missing.length > 0 || rows.length === 0} onClick={submit}>
                Создать карточки: {valid}
              </PrimaryButton>
            </div>
            {missing.length > 0 && <div className="mb-3"><Notice kind="error">В файле нет обязательных колонок. Сравни заголовки с шаблоном.</Notice></div>}
            {invalid > 0 && <div className="mb-3"><Notice kind="error">Исправь ошибки в файле и загрузи его снова. Импорт идёт только целиком.</Notice></div>}
            <div className="scroll-thin max-h-[56dvh] overflow-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 bg-night-2 text-xs text-mist">
                  <tr>
                    {["Строка", "ID", "Имя", "Возраст", "Город", "Желание", "Фото", "Проверка"].map((title) => (
                      <th key={title} scope="col" className="px-3 py-2.5 font-bold">{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.line} className={`border-t border-white/8 ${row.errors.length ? "bg-red-500/10" : ""}`}>
                      <td className="px-3 py-2 text-mist">{row.line}</td>
                      <td className="px-3 py-2 font-mono text-xs font-bold">{row.ward_id}</td>
                      <td className="px-3 py-2">{row.public_name}</td>
                      <td className="px-3 py-2">{row.age}</td>
                      <td className="px-3 py-2">{row.city}</td>
                      <td className="max-w-52 truncate px-3 py-2">{row.wish_title}</td>
                      <td className="px-3 py-2">{row.photo_public ? "да" : "нет"}</td>
                      <td className="px-3 py-2">
                        {row.errors.length ? (
                          <span className="flex items-start gap-1.5 text-red-200"><XCircle size={15} className="mt-0.5 shrink-0" /> {row.errors.join("; ")}</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-lime"><CheckCircle2 size={15} /> ок</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
