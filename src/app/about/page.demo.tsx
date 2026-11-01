"use client";

import { WithContent } from "@/components/demo/DemoGate";
import { AboutView } from "@/components/site/PublicViews";

export default function Page() {
  return <WithContent>{(c) => <AboutView settings={c.settings} />}</WithContent>;
}
