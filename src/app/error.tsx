"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="night-sky grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-2xl font-medium">Огоньки на минуту погасли</p>
        <p className="mt-3 text-mist">Не получилось загрузить страницу. Твои добрые дела в безопасности, попробуй ещё раз чуть позже.</p>
        <button type="button" onClick={reset} className="btn-lime mt-6 rounded-2xl px-7 py-3.5 font-extrabold">
          Попробовать ещё раз
        </button>
      </div>
    </main>
  );
}
