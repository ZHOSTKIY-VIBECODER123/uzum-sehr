"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { humanError, rpc } from "@/lib/api";
import { ageLabel, formatDateTime } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AdminUser } from "@/lib/types";
import { AdminTitle, Field, GhostButton, Notice, PrimaryButton } from "./AdminShell";
import { StatusBadge } from "./WishesAdmin";

export function UsersAdmin() {
  const client = supabaseBrowser();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [cancelling, setCancelling] = useState<{ wishId: string; wardId: string } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setUsers(await rpc<AdminUser[]>(client, "admin_list_users"));
    } catch (failure) {
      setMessage({ kind: "error", text: humanError(failure) });
    }
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!users) return [];
    if (!q) return users;
    return users.filter((user) =>
      [user.email, user.display_name, user.slack, ...user.wishes.map((w) => w.ward_id), ...user.wishes.map((w) => w.name)]
        .some((value) => value?.toLowerCase().includes(q)),
    );
  }, [users, query]);

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await rpc(client, "admin_set_status", { p_id: cancelling.wishId, p_status: "free", p_reason: reason });
      setMessage({ kind: "ok", text: `Бронь ${cancelling.wardId} отменена, причина записана в журнал.` });
      setCancelling(null);
      setReason("");
      load();
    } catch (failure) {
      setMessage({ kind: "error", text: humanError(failure) });
    }
  };

  return (
    <>
      <AdminTitle title="Пользователи" hint="Все, кто выбрал желания, и закреплённые за ними подопечные." />
      {message && <div className="mb-4"><Notice kind={message.kind}>{message.text}</Notice></div>}

      <div className="relative mb-4 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-haze" />
        <input aria-label="Поиск" className="admin-input pl-9" placeholder="Почта, имя, ID подопечного" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="space-y-3">
        {visible.map((user) => (
          <section key={user.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-extrabold">{user.display_name ?? user.email}</p>
                <p className="text-sm text-mist">
                  {[user.display_name ? user.email : null, user.slack ? `Slack: ${user.slack}` : null, user.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <p className="text-sm font-bold">Желаний: <span className="text-lime">{user.count}</span></p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {user.wishes.map((wish) => (
                <li key={wish.wish_id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                  <span className="font-mono text-xs font-bold">{wish.ward_id}</span>
                  <span className="font-semibold">{wish.name}, {ageLabel(wish.age)}</span>
                  <span className="min-w-0 flex-1 truncate text-mist">{wish.wish_title}</span>
                  <span className="text-xs text-mist">{formatDateTime(wish.booked_at)}</span>
                  <StatusBadge status={wish.status} />
                  <GhostButton type="button" className="!py-1 !text-xs" onClick={() => { setCancelling({ wishId: wish.wish_id, wardId: wish.ward_id }); setReason(""); }}>
                    Отменить бронь
                  </GhostButton>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {users && visible.length === 0 && <p className="py-10 text-center text-mist">Пока никто не выбрал желание</p>}
        {!users && !message && <p className="py-10 text-center text-mist">Загружаю…</p>}
      </div>

      {cancelling && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Отмена бронирования">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-night-2 p-5">
            <h2 className="text-lg font-extrabold">Отменить бронь {cancelling.wardId}?</h2>
            <p className="mt-1 mb-3 text-sm text-mist">Желание снова станет свободным. Причина попадёт в журнал действий.</p>
            <Field label="Причина *"><input autoFocus data-testid="cancel-reason" className="admin-input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <div className="mt-4 flex justify-end gap-2">
              <GhostButton type="button" onClick={() => setCancelling(null)}>Не отменять</GhostButton>
              <PrimaryButton type="button" disabled={!reason.trim()} onClick={cancel}>Отменить бронь</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
