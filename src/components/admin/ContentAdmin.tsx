"use client";

import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { humanError, rpc } from "@/lib/api";
import { STATIC_DEMO, supabaseBrowser } from "@/lib/supabase/browser";
import type { Banner, HowStep, Settings } from "@/lib/types";
import { AdminTitle, Field, GhostButton, Notice, Panel, PrimaryButton } from "./AdminShell";

function useSaver<K extends keyof Settings>(key: K, initial: Settings[K]) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (next: Settings[K] = value) => {
    setBusy(true);
    setState(null);
    try {
      await rpc(supabaseBrowser(), "admin_save_setting", { p_key: key, p_value: next });
      setState({ kind: "ok", text: "Сохранено. На сайте уже обновилось." });
    } catch (failure) {
      setState({ kind: "error", text: humanError(failure) });
    } finally {
      setBusy(false);
    }
  };
  return { value, setValue, state, busy, save };
}

function SaveRow({ saver }: { saver: { state: { kind: "ok" | "error"; text: string } | null; busy: boolean; save: () => void } }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <PrimaryButton type="button" disabled={saver.busy} onClick={() => saver.save()}>Сохранить</PrimaryButton>
      {saver.state && <Notice kind={saver.state.kind}>{saver.state.text}</Notice>}
    </div>
  );
}

