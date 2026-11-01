"use client";

import { ArrowDown, ArrowUp, EyeOff, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { humanError, rpc } from "@/lib/api";
import { formatDateTime, STATUS_LABEL } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AdminWish, WishStatus } from "@/lib/types";
import { AdminTitle, Notice, PrimaryButton } from "./AdminShell";
import { WishEditor } from "./WishEditor";

type SortKey = "ward_id" | "name" | "age" | "wish_title" | "status" | "booked_by" | "booked_at";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "ward_id", label: "ID подопечного" },
  { key: "name", label: "Имя" },
  { key: "age", label: "Возраст" },
  { key: "wish_title", label: "Желание" },
  { key: "status", label: "Статус" },
  { key: "booked_by", label: "Забронировал" },
  { key: "booked_at", label: "Дата брони" },
];

export function StatusBadge({ status, hidden }: { status: WishStatus; hidden?: boolean }) {
  const tone = { free: "bg-white/10 text-mist", booked: "bg-lime/15 text-lime", fulfilled: "bg-warm/15 text-warm" }[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{STATUS_LABEL[status]}</span>
      {hidden && <EyeOff size={14} className="text-haze" aria-label="Скрыто" />}
    </span>
  );
}

export function WishesAdmin() {
  const [rows, setRows] = useState<AdminWish[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | WishStatus | "hidden">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "ward_id", dir: 1 });
  const [editing, setEditing] = useState<AdminWish | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await rpc<AdminWish[]>(supabaseBrowser(), "admin_list_wishes"));
    } catch (failure) {
      setError(humanError(failure));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (status === "hidden") {
          if (!row.hidden) return false;
        } else if (status !== "all" && row.status !== status) return false;
        if (!q) return true;
        return [row.ward_id, row.name, row.wish_title, row.booked_by, row.booked_by_name, row.city]
          .some((value) => value?.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const left = a[sort.key];
        const right = b[sort.key];
        if (left === right) return 0;
        if (left === null) return 1;
        if (right === null) return -1;
        if (typeof left === "number" && typeof right === "number") return (left - right) * sort.dir;
        return String(left).localeCompare(String(right), "ru", { numeric: true }) * sort.dir;
      });
  }, [rows, query, status, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) => (current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const current = editing === "new" ? "new" : editing ? (rows?.find((r) => r.id === editing.id) ?? editing) : null;

  return (
    <>
      <AdminTitle title="Желания" hint={rows ? `Всего: ${rows.length}, показано: ${visible.length}` : undefined}>
        <PrimaryButton type="button" onClick={() => setEditing("new")} className="flex items-center gap-1.5">
          <Plus size={16} /> Добавить желание
        </PrimaryButton>
      </AdminTitle>

      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-haze" />
          <input
            aria-label="Поиск"
            className="admin-input pl-9"
            placeholder="ID, имя, желание, почта"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select aria-label="Фильтр по статусу" className="admin-input w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Все статусы</option>
          <option value="free">{STATUS_LABEL.free}</option>
          <option value="booked">{STATUS_LABEL.booked}</option>
          <option value="fulfilled">{STATUS_LABEL.fulfilled}</option>
          <option value="hidden">Скрытые</option>
        </select>
      </div>

      <div className="scroll-thin overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-white/[0.04] text-xs text-mist">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key} scope="col" aria-sort={sort.key === column.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className="px-4 py-3 font-bold">
                  <button type="button" onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-1 hover:text-white">
                    {column.label}
                    {sort.key === column.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} onClick={() => setEditing(row)} className="cursor-pointer border-t border-white/8 transition hover:bg-white/[0.05]">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(row); }} className="hover:text-lime">{row.ward_id}</button>
                </td>
                <td className="px-4 py-3 font-semibold">{row.name}</td>
                <td className="px-4 py-3 tabular-nums">{row.age}</td>
                <td className="max-w-64 truncate px-4 py-3">{row.wish_title}</td>
                <td className="px-4 py-3"><StatusBadge status={row.status} hidden={row.hidden} /></td>
                <td className="px-4 py-3 text-mist">{row.booked_by ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-mist">{formatDateTime(row.booked_at)}</td>
              </tr>
            ))}
            {rows && visible.length === 0 && (
              <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-mist">Ничего не найдено</td></tr>
            )}
            {!rows && !error && (
              <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-mist">Загружаю…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {current && (
        <WishEditor
          key={current === "new" ? "new" : current.id}
          wish={current === "new" ? null : current}
          onClose={() => setEditing(null)}
          onChanged={load}
          onCreated={(wish) => {
            load();
            setEditing(wish);
          }}
        />
      )}
    </>
  );
}
