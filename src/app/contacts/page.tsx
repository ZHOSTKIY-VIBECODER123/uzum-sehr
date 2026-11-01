import { ContactCard } from "@/components/site/ContactCard";
import { PageShell } from "@/components/site/Header";
import { Reveal } from "@/components/site/Reveal";
import { getContent } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Контакты — Uzum sehr" };

export default async function ContactsPage() {
  const { settings, contacts } = await getContent();
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
