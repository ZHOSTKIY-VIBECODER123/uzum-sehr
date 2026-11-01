import { MyDeeds } from "@/components/my/MyDeeds";
import { PageShell } from "@/components/site/Header";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мои добрые дела — Uzum sehr" };

export default async function MyPage() {
  const { settings } = await getContent();
  return (
    <PageShell title={settings.general.project_title}>
      <MyDeeds dropOff={settings.messages.drop_off} />
    </PageShell>
  );
}
