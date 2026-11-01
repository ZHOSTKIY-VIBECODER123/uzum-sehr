"use client";

import { FlaskConical, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { resetAndReload } from "./DemoGate";

export function DemoBanner() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[78px] left-3 z-30 flex items-center gap-1.5 rounded-full border border-white/20 bg-night/85 px-3 py-1.5 text-xs font-bold backdrop-blur md:bottom-6 md:left-8"
      >
        <FlaskConical size={14} className="text-lime" /> Демо
      </button>
    );
  }

  return (
    <div role="dialog" aria-label="О демо-версии" className="fixed bottom-[78px] left-3 z-30 w-[300px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/20 bg-night/95 p-4 text-sm backdrop-blur md:bottom-6 md:left-8">
      <div className="flex items-start justify-between gap-2">
        <p className="font-extrabold">Это демо-версия</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" className="text-mist hover:text-white"><X size={16} /></button>
      </div>
      <ul className="mt-2 space-y-1.5 text-mist">
        <li>Дети и желания вымышленные.</li>
        <li>Всё хранится только в этом браузере: у коллег своя копия ёлки.</li>
        <li>Вход: любая почта, код <b className="text-white">000000</b>. Письма не отправляются.</li>
        <li>Админка: почта <b className="text-white">admin@example.com</b>.</li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/admin" onClick={() => setOpen(false)} className="rounded-xl bg-lime px-3 py-1.5 text-xs font-extrabold text-ink">Открыть админку</Link>
        <button type="button" onClick={resetAndReload} className="flex items-center gap-1.5 rounded-xl border border-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/10">
          <RotateCcw size={13} /> Сбросить демо
        </button>
      </div>
    </div>
  );
}
