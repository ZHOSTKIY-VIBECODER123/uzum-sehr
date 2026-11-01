"use client";

import { DemoAdminGate } from "@/components/demo/DemoAdminGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DemoAdminGate>{children}</DemoAdminGate>;
}
