"use client";

import { WithHome } from "@/components/demo/DemoGate";
import { HomeClient } from "@/components/home/HomeClient";

export default function Page() {
  return <WithHome>{(content, tree) => <HomeClient content={content} initialTree={tree} />}</WithHome>;
}
