import Link from "next/link";

export default function NotFound() {
  return (
    <main className="night-sky grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-5xl font-medium text-lime">404</p>
        <p className="mt-4 text-lg text-mist">Такой страницы нет, зато на ёлке ещё много огоньков.</p>
        <Link href="/" className="btn-lime mt-6 inline-block rounded-2xl px-7 py-3.5 font-extrabold">К ёлке</Link>
      </div>
    </main>
  );
}
