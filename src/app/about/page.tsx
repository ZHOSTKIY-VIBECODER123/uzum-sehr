import { AboutView } from "@/components/site/PublicViews";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "О проекте — Uzum sehr" };

export default async function AboutPage() {
  const { settings } = await getContent();
  return <AboutView settings={settings} />;
}
