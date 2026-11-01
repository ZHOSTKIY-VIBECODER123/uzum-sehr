export type Tier = "high" | "medium" | "low";

export type TierConfig = {
  foliage: number;
  dpr: [number, number];
  snow: number;
  stars: number;
  sparkles: number;
  antialias: boolean;
};

export const TIERS: Record<Tier, TierConfig> = {
  high: { foliage: 1, dpr: [1, 2], snow: 500, stars: 1400, sparkles: 260, antialias: true },
  medium: { foliage: 0.6, dpr: [1, 1.6], snow: 260, stars: 800, sparkles: 140, antialias: true },
  low: { foliage: 0.3, dpr: [1, 1.15], snow: 90, stars: 350, sparkles: 0, antialias: false },
};

const NEXT_DOWN: Record<Tier, Tier> = { high: "medium", medium: "low", low: "low" };
export const lowerTier = (tier: Tier) => NEXT_DOWN[tier];

export function detectTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
  if (memory <= 2 || cores <= 2) return "low";
  if (mobile) return memory <= 4 || cores <= 4 ? "low" : "medium";
  if (memory <= 4 || cores <= 4) return "medium";
  return "high";
}

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