export function ContentAdmin({ initial }: { initial: Settings }) {
  const general = useSaver("general", initial.general);
  const about = useSaver("about", initial.about);
  const how = useSaver("how", initial.how);
  const contactsPage = useSaver("contacts_page", initial.contacts_page);
  const tree = useSaver("tree", initial.tree);
  const messages = useSaver("messages", initial.messages);
  const banners = useSaver("banners", initial.banners);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const setStep = (index: number, patch: Partial<HowStep>) =>
    how.setValue({ ...how.value, steps: how.value.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)) });
  const moveStep = (index: number, delta: number) => {
    const steps = [...how.value.steps];
    const [step] = steps.splice(index, 1);
    steps.splice(index + delta, 0, step);
    how.setValue({ ...how.value, steps });
  };

  const addBanner = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    const client = supabaseBrowser();
    const path = `banners/${crypto.randomUUID()}-${file.name.replace(/[^\w.]+/g, "_")}`;
    const { error } = await client.storage.from("site-assets").upload(path, file, { contentType: file.type });
    if (error) {
      setUploadError(error.message);
      return;
    }
    // В демо файл не лежит на сервере, поэтому картинка хранится прямо в настройке.
    const url = STATIC_DEMO
      ? await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        })
      : client.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
    const next = { items: [...banners.value.items, { url, title: file.name.replace(/\.\w+$/, "") }] };
    banners.setValue(next);
    await banners.save(next);
  };

  const removeBanner = (item: Banner) => {
    const next = { items: banners.value.items.filter((b) => b.url !== item.url) };
    banners.setValue(next);
    banners.save(next);
  };

  const t = tree.value;
  const counter = t.counter;

  return (
    <>
      <AdminTitle title="Контент и настройки" hint="Изменения появляются на сайте сразу после сохранения." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Главная страница">
          <div className="space-y-3">
            <Field label="Название проекта"><input data-testid="project-title" className="admin-input" value={general.value.project_title} onChange={(e) => general.setValue({ ...general.value, project_title: e.target.value })} /></Field>
            <Field label="Заголовок" hint="Перенос строки сохраняется"><textarea data-testid="hero-title" rows={2} className="admin-input" value={general.value.hero_title} onChange={(e) => general.setValue({ ...general.value, hero_title: e.target.value })} /></Field>
            <Field label="Подзаголовок"><textarea rows={3} className="admin-input" value={general.value.hero_subtitle} onChange={(e) => general.setValue({ ...general.value, hero_subtitle: e.target.value })} /></Field>
          </div>
          <SaveRow saver={general} />
        </Panel>

        <Panel title="Ёлка и бронирование">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Цель, желаний"><input type="number" min={1} max={1000} className="admin-input" value={t.target_wishes} onChange={(e) => tree.setValue({ ...t, target_wishes: Number(e.target.value) })} /></Field>
            <Field label="Срок брони, часов" hint="0 — без срока"><input data-testid="booking-hours" type="number" min={0} className="admin-input" value={t.booking_hours} onChange={(e) => tree.setValue({ ...t, booking_hours: Number(e.target.value) })} /></Field>
            <Field label="Лимит на человека" hint="0 — без лимита"><input type="number" min={0} className="admin-input" value={t.max_bookings_per_user} onChange={(e) => tree.setValue({ ...t, max_bookings_per_user: Number(e.target.value) })} /></Field>
          </div>
          <label className="mt-4 flex items-center gap-2.5 text-sm font-semibold">
            <input data-testid="booking-paused" type="checkbox" className="accent-lime" checked={t.booking_paused} onChange={(e) => tree.setValue({ ...t, booking_paused: e.target.checked })} />
            Приостановить бронирование
          </label>
          <div className="mt-3"><Field label="Сообщение на паузе"><input className="admin-input" value={t.pause_message} onChange={(e) => tree.setValue({ ...t, pause_message: e.target.value })} /></Field></div>

          <h3 className="mb-2 mt-5 text-sm font-extrabold">Счётчик на главной</h3>
          <Field label="Подпись"><input className="admin-input" value={counter.label} onChange={(e) => tree.setValue({ ...t, counter: { ...counter, label: e.target.value } })} /></Field>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-lime" checked={counter.show_progress} onChange={(e) => tree.setValue({ ...t, counter: { ...counter, show_progress: e.target.checked } })} /> Шкала прогресса</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-lime" checked={counter.show_gifts} onChange={(e) => tree.setValue({ ...t, counter: { ...counter, show_gifts: e.target.checked } })} /> Переданные подарки</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-lime" checked={counter.show_free} onChange={(e) => tree.setValue({ ...t, counter: { ...counter, show_free: e.target.checked } })} /> Свободные желания</label>
          </div>
          <SaveRow saver={tree} />
        </Panel>

        <Panel title="О проекте">
          <Field label="Заголовок"><input className="admin-input" value={about.value.title} onChange={(e) => about.setValue({ ...about.value, title: e.target.value })} /></Field>
          <div className="mt-3">
            <Field label="Текст" hint="Каждый абзац с новой строки. Первый станет крупным заголовком, последний — акцентом.">
              <textarea
                data-testid="about-text"
                rows={10}
                className="admin-input"
                value={about.value.paragraphs.join("\n")}
                onChange={(e) => about.setValue({ ...about.value, paragraphs: e.target.value.split("\n") })}
              />
            </Field>
          </div>
          <SaveRow saver={{ ...about, save: () => about.save({ ...about.value, paragraphs: about.value.paragraphs.map((p) => p.trim()).filter(Boolean) }) }} />
        </Panel>

        <Panel title="Сообщения">
          <div className="space-y-3">
            <Field label="После бронирования"><textarea rows={2} className="admin-input" value={messages.value.booking_success} onChange={(e) => messages.setValue({ ...messages.value, booking_success: e.target.value })} /></Field>
            <Field label="Когда все огоньки зажжены"><textarea rows={2} className="admin-input" value={messages.value.all_lit} onChange={(e) => messages.setValue({ ...messages.value, all_lit: e.target.value })} /></Field>
            <Field label="Где оставить подарок"><input className="admin-input" value={messages.value.drop_off} onChange={(e) => messages.setValue({ ...messages.value, drop_off: e.target.value })} /></Field>
          </div>
          <SaveRow saver={messages} />
          <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
            <Field label="Заголовок страницы «Контакты»"><input className="admin-input" value={contactsPage.value.title} onChange={(e) => contactsPage.setValue({ ...contactsPage.value, title: e.target.value })} /></Field>
            <Field label="Подзаголовок"><input className="admin-input" value={contactsPage.value.subtitle} onChange={(e) => contactsPage.setValue({ ...contactsPage.value, subtitle: e.target.value })} /></Field>
          </div>
          <SaveRow saver={contactsPage} />
        </Panel>

        <Panel title="Как это работает" className="xl:col-span-2">
          <Field label="Заголовок страницы"><input className="admin-input" value={how.value.title} onChange={(e) => how.setValue({ ...how.value, title: e.target.value })} /></Field>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {how.value.steps.map((step, i) => (
              <div key={i} className="rounded-xl border border-white/10 p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-lime">Шаг {i + 1}</span>
                  <span className="flex gap-1">
                    <button type="button" aria-label="Выше" disabled={i === 0} onClick={() => moveStep(i, -1)} className="rounded p-1 text-mist hover:bg-white/10 disabled:opacity-30"><ArrowUp size={15} /></button>
                    <button type="button" aria-label="Ниже" disabled={i === how.value.steps.length - 1} onClick={() => moveStep(i, 1)} className="rounded p-1 text-mist hover:bg-white/10 disabled:opacity-30"><ArrowDown size={15} /></button>
                    <button type="button" aria-label="Удалить шаг" onClick={() => how.setValue({ ...how.value, steps: how.value.steps.filter((_, n) => n !== i) })} className="rounded p-1 text-mist hover:bg-white/10 hover:text-red-300"><Trash2 size={15} /></button>
                  </span>
                </div>
                <div className="space-y-2">
                  <input aria-label={`Название шага ${i + 1}`} className="admin-input font-bold" value={step.title} onChange={(e) => setStep(i, { title: e.target.value })} />
                  <textarea aria-label={`Текст шага ${i + 1}`} rows={3} className="admin-input" value={step.body} onChange={(e) => setStep(i, { body: e.target.value })} />
                  <textarea aria-label={`Важное в шаге ${i + 1}`} rows={2} placeholder="Важное примечание (необязательно)" className="admin-input" value={step.note} onChange={(e) => setStep(i, { note: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <GhostButton type="button" className="mt-3 flex items-center gap-1.5" onClick={() => how.setValue({ ...how.value, steps: [...how.value.steps, { title: "Новый шаг", body: "", note: "" }] })}>
            <Plus size={15} /> Добавить шаг
          </GhostButton>
          <div className="mt-4"><Field label="Финальная надпись"><textarea rows={2} className="admin-input" value={how.value.finale} onChange={(e) => how.setValue({ ...how.value, finale: e.target.value })} /></Field></div>
          <SaveRow saver={how} />
        </Panel>

        <Panel title="Баннеры и изображения" className="xl:col-span-2">
          <p className="mb-3 text-sm text-mist">Показываются на странице «О проекте». Не загружайте сюда фото детей: это хранилище открыто для всех.</p>
          {uploadError && <div className="mb-3"><Notice kind="error">{uploadError}</Notice></div>}
          <div className="flex flex-wrap gap-3">
            {banners.value.items.map((item) => (
              <div key={item.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.title} className="h-28 rounded-xl object-cover" />
                <button type="button" aria-label={`Удалить ${item.title}`} onClick={() => removeBanner(item)} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/70 hover:bg-black"><Trash2 size={14} /></button>
              </div>
            ))}
            <label className="grid h-28 w-40 cursor-pointer place-items-center rounded-xl border border-dashed border-white/25 text-center text-sm font-bold transition hover:border-lime/60">
              <span className="flex flex-col items-center gap-1"><ImagePlus size={18} /> Добавить</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => addBanner(e.target.files?.[0])} />
            </label>
          </div>
          {banners.state?.kind === "error" && <div className="mt-3"><Notice kind="error">{banners.state.text}</Notice></div>}
        </Panel>
      </div>
    </>
  );
}
