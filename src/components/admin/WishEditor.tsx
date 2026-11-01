"use client";

import { FileText, ImagePlus, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ChildAvatar } from "@/components/wish/ChildAvatar";
import { humanError, rpc } from "@/lib/api";
import { formatDateTime, STATUS_LABEL } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { uploadWishFile } from "@/lib/upload";
import type { AdminMedia, AdminWish, WishStatus } from "@/lib/types";
import { Field, GhostButton, Notice, PrimaryButton } from "./AdminShell";

type Props = {
  wish: AdminWish | null;
  onClose: () => void;
  onChanged: () => void;
  onCreated: (wish: AdminWish) => void;
};

export function WishEditor({ wish, onClose, onChanged, onCreated }: Props) {
  const client = supabaseBrowser();
  const [form, setForm] = useState({
    ward_id: wish?.ward_id ?? "",
    public_name: wish?.name ?? "",
    age: wish?.age?.toString() ?? "",
    city: wish?.city ?? "",
    wish_title: wish?.wish_title ?? "",
    description: wish?.description ?? "",
    photo_public: wish?.photo_public ?? false,
    hidden: wish?.hidden ?? false,
    admin_note: wish?.admin_note ?? "",
    photo_path: wish?.photo_path ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [media, setMedia] = useState<AdminMedia[]>([]);
  const [nextStatus, setNextStatus] = useState<WishStatus | null>(null);
  const [reason, setReason] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const loadMedia = useCallback(async () => {
    if (!wish) return;
    setMedia(await rpc<AdminMedia[]>(client, "admin_list_media", { p_wish_id: wish.id }));
  }, [wish, client]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (action: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await action();
      if (ok) setSaved(ok);
    } catch (failure) {
      setError(humanError(failure));
    } finally {
      setBusy(false);
    }
  };

  const payload = (photoPath: string) => ({
    id: wish?.id,
    ward_id: form.ward_id,
    public_name: form.public_name,
    age: Number(form.age),
    city: form.city,
    wish_title: form.wish_title,
    description: form.description,
    photo_path: photoPath,
    photo_public: form.photo_public,
    hidden: form.hidden,
    admin_note: form.admin_note,
  });

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      const result = await rpc<{ id: string; no: number }>(client, "admin_save_wish", { p: payload(form.photo_path) });
      onChanged();
      if (!wish) {
        onCreated({
          ...payload(form.photo_path),
          id: result.id,
          no: result.no,
          name: form.public_name,
          status: "free",
          city: form.city || null,
          photo_path: form.photo_path || null,
          admin_note: form.admin_note || null,
          booked_by: null,
          booked_by_name: null,
          booked_at: null,
          expires_at: null,
        });
      }
    }, wish ? "Сохранено" : undefined);
  };

  const uploadPhoto = (file: File | undefined) => {
    if (!file || !wish) return;
    run(async () => {
      const { path } = await uploadWishFile(client, wish.id, file);
      const previous = form.photo_path;
      await rpc(client, "admin_save_wish", { p: payload(path) });
      set("photo_path", path);
      if (previous) await client.storage.from("wish-media").remove([previous]);
      onChanged();
    }, "Фото загружено");
  };

  const removePhoto = () => {
    if (!wish || !form.photo_path) return;
    run(async () => {
      const previous = form.photo_path;
      await rpc(client, "admin_save_wish", { p: payload("") });
      set("photo_path", "");
      await client.storage.from("wish-media").remove([previous]);
      onChanged();
    }, "Фото удалено");
  };

  const uploadMedia = (files: FileList | null) => {
    if (!files?.length || !wish) return;
    run(async () => {
      for (const file of Array.from(files)) {
        const { path, mime } = await uploadWishFile(client, wish.id, file);
        await rpc(client, "admin_add_media", { p_wish_id: wish.id, p_path: path, p_title: file.name, p_mime: mime, p_public: form.photo_public });
      }
      await loadMedia();
    }, "Файлы загружены");
  };

  const removeMedia = (item: AdminMedia) =>
    run(async () => {
      await rpc(client, "admin_remove_media", { p_id: item.id });
      await client.storage.from("wish-media").remove([item.path]);
      await loadMedia();
    });

  const applyStatus = () => {
    if (!wish || !nextStatus) return;
    run(async () => {
      await rpc(client, "admin_set_status", { p_id: wish.id, p_status: nextStatus, p_reason: reason });
      setNextStatus(null);
      setReason("");
      onChanged();
    }, "Статус изменён");
  };

  const remove = () => {
    if (!wish) return;
    const warning = wish.booked_by
      ? `Желание ${wish.ward_id} забронировал ${wish.booked_by}. Удалить вместе с бронью?`
      : `Удалить желание ${wish.ward_id}? Это действие нельзя отменить.`;
    if (!window.confirm(warning)) return;
    run(async () => {
      const { paths } = await rpc<{ paths: string[] }>(client, "admin_delete_wish", { p_id: wish.id });
      if (paths.length) await client.storage.from("wish-media").remove(paths);
      onChanged();
      onClose();
    });
  };

  const releasing = nextStatus === "free" && Boolean(wish?.booked_by);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={wish ? `Желание ${wish.ward_id}` : "Новое желание"}>
      <button type="button" tabIndex={-1} aria-label="Закрыть" className="absolute inset-0 cursor-default bg-black/55" onClick={onClose} />
      <div className="scroll-thin relative h-full w-full max-w-[560px] overflow-y-auto border-l border-white/15 bg-night-2 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{wish ? `Желание ${wish.ward_id}` : "Новое желание"}</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={18} /></button>
        </div>

        <div className="mb-4 space-y-2">
          {error && <Notice kind="error">{error}</Notice>}
          {saved && <Notice kind="ok">{saved}</Notice>}
        </div>

        <form onSubmit={save} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="ID подопечного *"><input required className="admin-input font-mono" value={form.ward_id} onChange={(e) => set("ward_id", e.target.value)} /></Field>
            <Field label="Возраст *"><input required type="number" min={0} max={21} className="admin-input" value={form.age} onChange={(e) => set("age", e.target.value)} /></Field>
          </div>
          <Field label="Имя или публичный псевдоним *"><input required className="admin-input" value={form.public_name} onChange={(e) => set("public_name", e.target.value)} /></Field>
          <Field label="Город"><input className="admin-input" value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Желание *"><input required className="admin-input" value={form.wish_title} onChange={(e) => set("wish_title", e.target.value)} /></Field>
          <Field label="Описание"><textarea rows={3} className="admin-input" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Служебная заметка" hint="Видят только администраторы"><textarea rows={2} className="admin-input" value={form.admin_note} onChange={(e) => set("admin_note", e.target.value)} /></Field>
          <div className="space-y-2 rounded-xl border border-white/10 p-3">
            <label className="flex items-start gap-2.5 text-sm font-semibold">
              <input type="checkbox" className="mt-1 accent-lime" checked={form.photo_public} onChange={(e) => set("photo_public", e.target.checked)} />
              <span>Есть согласие на публикацию фото и материалов</span>
            </label>
            <label className="flex items-start gap-2.5 text-sm font-semibold">
              <input type="checkbox" className="mt-1 accent-lime" checked={form.hidden} onChange={(e) => set("hidden", e.target.checked)} />
              <span>Временно скрыть с ёлки</span>
            </label>
          </div>
          <PrimaryButton type="submit" disabled={busy} className="w-full py-2.5">{wish ? "Сохранить" : "Создать желание"}</PrimaryButton>
          {!wish && <p className="text-center text-xs text-haze">Фото и файлы можно загрузить сразу после создания.</p>}
        </form>

        {wish && (
          <>
            <section className="mt-7 border-t border-white/10 pt-5">
              <h3 className="mb-3 text-sm font-extrabold">Фото ребёнка</h3>
              <div className="flex items-center gap-4">
                <ChildAvatar path={form.photo_path || null} name={form.public_name || "?"} size={72} />
                <div className="flex flex-wrap gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-sm font-bold transition hover:bg-white/10">
                    <ImagePlus size={15} /> {form.photo_path ? "Заменить" : "Загрузить"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" data-testid="photo-input" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
                  </label>
                  {form.photo_path && <GhostButton type="button" onClick={removePhoto}>Удалить</GhostButton>}
                </div>
              </div>
              <p className="mt-2 text-xs text-haze">Метаданные и геометка удаляются при загрузке. Без согласия фото не показывается на сайте.</p>
            </section>

            <section className="mt-6 border-t border-white/10 pt-5">
              <h3 className="mb-3 text-sm font-extrabold">Дополнительные файлы</h3>
              <ul className="mb-3 space-y-1.5">
                {media.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <FileText size={15} className="shrink-0 text-mist" />
                    <span className="min-w-0 flex-1 truncate">{item.title ?? item.path}</span>
                    <span className="text-xs text-haze">{item.is_public ? "на сайте" : "только в админке"}</span>
                    <button type="button" onClick={() => removeMedia(item)} aria-label={`Удалить ${item.title ?? "файл"}`} className="text-mist hover:text-red-300"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-sm font-bold transition hover:bg-white/10">
                <Upload size={15} /> Добавить файлы
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" className="sr-only" onChange={(e) => uploadMedia(e.target.files)} />
              </label>
            </section>

            <section className="mt-6 border-t border-white/10 pt-5">
              <h3 className="mb-3 text-sm font-extrabold">Статус</h3>
              <p className="mb-3 text-sm text-mist">
                Сейчас: <b className="text-white">{STATUS_LABEL[wish.status]}</b>
                {wish.booked_by && <> · {wish.booked_by}, {formatDateTime(wish.booked_at)}</>}
                {wish.expires_at && wish.status === "booked" && <><br />Бронь действует до {formatDateTime(wish.expires_at)}</>}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["free", "booked", "fulfilled"] as WishStatus[])
                  .filter((s) => s !== wish.status && (s !== "booked" || wish.booked_by))
                  .map((s) => (
                    <GhostButton key={s} type="button" onClick={() => { setNextStatus(s); setReason(""); }} className={nextStatus === s ? "border-lime text-lime" : ""}>
                      {s === "free" ? (wish.booked_by ? "Освободить" : "Свободно") : STATUS_LABEL[s]}
                    </GhostButton>
                  ))}
              </div>
              {nextStatus && (
                <div className="mt-3 space-y-2 rounded-xl border border-white/10 p-3">
                  {releasing && (
                    <Field label="Причина отмены брони *" hint="Попадёт в журнал действий">
                      <input className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                  )}
                  <PrimaryButton type="button" disabled={busy || (releasing && !reason.trim())} onClick={applyStatus}>
                    Применить: {STATUS_LABEL[nextStatus]}
                  </PrimaryButton>
                </div>
              )}
            </section>

            <section className="mt-6 border-t border-white/10 pt-5">
              <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-2 text-sm font-bold text-red-300 hover:text-red-200">
                <Trash2 size={15} /> Удалить желание
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
