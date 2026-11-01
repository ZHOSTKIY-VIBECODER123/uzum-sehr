"use client";

import { WithContent } from "@/components/demo/DemoGate";
import { ContactsView } from "@/components/site/PublicViews";

export default function Page() {
  return <WithContent>{(c) => <ContactsView settings={c.settings} contacts={c.contacts} />}</WithContent>;
}
