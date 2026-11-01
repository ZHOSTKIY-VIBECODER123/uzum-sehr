"use client";

import { ContactsAdmin } from "@/components/admin/ContactsAdmin";
import { WithContent } from "@/components/demo/DemoGate";

export default function Page() {
  return <WithContent>{(c) => <ContactsAdmin initial={c.contacts} />}</WithContent>;
}
