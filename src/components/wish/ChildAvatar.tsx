"use client";

import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Если фото нет или его нельзя показывать, вместо него огонёк с первой буквой имени.
export function ChildAvatar({ path, name, size = 96 }: { path: string | null; name: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) {
      signedUrl(supabaseBrowser(), path).then((value) => {
        if (alive) setUrl(value);
      });
    }
    return () => {
      alive = false;
    };
  }, [path]);

  const style = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} style={style} className="shrink-0 rounded-full object-cover ring-4 ring-white/70" />;
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: size * 0.4 }}
      className="grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_38%,#c9a2ff,#8538e8_62%,#4a1aa8)] font-display font-medium text-white ring-4 ring-white/70"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
