import { ContentAdmin } from "@/components/admin/ContentAdmin";
import { getContent } from "@/lib/content";

export default async function Page() {
  const { settings } = await getContent();
  return <ContentAdmin initial={settings} />;
}
