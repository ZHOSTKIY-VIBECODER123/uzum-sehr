"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { rpc } from "@/lib/api";
import { useUser } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AdminRole } from "@/lib/types";

// Права всё равно проверяются в базе: этот шлюз только показывает нужный экран.
export function DemoAdminGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const [role, setRole] = useState<AdminRole | null | undefined>(undefined);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }
    rpc<{ role: AdminRole | null }>(supabaseBrowser(), "admin_whoami").then((result) => setRole(result.role));
  }, [user, loading, router]);

  if (user && role) return <AdminShell role={role} email={user.email ?? ""}>{children}</AdminShell>;
  if (user && role === null) {
    return (
      <main className="night-sky grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-md">
          <p className="font-display text-xl font-medium">У этой почты нет прав администратора</p>
          <p className="mt-3 text-mist">В демо админка открывается через почту admin@example.com. Выйдите в кабинете и войдите с ней.</p>
          <Link href="/my" className="btn-lime mt-6 inline-block rounded-2xl px-7 py-3.5 font-extrabold">В кабинет</Link>
        </div>
      </main>
    );
  }
  return (
    <div className="grid min-h-dvh place-items-center bg-night text-lime">
      <Loader2 className="animate-spin" />
    </div>
  );
}
