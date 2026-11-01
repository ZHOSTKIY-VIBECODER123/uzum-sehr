"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { crownRadius, seeded, TREE_HEIGHT, TREE_RADIUS, TRUNK_BASE } from "./layout";

// Текстура еловой ветки рисуется в canvas: так сцена не зависит от внешних моделей.
function branchTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const rand = seeded(11);
  const greens = ["#123f27", "#185232", "#1f663c", "#2a7c49", "#3a955a", "#5fb873"];
  ctx.lineCap = "round";

  const needles = (x0: number, y0: number, x1: number, y1: number, length: number, density: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.floor(dist / density);
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < steps; i += 1) {
      const t = i / steps;
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      const taper = 1 - t * 0.45;
      for (const side of [-1, 1]) {
        const angle = base + side * (0.55 + rand() * 0.35);
        const len = length * taper * (0.75 + rand() * 0.45);
        ctx.strokeStyle = greens[Math.min(greens.length - 1, Math.floor(rand() * rand() * greens.length * 1.2 + t * 2))];
        ctx.lineWidth = 3.6 + rand() * 2.4;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(angle) * len, py + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
  };

  const midY = h / 2;
  const twigs: [number, number, number, number][] = [];
  for (let i = 0; i < 13; i += 1) {
    const t = 0.04 + i * 0.068;
    const x = w * t;
    const reach = (1 - t) * h * 0.62;
    for (const side of [-1, 1]) {
      const spread = 0.55 + rand() * 0.2;
      twigs.push([x, midY, x + Math.cos(spread) * reach, midY + side * Math.sin(spread) * reach]);
    }
  }
  twigs.sort(() => rand() - 0.5);

  for (const [x0, y0, x1, y1] of twigs) {
    ctx.strokeStyle = "#3b2a1c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    needles(x0, y0, x1, y1, 46, 5.5);
  }
  ctx.strokeStyle = "#4a3422";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(w * 0.96, midY);
  ctx.stroke();
  needles(0, midY, w * 0.98, midY, 52, 5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

// Два скрещенных изогнутых листа дают объём ветке с любого ракурса.
function branchGeometry(): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(1, 0.5, 4, 1);
  a.translate(0.5, 0, 0);
  a.rotateX(-Math.PI / 2);
  const b = new THREE.PlaneGeometry(1, 0.34, 4, 1);
  b.translate(0.5, 0, 0);
  const merged = new THREE.BufferGeometry();
  const count = a.attributes.position.count + b.attributes.position.count;
  const position = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const normal = new Float32Array(count * 3);
  position.set(a.attributes.position.array, 0);
  position.set(b.attributes.position.array, a.attributes.position.count * 3);
  uv.set(a.attributes.uv.array, 0);
  uv.set(b.attributes.uv.array, a.attributes.uv.count * 2);
  normal.set(a.attributes.normal.array, 0);
  normal.set(b.attributes.normal.array, a.attributes.normal.count * 3);
  for (let i = 0; i < count; i += 1) {
    const x = position[i * 3];
    position[i * 3 + 1] -= x * x * 0.22;
  }
  merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  const offset = a.attributes.position.count;
  const indexA = Array.from(a.index!.array);
  const indexB = Array.from(b.index!.array).map((v) => v + offset);
  merged.setIndex([...indexA, ...indexB]);
  a.dispose();
  b.dispose();
  return merged;
}

type Card = { matrix: THREE.Matrix4; color: THREE.Color; position: THREE.Vector3 };

function buildCards(density: number): Card[] {
  const rand = seeded(777);
  const cards: Card[] = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const scaleBoost = Math.pow(1 / density, 0.42);

  let y = TRUNK_BASE + 0.2;
  while (y < TREE_HEIGHT - 0.1) {
    const crown = crownRadius(y);
    const t = (y - TRUNK_BASE) / (TREE_HEIGHT - TRUNK_BASE);
    const count = Math.max(5, Math.round((9 + crown * 13) * Math.sqrt(density)));
    const tierOffset = rand() * Math.PI * 2;
    for (let i = 0; i < count; i += 1) {
      const angle = tierOffset + (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.28;
      const length = crown * (0.72 + rand() * 0.24);
      // Нижние ветви провисают, верхние смотрят вверх.
      const pitch = THREE.MathUtils.lerp(-0.42, 0.62, Math.pow(t, 1.4)) + (rand() - 0.5) * 0.2;
      const dir = new THREE.Vector3(Math.cos(angle) * Math.cos(pitch), Math.sin(pitch), Math.sin(angle) * Math.cos(pitch));
      const pieces = Math.max(1, Math.round((length / 0.34) * Math.sqrt(density)));
      for (let k = 0; k < pieces; k += 1) {
        const along = (0.18 + (0.82 * (k + 0.2 + rand() * 0.6)) / pieces) * length;
        const size = THREE.MathUtils.clamp(0.62 + length * 0.14, 0.42, 1.1) * (0.8 + rand() * 0.4) * scaleBoost;
        const fan = (rand() - 0.5) * 1.1;
        dummy.position.set(dir.x * along, y + dir.y * along, dir.z * along);
        dummy.rotation.set(0, 0, 0);
        dummy.rotateY(-angle + fan);
        dummy.rotateZ(pitch + (rand() - 0.5) * 0.3 - 0.1);
        dummy.rotateX((rand() - 0.5) * 1.1);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();

        const depth = along / Math.max(length, 0.001);
        // Внутри кроны темнее: это заменяет дорогое затенение.
        const light = 0.28 + 0.85 * Math.pow(depth, 1.7) + (rand() - 0.5) * 0.2;
        color.setRGB(light * (0.86 + rand() * 0.2), light * (0.95 + rand() * 0.12), light * (0.86 + rand() * 0.18));
        cards.push({ matrix: dummy.matrix.clone(), color: color.clone(), position: dummy.position.clone() });
      }
    }
    y += THREE.MathUtils.lerp(0.26, 0.13, t) / Math.sqrt(density);
  }
  return cards;
}

type LitBulb = { position: THREE.Vector3; color: THREE.Color };

export function Foliage({ density, litBulbs, flashAt }: { density: number; litBulbs: LitBulb[]; flashAt: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowAttr = useRef<THREE.InstancedBufferAttribute | null>(null);
  const uniforms = useRef({ uGlowBoost: { value: 1 } });

  const texture = useMemo(() => branchTexture(), []);
  const geometry = useMemo(() => branchGeometry(), []);
  const cards = useMemo(() => buildCards(density), [density]);

  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.3, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uGlowBoost = uniforms.current.uGlowBoost;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           attribute vec3 aGlow;
           varying vec3 vGlow;`,
        )
        // Плоским листам подменяем нормаль на нормаль кроны: свет ложится на ёлку как на объём.
        .replace(
          "#include <beginnormal_vertex>",
          `vec3 objectNormal = normalize(vec3(instanceMatrix[3].x, 0.55, instanceMatrix[3].z));
           #ifdef USE_TANGENT
             vec3 objectTangent = vec3(tangent.xyz);
           #endif`,
        )
        .replace("#include <defaultnormal_vertex>", "vec3 transformedNormal = normalMatrix * objectNormal;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
           varying vec3 vGlow;
           uniform float uGlowBoost;`,
        )
        // Двусторонний лист не должен темнеть с изнанки.
        .replace("#include <normal_fragment_begin>", "vec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           totalEmissiveRadiance += vGlow * uGlowBoost * diffuseColor.rgb * 2.4;`,
        );
    };
    return m;
  }, [texture]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    cards.forEach((card, i) => {
      mesh.setMatrixAt(i, card.matrix);
      mesh.setColorAt(i, card.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(cards.length * 3), 3);
    mesh.geometry.setAttribute("aGlow", attr);
    glowAttr.current = attr;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = false;
  }, [cards]);

  // Зажжённая лампочка подсвечивает ближайшие ветви. Пересчёт идёт только при изменении лампочек.
  useEffect(() => {
    const attr = glowAttr.current;
    if (!attr) return;
    const out = attr.array as Float32Array;
    const radius = 1.25;
    const r2 = radius * radius;
    for (let i = 0; i < cards.length; i += 1) {
      const p = cards[i].position;
      let r = 0;
      let g = 0;
      let b = 0;
      for (const lit of litBulbs) {
        const dx = p.x - lit.position.x;
        const dy = p.y - lit.position.y;
        const dz = p.z - lit.position.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r2) continue;
        const f = Math.pow(1 - d2 / r2, 2);
        r += lit.color.r * f;
        g += lit.color.g * f;
        b += lit.color.b * f;
      }
      out[i * 3] = r;
      out[i * 3 + 1] = g;
      out[i * 3 + 2] = b;
    }
    attr.needsUpdate = true;
  }, [litBulbs, cards]);

  useFrame(() => {
    const elapsed = (performance.now() - flashAt) / 1000;
    uniforms.current.uGlowBoost.value = flashAt && elapsed < 1.4 ? 1 + 0.8 * (1 - elapsed / 1.4) : 1;
  });

  useEffect(() => () => {
    texture.dispose();
    geometry.dispose();
    material.dispose();
  }, [texture, geometry, material]);

  return <instancedMesh key={cards.length} ref={meshRef} args={[geometry, material, cards.length]} />;
}

export function Trunk() {
  return (
    <group>
      <mesh position={[0, TREE_HEIGHT / 2 - 0.1, 0]}>
        <cylinderGeometry args={[0.03, 0.26, TREE_HEIGHT, 12]} />
        <meshLambertMaterial color="#2c1e16" />
      </mesh>
      {/* Тёмное ядро кроны закрывает просветы и лампочки на обратной стороне. */}
      <mesh position={[0, (TREE_HEIGHT + TRUNK_BASE) / 2 - 0.25, 0]}>
        <coneGeometry args={[TREE_RADIUS * 0.62, TREE_HEIGHT - TRUNK_BASE - 0.5, 28, 1]} />
        <meshBasicMaterial color="#0a2615" />
      </mesh>
    </group>
  );
}
