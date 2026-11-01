"use client";

import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Bulb } from "@/lib/types";
import { Burst, LightRibbon, Pedestal, Snow, Stars, TopStar } from "./Atmosphere";
import { Bulbs, type BulbVisual } from "./Bulbs";
import { Foliage, Trunk } from "./Foliage";
import { bulbColor, bulbSlots, TREE_HEIGHT, TREE_RADIUS } from "./layout";
import { detectTier, lowerTier, TIERS, type Tier } from "./tiers";

type Props = {
  bulbs: Bulb[];
  target: number;
  progress: number;
  selectedId: string | null;
  focusId: string | null;
  igniteId: string | null;
  onSelect: (bulb: Bulb) => void;
  onInteract?: () => void;
};

export default function TreeScene(props: Props) {
  const [tier, setTier] = useState<Tier>(() => detectTier());
  const config = TIERS[tier];
  const tooltip = useRef<HTMLDivElement>(null);

  return (
    <>
      <Canvas
        className="tree-canvas"
        dpr={config.dpr}
        gl={{ antialias: config.antialias, alpha: false, powerPreference: "high-performance" }}
        camera={{ fov: 34, near: 0.5, far: 220, position: [0, 11, 26] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        data-testid="tree-canvas"
      >
        <PerformanceMonitor onDecline={() => setTier((t) => lowerTier(t))} flipflops={2} />
        <Scene {...props} tier={tier} tooltip={tooltip} />
      </Canvas>
      <div ref={tooltip} className="bulb-tooltip" aria-hidden />
    </>
  );
}

const FOV = 34;
const HEADLIGHT_OFFSET = new THREE.Vector3(6, 10, 0);
const TREE_TOP = TREE_HEIGHT + 0.7;

// Подбирает кадр: вершина ниже заголовка, ёлка целиком помещается по ширине и высоте.
function fitFrame(aspect: number, height: number) {
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const phone = aspect < 0.8;
  const topShare = (phone ? 268 : 205) / height;
  const byHeight = TREE_TOP / Math.max(1 - topShare - (phone ? 0.13 : 0.1), 0.35);
  const byWidth = (TREE_RADIUS * 2.3) / aspect;
  const visible = Math.max(byHeight, byWidth);
  return { distance: visible / (2 * tan), targetY: TREE_TOP + topShare * visible - visible / 2 };
}

// Небо рисуется внутри сцены: так световые эффекты корректно складываются с фоном.
function skyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createLinearGradient(0, 0, 0, 1024);
  base.addColorStop(0, "#050920");
  base.addColorStop(0.55, "#080d27");
  base.addColorStop(1, "#0d0b30");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 1024);
  const spot = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "#28105c00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
  };
  spot(512, 620, 520, "#2d1a7a88");
  spot(900, 90, 520, "#28105caa");
  spot(70, 950, 480, "#28105c99");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Scene({
  bulbs,
  target,
  progress,
  selectedId,
  focusId,
  igniteId,
  onSelect,
  onInteract,
  tier,
  tooltip,
}: Props & { tier: Tier; tooltip: React.RefObject<HTMLDivElement | null> }) {
  const config = TIERS[tier];
  const { camera, gl, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const headlight = useRef<THREE.DirectionalLight>(null);

  const slotCount = Math.max(target, bulbs.reduce((max, b) => Math.max(max, b.no), 0), 1);
  const slots = useMemo(() => bulbSlots(slotCount), [slotCount]);

  const byIndex = useMemo(() => {
    const list: (Bulb | undefined)[] = new Array(slotCount);
    for (const bulb of bulbs) list[bulb.no - 1] = bulb;
    return list;
  }, [bulbs, slotCount]);

  const visuals = useMemo<BulbVisual[]>(
    () =>
      byIndex.map((bulb, i) => ({
        lit: bulb ? bulb.status !== "free" : false,
        color: bulbColor(i + 1, bulb?.status === "fulfilled"),
        interactive: Boolean(bulb),
        mine: Boolean(bulb?.mine),
      })),
    [byIndex],
  );

  const litBulbs = useMemo(
    () =>
      visuals.flatMap((visual, i) => (visual.lit ? [{ position: slots[i].position, color: visual.color }] : [])),
    [visuals, slots],
  );

  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);
  const selected = useMemo(() => {
    const bulb = bulbs.find((b) => b.id === selectedId);
    return bulb ? bulb.no - 1 : null;
  }, [bulbs, selectedId]);

  // ---- камера под размер экрана
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const texture = skyTexture();
    scene.background = texture;
    return () => {
      scene.background = null;
      texture.dispose();
    };
  }, [scene]);

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const { distance, targetY } = fitFrame(aspect, Math.max(size.height, 1));
    const c = controls.current;
    if (!c) return;
    const dir = camera.position.clone().sub(c.target).setY(0).normalize().multiplyScalar(0.985);
    dir.y = 0.17;
    c.target.set(0, targetY, 0);
    camera.position.copy(c.target).addScaledVector(dir, distance);
    c.minDistance = distance * 0.34;
    c.maxDistance = distance * 1.25;
    c.update();
  }, [size.width, size.height, camera]);

  // ---- подбор лампочки по экранным координатам: так удобнее попадать пальцем, чем лучом в 3D
  const projected = useMemo(() => new THREE.Vector3(), []);
  const toCamera = useMemo(() => new THREE.Vector3(), []);

  const pick = useCallback(
    (clientX: number, clientY: number, touch: boolean): number | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let best: number | null = null;
      let bestScore = Infinity;
      const distance = camera.position.distanceTo((controls.current?.target as THREE.Vector3) ?? new THREE.Vector3());
      const bulbPixels = (0.5 / distance) * (rect.height / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))));
      const radius = Math.max(bulbPixels * 1.15, touch ? 26 : 13);

      for (let i = 0; i < slots.length; i += 1) {
        if (!byIndex[i]) continue;
        const slot = slots[i];
        toCamera.copy(camera.position).sub(slot.position).normalize();
        if (toCamera.x * slot.outward.x + toCamera.z * slot.outward.z < 0.02) continue;
        projected.copy(slot.position).project(camera);
        const sx = ((projected.x + 1) / 2) * rect.width;
        const sy = ((1 - projected.y) / 2) * rect.height;
        const offset = Math.hypot(sx - x, sy - y - bulbPixels * 0.3);
        if (offset > radius) continue;
        const score = offset + projected.z * 6;
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      return best;
    },
    [camera, gl, slots, byIndex, projected, toCamera],
  );

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; t: number } | null = null;

    const setHover = (next: number | null) => {
      if (hoveredRef.current === next) return;
      hoveredRef.current = next;
      setHovered(next);
      el.style.cursor = next === null ? "grab" : "pointer";
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.buttons > 0) return;
      setHover(pick(e.clientX, e.clientY, false));
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      onInteract?.();
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 600;
      down = null;
      if (moved > 8 || !quick) return;
      const index = pick(e.clientX, e.clientY, e.pointerType === "touch");
      const bulb = index === null ? undefined : byIndex[index];
      if (bulb) onSelect(bulb);
    };
    const onLeave = () => setHover(null);

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, pick, byIndex, onSelect, onInteract]);

  // ---- подсказка с ID следует за лампочкой
  useEffect(() => {
    const el = tooltip.current;
    if (!el) return;
    const index = hovered ?? selected;
    const bulb = index === null ? undefined : byIndex[index];
    el.textContent = bulb ? bulb.ward_id : "";
    el.dataset.visible = bulb ? "1" : "0";
  }, [hovered, selected, byIndex, tooltip]);

  // ---- поворот к лампочке, выбранной из списка
  const focusGoal = useRef<number | null>(null);
  useEffect(() => {
    const bulb = bulbs.find((b) => b.id === focusId);
    if (!bulb) {
      focusGoal.current = null;
      return;
    }
    const slot = slots[bulb.no - 1];
    focusGoal.current = Math.atan2(slot.outward.x, slot.outward.z);
  }, [focusId, bulbs, slots]);

  const lastInteract = useRef(0);
  useEffect(() => {
    const el = gl.domElement;
    const touch = () => {
      lastInteract.current = performance.now();
      focusGoal.current = null;
    };
    el.addEventListener("pointerdown", touch);
    el.addEventListener("wheel", touch, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", touch);
      el.removeEventListener("wheel", touch);
    };
  }, [gl]);

  // ---- вспышка при зажигании
  const [burst, setBurst] = useState<{ origin: THREE.Vector3; color: THREE.Color; at: number } | null>(null);
  const seenIgnite = useRef<string | null>(null);
  useEffect(() => {
    if (!igniteId || seenIgnite.current === igniteId) return;
    const bulb = bulbs.find((b) => b.id === igniteId);
    if (!bulb) return;
    seenIgnite.current = igniteId;
    const slot = slots[bulb.no - 1];
    const origin = new THREE.Vector3(0, -0.2, 0).applyQuaternion(slot.quaternion).add(slot.position);
    setBurst({ origin, color: bulbColor(bulb.no, false), at: performance.now() });
  }, [igniteId, bulbs, slots]);

  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;

    if (focusGoal.current !== null) {
      const current = c.getAzimuthalAngle();
      let diff = focusGoal.current - current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < 0.01) {
        focusGoal.current = null;
      } else {
        const step = diff * 0.07;
        const offset = camera.position.clone().sub(c.target);
        offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, step);
        camera.position.copy(c.target).add(offset);
      }
    }

    const idle = performance.now() - lastInteract.current > 5000;
    c.autoRotate = !reduceMotion && idle && hoveredRef.current === null && selectedId === null && focusGoal.current === null;
    c.update();

    // Основной свет идёт чуть сбоку от камеры, поэтому ёлка выглядит одинаково с любой стороны.
    headlight.current?.position.copy(camera.position).add(HEADLIGHT_OFFSET);

    const el = tooltip.current;
    const index = hoveredRef.current ?? selected;
    if (el && index !== null && slots[index]) {
      const rect = gl.domElement.getBoundingClientRect();
      projected.copy(slots[index].position).project(camera);
      const sx = ((projected.x + 1) / 2) * rect.width;
      const sy = ((1 - projected.y) / 2) * rect.height;
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, calc(-100% - 12px))`;
    }
  });

  const flashAt = burst?.at ?? 0;

  return (
    <>
      <hemisphereLight args={["#aebcff", "#1c1148", 0.95]} />
      <directionalLight ref={headlight} intensity={1.35} color="#f2f4ff" />
      <directionalLight position={[-7, 4, -6]} intensity={0.9} color="#8c62ff" />
      <pointLight position={[0, 0.2, 0]} intensity={6 + progress * 22} distance={7} color="#9a6bff" />

      <OrbitControls
        ref={controls as never}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        autoRotateSpeed={0.42}
        minPolarAngle={Math.PI * 0.26}
        maxPolarAngle={Math.PI * 0.56}
      />

      <Stars count={config.stars} />
      <group>
        <Trunk />
        <Foliage density={config.foliage} litBulbs={litBulbs} flashAt={flashAt} />
        <Bulbs
          slots={slots}
          visuals={visuals}
          hovered={hovered}
          selected={selected}
          wave={burst ? { origin: burst.origin, at: burst.at } : null}
        />
        <TopStar y={TREE_HEIGHT + 0.12} progress={progress} />
        <Pedestal progress={progress} />
        <LightRibbon count={config.sparkles} />
        <Burst burst={burst} />
      </group>
      <Snow count={config.snow} />
    </>
  );
}
