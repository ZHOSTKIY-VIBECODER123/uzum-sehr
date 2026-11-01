import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { rpc } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import type { AdminRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Админ-панель — Uzum sehr", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const client = await supabaseServer();
  const { data } = await client.auth.getUser();
  if (!data.user) redirect("/login?next=/admin");

  const { role } = await rpc<{ role: AdminRole | null }>(client, "admin_whoami");
  // Посторонний не должен узнать, что панель здесь вообще есть.
  if (!role) notFound();

  return (
    <AdminShell role={role} email={data.user.email ?? ""}>
      {children}
    </AdminShell>
  );
}
