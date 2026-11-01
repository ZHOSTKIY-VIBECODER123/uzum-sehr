"use client";

import { Download, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { humanError, rpc } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AdminEntry, AdminRole } from "@/lib/types";
import { AdminTitle, GhostButton, Notice, Panel, PrimaryButton } from "./AdminShell";

export function TeamAdmin() {
  const client = supabaseBrowser();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setAdmins(await rpc<AdminEntry[]>(client, "admin_list_admins"));
    } catch (failure) {
      setMessage({ kind: "error", text: humanError(failure) });
    }
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (target: string, next: AdminRole | null) => {
    setMessage(null);
    try {
      await rpc(client, "admin_set_admin", { p_email: target, p_role: next });
      await load();
      setMessage({ kind: "ok", text: "Права обновлены" });
    } catch (failure) {
      setMessage({ kind: "error", text: humanError(failure) });
    }
  };

  const exportData = async () => {
    setMessage(null);
    try {
      const data = await rpc<unknown>(client, "admin_export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `uzum-sehr-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ kind: "ok", text: "Файл скачан. Он содержит данные детей и пользователей, храни его только в защищённом месте." });
    } catch (failure) {
      setMessage({ kind: "error", text: humanError(failure) });
    }
  };

  return (
    <>
      <AdminTitle title="Команда и данные" />
      {message && <div className="mb-4"><Notice kind={message.kind}>{message.text}</Notice></div>}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Администраторы">
          <form
            className="mb-4 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              change(email, role);
              setEmail("");
            }}
          >
            <input required type="email" aria-label="Почта" placeholder="почта сотрудника" className="admin-input min-w-52 flex-1" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select aria-label="Роль" className="admin-input w-auto" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <PrimaryButton type="submit" className="flex items-center gap-1.5"><UserPlus size={15} /> Выдать права</PrimaryButton>
          </form>
          <ul className="space-y-1.5">
            {admins.map((admin) => (
              <li key={admin.email} className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{admin.email}</span>
                <select aria-label={`Роль ${admin.email}`} className="admin-input w-auto !py-1.5" value={admin.role} onChange={(e) => change(admin.email, e.target.value as AdminRole)}>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <button type="button" aria-label={`Снять права ${admin.email}`} onClick={() => change(admin.email, null)} className="p-1 text-mist hover:text-red-300"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Резервная копия">
          <p className="text-sm leading-relaxed text-mist">Выгрузка всей базы в JSON. Автоматические копии настраиваются в Supabase и описаны в README: ежедневные бэкапы платформы и файл <code>.github/workflows/backup.yml</code>.</p>
          <GhostButton type="button" onClick={exportData} className="mt-4 flex items-center gap-1.5"><Download size={15} /> Скачать копию данных</GhostButton>
        </Panel>
      </div>
    </>
  );
}
