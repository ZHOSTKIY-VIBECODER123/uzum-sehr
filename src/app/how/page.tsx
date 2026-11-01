import { PageShell } from "@/components/site/Header";
import { HowSteps } from "@/components/site/HowSteps";
import { Reveal } from "@/components/site/Reveal";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Как это работает — Uzum sehr" };

export default async function HowPage() {
  const { settings } = await getContent();
  return (
    <PageShell title={settings.general.project_title}>
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-lime">Как это работает</p>
        <h1 className="mt-4 font-display text-[27px] font-medium leading-tight md:text-[44px]">{settings.how.title}</h1>
      </Reveal>
      <HowSteps steps={settings.how.steps} finale={settings.how.finale} />
    </PageShell>
  );
}
