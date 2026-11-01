import { Reveal } from "@/components/site/Reveal";
import { PageShell } from "@/components/site/Header";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "О проекте — Uzum sehr" };

export default async function AboutPage() {
  const { settings } = await getContent();
  const { title, paragraphs } = settings.about;
  const lead = paragraphs[0];
  const closing = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : null;
  const body = paragraphs.slice(1, closing ? -1 : undefined);

  return (
    <PageShell title={settings.general.project_title}>
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-lime">{title}</p>
        <h1 className="mt-5 max-w-4xl font-display text-[28px] font-medium leading-[1.25] md:text-[46px]">{lead}</h1>
      </Reveal>

      <div className="mt-12 grid gap-10 md:grid-cols-[1fr_1.5fr] md:gap-16">
        <Reveal delay={0.1}>
          <div className="glass relative overflow-hidden rounded-3xl p-7">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet/40 blur-3xl" aria-hidden />
            <p className="relative font-display text-5xl font-medium text-lime">{settings.tree.target_wishes}</p>
            <p className="relative mt-2 text-sm font-semibold leading-relaxed text-mist">детских желаний на одной ёлке</p>
            <div className="relative mt-6 border-t border-white/10 pt-5 text-[15px] font-bold leading-relaxed">
              Одна лампочка — одна детская мечта — одно доброе дело.
            </div>
          </div>
        </Reveal>
        <div className="space-y-6">
          {body.map((text, i) => (
            <Reveal key={text} delay={0.1 + i * 0.07}>
              <p className="text-lg leading-relaxed text-white/85 md:text-xl">{text}</p>
            </Reveal>
          ))}
          {closing && (
            <Reveal delay={0.35}>
              <p className="border-l-2 border-lime pl-5 font-display text-xl font-medium leading-snug text-lime md:text-2xl">{closing}</p>
            </Reveal>
          )}
        </div>
      </div>

      {settings.banners.items.length > 0 && (
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {settings.banners.items.map((banner) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={banner.url} src={banner.url} alt={banner.title} className="w-full rounded-3xl border border-white/10 object-cover" />
          ))}
        </div>
      )}
    </PageShell>
  );
}
