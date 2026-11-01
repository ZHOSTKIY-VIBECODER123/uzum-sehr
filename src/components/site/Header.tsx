"use client";

import { BookOpen, Heart, Home, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMyBookings, useUser } from "@/lib/hooks";

const LINKS = [
  { href: "/about", label: "О проекте" },
  { href: "/how", label: "Как это работает" },
  { href: "/contacts", label: "Контакты" },
];

export function Logo({ title }: { title: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${title}, на главную`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-full bg-violet shadow-[0_0_24px_#8538e8aa]">
        <svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden>
          <path d="M9 1.5a6.5 6.5 0 0 0-3.6 11.9c.6.4 1 1 1 1.7h5.2c0-.7.4-1.3 1-1.7A6.5 6.5 0 0 0 9 1.5Z" fill="#A8F000" />
          <path d="M6.8 17.2h4.4M7.6 19h2.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[17px] font-extrabold tracking-tight">{title}</span>
    </Link>
  );
}

export function Header({ title }: { title: string }) {
  const pathname = usePathname();
  const { user } = useUser();
  const { bookings } = useMyBookings(user);
  const count = bookings.length;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-night/55 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-6 px-4 md:px-8">
          <Logo title={title} />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition hover:text-white ${
                  pathname === link.href ? "bg-white/10 text-white" : "text-mist"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/my"
            aria-label={`Мои добрые дела: ${count}`}
            className="glass flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition hover:border-lime/60"
          >
            <Heart size={17} className={count ? "fill-lime text-lime" : "text-mist"} />
            <span className="hidden sm:inline">Мои добрые дела</span>
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/12 px-1.5 text-xs tabular-nums">{count}</span>
          </Link>
        </div>
      </header>
      <MobileNav />
    </>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Ёлка", icon: Home },
    { href: "/about", label: "О проекте", icon: Sparkles },
    { href: "/how", label: "Как помочь", icon: BookOpen },
    { href: "/contacts", label: "Контакты", icon: MessageCircle },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Навигация"
    >
      <div className="grid grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? "text-lime" : "text-mist"}`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="night-sky min-h-dvh">
      <Header title={title} />
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-28 md:px-8 md:pb-24 md:pt-32">{children}</main>
    </div>
  );
}
