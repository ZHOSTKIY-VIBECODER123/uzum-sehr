import { AuthPanel } from "@/components/auth/AuthPanel";
import { PageShell } from "@/components/site/Header";
import { getContent } from "@/lib/content";
import { safePath } from "@/lib/safe-path";

export const dynamic = "force-dynamic";
export const metadata = { title: "Вход — Uzum sehr" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const { settings } = await getContent();
  const target = safePath(next);
  return (
    <PageShell title={settings.general.project_title}>
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 font-display text-[26px] font-medium">Вход</h1>
        {error && <p role="alert" className="mb-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-300">Ссылка устарела или открыта в другом браузере. Запроси код ещё раз.</p>}
        <div className="glass rounded-3xl p-6">
          <AuthPanel next={target} />
        </div>
      </div>
    </PageShell>
  );
}
