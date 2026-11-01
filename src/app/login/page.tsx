import { LoginView } from "@/components/site/PublicViews";
import { getContent } from "@/lib/content";
import { safePath } from "@/lib/safe-path";

export const dynamic = "force-dynamic";
export const metadata = { title: "Вход — Uzum sehr" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const { settings } = await getContent();
  return <LoginView settings={settings} target={safePath(next)} failed={Boolean(error)} />;
}
