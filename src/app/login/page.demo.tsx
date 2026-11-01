"use client";

import { useEffect, useState } from "react";
import { WithContent } from "@/components/demo/DemoGate";
import { LoginView } from "@/components/site/PublicViews";
import { safePath } from "@/lib/safe-path";

export default function Page() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => setTarget(safePath(new URLSearchParams(window.location.search).get("next"))), []);
  return <WithContent>{(c) => (target ? <LoginView settings={c.settings} target={target} failed={false} /> : null)}</WithContent>;
}
