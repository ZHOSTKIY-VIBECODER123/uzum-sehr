"use client";

import { ContentAdmin } from "@/components/admin/ContentAdmin";
import { WithContent } from "@/components/demo/DemoGate";

export default function Page() {
  return <WithContent>{(c) => <ContentAdmin initial={c.settings} />}</WithContent>;
}
