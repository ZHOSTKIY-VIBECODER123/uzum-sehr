"use client";

import { WithContent } from "@/components/demo/DemoGate";
import { MyView } from "@/components/site/PublicViews";

export default function Page() {
  return <WithContent>{(c) => <MyView settings={c.settings} />}</WithContent>;
}
