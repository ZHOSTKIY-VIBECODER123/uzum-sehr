"use client";

import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { SlackIcon } from "@/components/site/ContactCard";
import { humanError, rpc } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Contact } from "@/lib/types";
import { AdminTitle, GhostButton, Notice } from "./AdminShell";

type Draft = Omit<Contact, "id"> & { id: string; isNew?: boolean };

export function ContactsAdmin({ initial }: { initial: Contact[] }) {
  const client = supabaseBrowser();
  const [items, setItems] = useState<Draft[]>(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const run = async (action: () => Promise<void>, ok: string) => {
    setMessage(null);
    try {
      await action();
      setMessage({ kind: "ok", text: ok });
    } catch (failure) {
      setMessage({ kind: "error", text: humanError(failure) });
    }
  };

  const patch = (id: string, change: Partial<Draft>) =>
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...change } : item)));

  const save = (item: Draft) =>
    run(async () => {
      const result = await rpc<{ id: string }>(client, "admin_save_contact", {
        p: { id: item.isNew ? null : item.id, slack_handle: item.slack_handle, label: item.label, slack_url: item.slack_url },
      });
      patch(item.id, { id: result.id, isNew: false });
    }, "Контакт сохранён");

  const remove = (item: Draft) =>
    run(async () => {
      if (!item.isNew) await rpc(client, "admin_delete_contact", { p_id: item.id });
      setItems((list) => list.filter((other) => other.id !== item.id));
    }, "Контакт удалён");

  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setItems(next);
    run(async () => {
      await rpc(client, "admin_reorder_contacts", { p_ids: next.filter((c) => !c.isNew).map((c) => c.id) });
    }, "Порядок сохранён");
  };

  return (
    <>
      <AdminTitle title="Контакты" hint="Показываются на странице «Контакты» в этом порядке.">
        <GhostButton
          type="button"
          className="flex items-center gap-1.5"
          onClick={() => setItems((list) => [...list, { id: crypto.randomUUID(), slack_handle: "", label: "", slack_url: null, sort_order: list.length + 1, isNew: true }])}
        >
          <Plus size={15} /> Добавить контакт
        </GhostButton>
      </AdminTitle>

      {message && <div className="mb-4"><Notice kind={message.kind}>{message.text}</Notice></div>}

      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white"><SlackIcon size={20} /></span>
            <input aria-label="Имя пользователя Slack" data-testid="contact-handle" placeholder="имя в Slack" className="admin-input min-w-40 flex-1 font-semibold" value={item.slack_handle} onChange={(e) => patch(item.id, { slack_handle: e.target.value })} />
            <input aria-label="Подпись" placeholder="подпись" className="admin-input min-w-40 flex-1" value={item.label} onChange={(e) => patch(item.id, { label: e.target.value })} />
            <input aria-label="Ссылка на профиль Slack" placeholder="ссылка на Slack (необязательно)" className="admin-input min-w-52 flex-[1.3]" value={item.slack_url ?? ""} onChange={(e) => patch(item.id, { slack_url: e.target.value || null })} />
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Сохранить" disabled={!item.slack_handle.trim()} onClick={() => save(item)} className="grid h-9 w-9 place-items-center rounded-lg bg-lime text-ink transition hover:bg-lime-soft disabled:opacity-40"><Save size={16} /></button>
              <button type="button" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)} className="grid h-9 w-9 place-items-center rounded-lg text-mist hover:bg-white/10 disabled:opacity-30"><ArrowUp size={16} /></button>
              <button type="button" aria-label="Ниже" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="grid h-9 w-9 place-items-center rounded-lg text-mist hover:bg-white/10 disabled:opacity-30"><ArrowDown size={16} /></button>
              <button type="button" aria-label="Удалить" onClick={() => remove(item)} className="grid h-9 w-9 place-items-center rounded-lg text-mist hover:bg-white/10 hover:text-red-300"><Trash2 size={16} /></button>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
