import { ContactsView } from "@/components/site/PublicViews";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Контакты — Uzum sehr" };

export default async function ContactsPage() {
  const { settings, contacts } = await getContent();
  return <ContactsView settings={settings} contacts={contacts} />;
}
