"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Contact } from "@/lib/types";

export function SlackIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" aria-hidden>
      <path fill="#36C5F0" d="M19.7 0a5.4 5.4 0 1 0 0 10.8h5.4V5.4A5.4 5.4 0 0 0 19.7 0Zm0 14.4H5.4a5.4 5.4 0 1 0 0 10.8h14.3a5.4 5.4 0 1 0 0-10.8Z" />
      <path fill="#2EB67D" d="M54 19.8a5.4 5.4 0 1 0-10.8 0v5.4h5.4a5.4 5.4 0 0 0 5.4-5.4Zm-14.4 0V5.4a5.4 5.4 0 1 0-10.8 0v14.4a5.4 5.4 0 1 0 10.8 0Z" />
      <path fill="#ECB22E" d="M34.2 54a5.4 5.4 0 1 0 0-10.8h-5.4v5.4a5.4 5.4 0 0 0 5.4 5.4Zm0-14.4h14.4a5.4 5.4 0 1 0 0-10.8H34.2a5.4 5.4 0 1 0 0 10.8Z" />
      <path fill="#E01E5A" d="M0 34.2a5.4 5.4 0 1 0 10.8 0v-5.4H5.4A5.4 5.4 0 0 0 0 34.2Zm14.4 0v14.4a5.4 5.4 0 1 0 10.8 0V34.2a5.4 5.4 0 1 0-10.8 0Z" />
    </svg>
  );
}

export function ContactCard({ contact }: { contact: Contact }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contact.slack_handle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="glass flex items-center gap-4 rounded-3xl p-5 transition hover:border-white/30">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white">
        <SlackIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-extrabold">@{contact.slack_handle}</p>
        {contact.label && <p className="truncate text-sm text-mist">{contact.label}</p>}
      </div>
      {contact.slack_url ? (
        <a href={contact.slack_url} target="_blank" rel="noreferrer" aria-label={`Написать ${contact.slack_handle} в Slack`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
          <ExternalLink size={17} />
        </a>
      ) : (
        <button type="button" onClick={copy} aria-label={`Скопировать ${contact.slack_handle}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
          {copied ? <Check size={17} className="text-lime" /> : <Copy size={16} />}
        </button>
      )}
    </div>
  );
}
