import { HowView } from "@/components/site/PublicViews";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Как это работает — Uzum sehr" };

export default async function HowPage() {
  const { settings } = await getContent();
  return <HowView settings={settings} />;
}
