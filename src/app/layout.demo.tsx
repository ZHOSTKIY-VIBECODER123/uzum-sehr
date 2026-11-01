import { DemoBanner } from "@/components/demo/DemoBanner";
import RootLayout from "./layout";

export { metadata, viewport } from "./layout";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootLayout>
      {children}
      <DemoBanner />
    </RootLayout>
  );
}
