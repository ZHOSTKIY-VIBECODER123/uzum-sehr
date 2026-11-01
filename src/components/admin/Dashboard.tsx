"use client";

import { useEffect, useState } from "react";
import { humanError, rpc } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AdminStats } from "@/lib/types";
import { AdminTitle, Notice, Panel } from "./AdminShell";

// Цвета графиков проверены на различимость при нарушениях цветового зрения на фоне #0e1436.
const CHART = { fulfilled: "#d27a1c", booked: "#8f62f2", free: "#3a4066", bar: "#8f62f2" };

function Tile({ label, value, hint, testId }: { label: string; value: string | number; hint?: string; testId?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs font-bold text-mist">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold tabular-nums" data-testid={testId}>{value}</p>
      {hint && <p className="mt-1 text-xs text-haze">{hint}</p>}
    </div>
  );
}

function StatusBar({ stats }: { stats: AdminStats }) {
  const free = Math.max(stats.free, 0);
  const segments = [
    { key: "fulfilled", label: "Подарок передан", value: stats.fulfilled, color: CHART.fulfilled },
    { key: "booked", label: "Забронировано", value: stats.booked, color: CHART.booked },
    { key: "free", label: "Свободно", value: free, color: CHART.free },
  ];
  const total = Math.max(segments.reduce((sum, s) => sum + s.value, 0), 1);
  const [hover, setHover] = useState<string | null>(null);

  return (
    <>
      <div className="flex h-9 gap-0.5 overflow-hidden rounded-lg">
        {segments.filter((s) => s.value > 0).map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.value}`}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            className="transition-opacity"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover && hover !== s.key ? 0.45 : 1 }}
          />
        ))}
      </div>
      <dl className="mt-4 max-w-sm space-y-2">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <dt className="text-mist">{s.label}</dt>
            <dd className="ml-auto font-extrabold tabular-nums">{s.value} <span className="font-medium text-haze">· {Math.round((s.value / total) * 100)}%</span></dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function fillDays(rows: AdminStats["by_day"]) {
  const days = new Map(rows.map((r) => [r.day, r.count]));
  const result: { day: string; count: number }[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
    result.push({ day: key, count: days.get(key) ?? 0 });
  }
  return result;
}

function DailyBars({ rows }: { rows: AdminStats["by_day"] }) {
  const days = fillDays(rows);
  const max = Math.max(...days.map((d) => d.count), 1);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover === null ? null : days[hover];

  return (
    <div>
      <p className="mb-2 h-5 text-sm text-mist" aria-live="polite">
        {active ? <><b className="text-white">{active.count}</b> · {formatDate(active.day)}</> : `Максимум за день: ${max}`}
      </p>
      <div className="relative flex h-40 items-end gap-[2px] border-b border-white/15" onMouseLeave={() => setHover(null)}>
        {days.map((d, i) => (
          <div key={d.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} title={`${formatDate(d.day)}: ${d.count}`}>
            <div
              className="w-full rounded-t-[3px] transition-opacity"
              style={{
                height: d.count ? `${Math.max((d.count / max) * 100, 3)}%` : 0,
                background: CHART.bar,
                opacity: hover !== null && hover !== i ? 0.5 : 1,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-haze">
        <span>{formatDate(days[0].day)}</span>
        <span>{formatDate(days[days.length - 1].day)}</span>
      </div>
      <details className="mt-3 text-sm text-mist">
        <summary className="cursor-pointer font-semibold">Показать таблицей</summary>
        <table className="mt-2 w-full max-w-xs text-left">
          <thead><tr><th scope="col" className="py-1 font-bold">День</th><th scope="col" className="py-1 text-right font-bold">Броней</th></tr></thead>
          <tbody>
            {days.filter((d) => d.count > 0).map((d) => (
              <tr key={d.day} className="border-t border-white/8"><td className="py-1">{formatDate(d.day)}</td><td className="py-1 text-right tabular-nums">{d.count}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rpc<AdminStats>(supabaseBrowser(), "admin_stats").then(setStats).catch((failure) => setError(humanError(failure)));
  }, []);

  if (error) return <Notice kind="error">{error}</Notice>;
  if (!stats) return <p className="py-10 text-center text-mist">Загружаю…</p>;

  const percent = Math.round((stats.fulfilled / stats.target) * 100);
  const litPercent = Math.round(((stats.booked + stats.fulfilled) / stats.target) * 100);

  return (
    <>
      <AdminTitle title="Обзор акции" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Всего загружено" value={stats.total} hint={`цель: ${stats.target}`} testId="stat-total" />
        <Tile label="Свободных" value={stats.free} hint={stats.hidden ? `и скрытых: ${stats.hidden}` : undefined} testId="stat-free" />
        <Tile label="Забронировано" value={stats.booked} testId="stat-booked" />
        <Tile label="Подарков передано" value={stats.fulfilled} testId="stat-fulfilled" />
        <Tile label="Осталось до цели" value={stats.remaining} hint="без брони и подарка" testId="stat-remaining" />
        <Tile label="Выполнение акции" value={`${percent}%`} hint={`с бронями: ${litPercent}%`} testId="stat-percent" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Желания по статусам">
          <StatusBar stats={stats} />
        </Panel>
        <Panel title="Новые брони за 30 дней">
          <DailyBars rows={stats.by_day} />
        </Panel>
      </div>
    </>
  );
}
