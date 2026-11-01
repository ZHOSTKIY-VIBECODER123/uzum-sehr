"use client";

import { WithContent } from "@/components/demo/DemoGate";
import { HowView } from "@/components/site/PublicViews";

export default function Page() {
  return <WithContent>{(c) => <HowView settings={c.settings} />}</WithContent>;
}
