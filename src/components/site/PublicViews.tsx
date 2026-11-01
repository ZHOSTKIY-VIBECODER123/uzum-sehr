import { AuthPanel } from "@/components/auth/AuthPanel";
import { MyDeeds } from "@/components/my/MyDeeds";
import { ContactCard } from "@/components/site/ContactCard";
import { PageShell } from "@/components/site/Header";
import { HowSteps } from "@/components/site/HowSteps";
import { Reveal } from "@/components/site/Reveal";
import type { Contact, Settings } from "@/lib/types";

export function AboutView({ settings }: { settings: Settings }) {
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

export function HowView({ settings }: { settings: Settings }) {
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

export function ContactsView({ settings, contacts }: { settings: Settings; contacts: Contact[] }) {
  return (
    <PageShell title={settings.general.project_title}>
      <Reveal>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-lime">Контакты</p>
        <h1 className="mt-4 font-display text-[27px] font-medium leading-tight md:text-[44px]">{settings.contacts_page.title}</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-mist">{settings.contacts_page.subtitle}</p>
      </Reveal>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {contacts.map((contact, i) => (
          <Reveal key={contact.id} delay={i * 0.06}>
            <ContactCard contact={contact} />
          </Reveal>
        ))}
      </div>
    </PageShell>
  );
}

export function LoginView({ settings, target, failed }: { settings: Settings; target: string; failed: boolean }) {
  return (
    <PageShell title={settings.general.project_title}>
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 font-display text-[26px] font-medium">Вход</h1>
        {failed && <p role="alert" className="mb-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-300">Ссылка устарела или открыта в другом браузере. Запроси код ещё раз.</p>}
        <div className="glass rounded-3xl p-6">
          <AuthPanel next={target} />
        </div>
      </div>
    </PageShell>
  );
}

export function MyView({ settings }: { settings: Settings }) {
  return (
    <PageShell title={settings.general.project_title}>
      <MyDeeds dropOff={settings.messages.drop_off} />
    </PageShell>
  );
}
