"use client";

import { FileSpreadsheet, Gauge, Gift, History, LogOut, MessageSquare, PanelsTopLeft, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext } from "react";
import { supabaseBrowser, withBase } from "@/lib/supabase/browser";
import type { AdminRole } from "@/lib/types";

const RoleContext = createContext<AdminRole>("admin");
export const useAdminRole = () => useContext(RoleContext);

const NAV = [
  { href: "/admin", label: "Обзор", icon: Gauge },
  { href: "/admin/wishes", label: "Желания", icon: Gift },
  { href: "/admin/import", label: "Импорт", icon: FileSpreadsheet },
  { href: "/admin/content", label: "Контент", icon: PanelsTopLeft },
  { href: "/admin/contacts", label: "Контакты", icon: MessageSquare },
  { href: "/admin/users", label: "Пользователи", icon: Users },
];
const SUPER_NAV = [
  { href: "/admin/log", label: "Журнал", icon: History },
  { href: "/admin/team", label: "Команда и данные", icon: ShieldCheck },
];

export function AdminShell({ role, email, children }: { role: AdminRole; email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = role === "super_admin" ? [...NAV, ...SUPER_NAV] : NAV;

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    window.location.assign(withBase("/"));
  };

  return (
    <RoleContext.Provider value={role}>
      <div className="min-h-dvh bg-night text-white md:grid md:grid-cols-[232px_1fr]">
        <aside className="border-b border-white/10 bg-night-2 md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
          <div className="flex h-full flex-col p-3 md:p-4">
            <Link href="/" className="mb-2 px-2 py-1.5 text-[15px] font-extrabold md:mb-5">
              Uzum sehr <span className="font-medium text-mist">· админка</span>
            </Link>
            <nav aria-label="Разделы" className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
              {items.map(({ href, label, icon: Icon }) => {
                const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      active ? "bg-violet text-white" : "text-mist hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <Icon size={16} /> {label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto hidden border-t border-white/10 pt-3 md:block">
              <p className="truncate px-2 text-xs font-semibold">{email}</p>
              <p className="px-2 text-xs text-mist">{role === "super_admin" ? "Super Admin" : "Admin"}</p>
              <button type="button" onClick={signOut} className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-mist hover:text-white">
                <LogOut size={13} /> Выйти
              </button>
            </div>
          </div>
        </aside>
        <main className="min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </RoleContext.Provider>
  );
}

export function AdminTitle({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {hint && <p className="mt-1 max-w-2xl text-sm text-mist">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.035] p-5 ${className}`}>
      {title && <h2 className="mb-4 text-base font-extrabold">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-mist">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-haze">{hint}</span>}
    </label>
  );
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`rounded-xl bg-lime px-4 py-2 text-sm font-extrabold text-ink transition hover:bg-lime-soft disabled:opacity-50 ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function GhostButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`rounded-xl border border-white/15 px-3.5 py-2 text-sm font-bold transition hover:bg-white/10 disabled:opacity-50 ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Notice({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${kind === "error" ? "bg-red-500/15 text-red-200" : "bg-lime/12 text-lime"}`}>
      {children}
    </p>
  );
}
