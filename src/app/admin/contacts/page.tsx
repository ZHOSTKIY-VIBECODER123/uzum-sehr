import { ContactsAdmin } from "@/components/admin/ContactsAdmin";
import { getContent } from "@/lib/content";

export default async function Page() {
  const { contacts } = await getContent();
  return <ContactsAdmin initial={contacts} />;
}
