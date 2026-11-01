"use client";

import { useCallback, useEffect, useState } from "react";
import { humanError, rpc } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AuditRow } from "@/lib/types";
import { AdminTitle, GhostButton, Notice } from "./AdminShell";

const PAGE = 100;

const ACTIONS: Record<string, string> = {
  "booking.created": "Бронирование",
  "booking.expired": "Бронь истекла",
  "wish.created": "Желание создано",
  "wish.updated": "Желание изменено",
  "wish.deleted": "Желание удалено",
  "wish.imported": "Импорт желаний",
  "wish.status_changed": "Смена статуса",
  "wish.hidden": "Желание скрыто",
  "wish.shown": "Желание показано",
  "media.added": "Файл добавлен",
  "media.removed": "Файл удалён",
  "settings.updated": "Настройки изменены",
  "contact.created": "Контакт создан",
  "contact.updated": "Контакт изменён",
  "contact.deleted": "Контакт удалён",
  "contact.reordered": "Порядок контактов",
  "admin.changed": "Изменение прав",
  "data.exported": "Выгрузка данных",
};

function describe(row: AuditRow): string {
  const d = row.details as Record<string, unknown>;
  const parts: string[] = [];
  if (d.ward_id) parts.push(String(d.ward_id));
  if (d.from || d.to) parts.push(`${d.from} → ${d.to}`);
  if (d.reason) parts.push(`причина: ${d.reason}`);
  if (d.count !== undefined) parts.push(`создано: ${d.count}`);
  if (d.role !== undefined) parts.push(`${row.entity_id}: ${d.role ?? "права сняты"}`);
  if (row.entity === "settings") parts.push(`раздел ${row.entity_id}`);
  if (d.slack_handle) parts.push(String(d.slack_handle));
  return parts.join(" · ");
}

export function LogAdmin() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (from: number) => {
    try {
      const result = await rpc<{ total: number; rows: AuditRow[] }>(supabaseBrowser(), "admin_list_audit", { p_limit: PAGE, p_offset: from });
      setRows(result.rows);
      setTotal(result.total);
      setOffset(from);
    } catch (failure) {
      setError(humanError(failure));
    }
  }, []);

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <>
      <AdminTitle title="Журнал действий" hint={`Всего записей: ${total}. Записи нельзя изменить или удалить через сайт.`} />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}
      <div className="scroll-thin overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/[0.04] text-xs text-mist">
            <tr>
              {["Когда", "Кто", "Действие", "Подробности"].map((title) => <th key={title} scope="col" className="px-4 py-3 font-bold">{title}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/8" data-testid="audit-row">
                <td className="whitespace-nowrap px-4 py-2.5 text-mist">{formatDateTime(row.at)}</td>
                <td className="px-4 py-2.5">{row.actor_email ?? "система"}</td>
                <td className="px-4 py-2.5 font-semibold">{ACTIONS[row.action] ?? row.action}</td>
                <td className="px-4 py-2.5 text-mist">{describe(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <GhostButton type="button" disabled={offset === 0} onClick={() => load(Math.max(0, offset - PAGE))}>Новее</GhostButton>
        <GhostButton type="button" disabled={offset + PAGE >= total} onClick={() => load(offset + PAGE)}>Старше</GhostButton>
      </div>
    </>
  );
}
