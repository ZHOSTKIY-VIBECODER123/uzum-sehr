import * as THREE from "three";

export const TREE_HEIGHT = 10;
export const TREE_RADIUS = 3.7;
export const TRUNK_BASE = 0.55;

// Радиус кроны: у вершины почти острый, книзу расширяется и слегка выпуклый.
export function crownRadius(y: number): number {
  const t = THREE.MathUtils.clamp((y - TRUNK_BASE) / (TREE_HEIGHT - TRUNK_BASE), 0, 1);
  const fromTop = 1 - t;
  const cone = TREE_RADIUS * (0.04 + 0.96 * Math.pow(fromTop, 0.92));
  // Ярусы: крона ступенями расширяется книзу, как у настоящей ели.
  const phase = (t * 7) % 1;
  return cone * (0.86 + 0.14 * (1 - phase));
}

export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

export type BulbSlot = {
  position: THREE.Vector3;
  outward: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const BULB_AXIS = new THREE.Vector3(0, -1, 0);

// Лампочки равномерно ложатся на поверхность конуса по золотой спирали, плотность выровнена по площади.
export function bulbSlots(count: number): BulbSlot[] {
  const rand = seeded(2026);
  const slots: BulbSlot[] = [];
  const top = TREE_HEIGHT - 0.55;
  const bottom = TRUNK_BASE + 0.45;

  const ordered: BulbSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    const u = (i + 0.5) / count;
    const y = top - (top - bottom) * Math.sqrt(u);
    const angle = i * GOLDEN;
    const radius = crownRadius(y) * (0.97 + rand() * 0.05);
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const position = new THREE.Vector3(outward.x * radius, y + (rand() - 0.5) * 0.08, outward.z * radius);
    const axis = new THREE.Vector3(outward.x * 0.5 + (rand() - 0.5) * 0.25, -1, outward.z * 0.5 + (rand() - 0.5) * 0.25).normalize();
    ordered.push({ position, outward, quaternion: new THREE.Quaternion().setFromUnitVectors(BULB_AXIS, axis) });
  }

  // Перемешиваем, чтобы первые номера не собирались у вершины.
  const order = ordered.map((_, i) => i);
  const shuffle = seeded(150);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(shuffle() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const index of order) slots.push(ordered[index]);
  return slots;
}

const PALETTE = [new THREE.Color("#b45cff"), new THREE.Color("#b6ff1a")];
const WARM = new THREE.Color("#ffc46b");

// Цвет зажжённой лампочки выбирается автоматически по номеру, переданный подарок становится тёплым.
export function bulbColor(no: number, fulfilled: boolean): THREE.Color {
  if (fulfilled) return WARM;
  return PALETTE[(Math.imul(no, 2654435761) >>> 16) % PALETTE.length];
}
