import { MyView } from "@/components/site/PublicViews";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мои добрые дела — Uzum sehr" };

export default async function MyPage() {
  const { settings } = await getContent();
  return <MyView settings={settings} />;
}
