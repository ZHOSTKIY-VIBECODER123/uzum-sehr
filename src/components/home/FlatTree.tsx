"use client";

import { useMemo } from "react";
import { bulbColor } from "@/components/tree/layout";
import { ageLabel, STATUS_LABEL } from "@/lib/format";
import type { Bulb } from "@/lib/types";

type Spot = { x: number; y: number };

// Лампочки рядами внутри силуэта ёлки.
function spots(count: number): Spot[] {
  const result: Spot[] = [];
  const rows = Math.ceil((Math.sqrt(8 * count + 1) - 1) / 2);
  for (let row = 1; row <= rows; row += 1) {
    const inRow = Math.min(row, count - result.length);
    const depth = (row - 0.35) / rows;
    const width = depth * 86;
    for (let i = 0; i < inRow; i += 1) {
      const t = inRow === 1 ? 0.5 : i / (inRow - 1);
      result.push({ x: 50 + (t - 0.5) * width, y: 3 + depth * 94 });
    }
  }
  return result;
}

// Облегчённый режим и запасной вариант без WebGL: каждое желание остаётся обычной кнопкой.
export function FlatTree({ bulbs, target, onSelect }: { bulbs: Bulb[]; target: number; onSelect: (bulb: Bulb) => void }) {
  const count = Math.max(target, bulbs.reduce((max, b) => Math.max(max, b.no), 0), 1);
  const places = useMemo(() => spots(count), [count]);
  const byNo = useMemo(() => new Map(bulbs.map((b) => [b.no, b])), [bulbs]);

  return (
    <div className="absolute inset-x-0 bottom-[132px] top-[272px] md:bottom-16 md:top-[236px]" data-testid="flat-tree">
      <div className="relative mx-auto h-full max-w-[620px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="flat-fir" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f6a40" />
              <stop offset="1" stopColor="#0e3f28" />
            </linearGradient>
          </defs>
          <polygon points="50,0 100,100 0,100" fill="url(#flat-fir)" />
        </svg>
        {places.map((place, i) => {
          const no = i + 1;
          const bulb = byNo.get(no);
          const lit = bulb && bulb.status !== "free";
          const color = `#${bulbColor(no, bulb?.status === "fulfilled").getHexString()}`;
          const style: React.CSSProperties = {
            left: `${place.x}%`,
            top: `${place.y}%`,
            background: lit ? color : "#2a2547",
            boxShadow: lit ? `0 0 12px 3px ${color}` : "inset 0 0 0 1px #ffffff40",
          };
          if (!bulb) {
            return <span key={no} aria-hidden style={style} className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40" />;
          }
          return (
            <button
              key={bulb.id}
              type="button"
              onClick={() => onSelect(bulb)}
              title={bulb.ward_id}
              aria-label={`${bulb.ward_id}: ${bulb.name}, ${ageLabel(bulb.age)}, ${STATUS_LABEL[bulb.status]}`}
              style={style}
              className="flat-bulb absolute h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full before:absolute before:-inset-[5px] before:content-[''] md:h-3.5 md:w-3.5"
            />
          );
        })}
      </div>
    </div>
  );
}
