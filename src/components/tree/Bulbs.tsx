"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BulbSlot } from "./layout";

export type BulbVisual = { lit: boolean; color: THREE.Color; interactive: boolean; mine: boolean };

// Форма лампочки C9: цоколь сверху, капля вниз.
function bulbGeometry(): THREE.BufferGeometry {
  const profile: [number, number][] = [
    [0, -0.5], [0.05, -0.49], [0.1, -0.44], [0.14, -0.34], [0.165, -0.22], [0.175, -0.1],
    [0.16, 0.02], [0.125, 0.11], [0.09, 0.17], [0.085, 0.2], [0.085, 0.31], [0, 0.32],
  ];
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(points, 16);
  const position = geometry.attributes.position;
  const cap = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) cap[i] = position.getY(i) > 0.18 ? 1 : 0;
  geometry.setAttribute("aCap", new THREE.BufferAttribute(cap, 1));
  return geometry;
}

const bulbVertex = /* glsl */ `
  attribute float aLit;
  attribute float aHover;
  attribute float aSeed;
  attribute float aCap;
  attribute vec3 aColor;
  uniform float uTime;
  uniform vec3 uWaveOrigin;
  uniform float uWaveTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vColor;
  varying float vLit;
  varying float vHover;
  varying float vCap;
  varying float vTwinkle;
  varying float vWave;
  varying float vTip;
  void main() {
    float scale = 1.0 + aHover * 0.28;
    vec4 world = modelMatrix * instanceMatrix * vec4(position * scale, 1.0);
    vec4 viewPos = viewMatrix * world;
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vView = normalize(-viewPos.xyz);
    vColor = aColor;
    vLit = aLit;
    vHover = aHover;
    vCap = aCap;
    vTip = smoothstep(0.2, -0.45, position.y);
    float slow = sin(uTime * (0.6 + aSeed * 0.9) + aSeed * 40.0);
    vTwinkle = smoothstep(0.82, 1.0, slow);
    float dist = distance(world.xyz, uWaveOrigin);
    float front = uWaveTime * 3.4;
    vWave = uWaveTime < 0.0 ? 0.0 : exp(-pow((dist - front) * 1.5, 2.0)) * clamp(1.0 - uWaveTime / 1.6, 0.0, 1.0);
    gl_Position = projectionMatrix * viewPos;
  }
`;

const bulbFragment = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vColor;
  varying float vLit;
  varying float vHover;
  varying float vCap;
  varying float vTwinkle;
  varying float vWave;
  varying float vTip;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float facing = max(dot(n, v), 0.0);
    float fresnel = pow(1.0 - facing, 2.4);
    vec3 lightDir = normalize(vec3(0.35, 0.7, 0.6));
    float spec = pow(max(dot(reflect(-lightDir, n), v), 0.0), 40.0);

    // Выключенная лампочка: тёмное полупрозрачное стекло с холодным бликом.
    vec3 glassBase = mix(vec3(0.1, 0.09, 0.17), vec3(0.24, 0.2, 0.34), vTip * 0.6);
    vec3 off = glassBase + fresnel * vec3(0.36, 0.34, 0.55) + spec * vec3(0.7, 0.72, 0.9);
    off += vTwinkle * vec3(0.05, 0.04, 0.1);
    off += vHover * (vec3(0.2, 0.18, 0.32) + fresnel * vec3(0.5));
    off += vWave * vec3(0.22, 0.2, 0.34);

    // Зажжённая: горячее ядро и насыщенные края.
    vec3 core = mix(vColor, vec3(1.0, 1.0, 0.92), pow(facing, 2.2) * 0.82);
    vec3 on = core * (1.15 + vHover * 0.35 + vWave * 0.4) + spec * 0.35;

    vec3 color = mix(off, on, vLit);
    vec3 capColor = vec3(0.09, 0.08, 0.1) + spec * 0.3 + fresnel * 0.08;
    gl_FragColor = vec4(mix(color, capColor, vCap), 1.0);
  }
`;

const glowVertex = /* glsl */ `
  attribute float aLit;
  attribute float aHover;
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixel;
  uniform vec3 uWaveOrigin;
  uniform float uWaveTime;
  varying vec3 vColor;
  varying float vStrength;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 viewPos = viewMatrix * world;
    float breathe = 0.92 + 0.08 * sin(uTime * (0.8 + aSeed) + aSeed * 30.0);
    float dist = distance(world.xyz, uWaveOrigin);
    float wave = uWaveTime < 0.0 ? 0.0 : exp(-pow((dist - uWaveTime * 3.4) * 1.5, 2.0)) * clamp(1.0 - uWaveTime / 1.6, 0.0, 1.0);
    vStrength = (aLit * breathe) + aHover * 0.35 + wave * 0.16;
    vColor = mix(vec3(0.72, 0.62, 1.0), aColor, aLit);
    float size = (1.0 + aHover * 0.5 + aLit * 1.25);
    gl_PointSize = size * uPixel / -viewPos.z;
    gl_Position = projectionMatrix * viewPos;
    gl_Position.z -= 0.0015 * gl_Position.w;
  }
`;

const glowFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vStrength;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float halo = pow(1.0 - d, 2.6);
    gl_FragColor = vec4(vColor * halo * vStrength * 0.85, 1.0);
  }
`;

type Props = {
  slots: BulbSlot[];
  visuals: BulbVisual[];
  hovered: number | null;
  selected: number | null;
  wave: { origin: THREE.Vector3; at: number } | null;
};

export function Bulbs({ slots, visuals, hovered, selected, wave }: Props) {
  const count = slots.length;
  const { size, viewport } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => bulbGeometry(), []);

  const buffers = useMemo(() => {
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) seeds[i] = ((i * 97) % 101) / 101;
    return {
      lit: new THREE.InstancedBufferAttribute(new Float32Array(count), 1),
      hover: new THREE.InstancedBufferAttribute(new Float32Array(count), 1),
      color: new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3),
      seed: new THREE.InstancedBufferAttribute(seeds, 1),
    };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixel: { value: 300 },
      uWaveOrigin: { value: new THREE.Vector3() },
      uWaveTime: { value: -1 },
    }),
    [],
  );

  const glowGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    slots.forEach((slot, i) => {
      // Ореол сидит в теле лампочки: ось смотрит вниз от крепления.
      const offset = new THREE.Vector3(0, -0.14, 0).applyQuaternion(slot.quaternion).add(slot.position);
      offset.toArray(positions, i * 3);
    });
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aLit", new THREE.BufferAttribute(buffers.lit.array, 1));
    g.setAttribute("aHover", new THREE.BufferAttribute(buffers.hover.array, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(buffers.color.array, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(buffers.seed.array, 1));
    return g;
  }, [slots, count, buffers]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(0.74, 0.74, 0.74);
    slots.forEach((slot, i) => {
      matrix.compose(slot.position, slot.quaternion, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.geometry.setAttribute("aLit", buffers.lit);
    mesh.geometry.setAttribute("aHover", buffers.hover);
    mesh.geometry.setAttribute("aColor", buffers.color);
    mesh.geometry.setAttribute("aSeed", buffers.seed);
  }, [slots, buffers]);

  useEffect(() => {
    const colors = buffers.color.array as Float32Array;
    const dim = new THREE.Color("#5f4f99");
    visuals.forEach((visual, i) => {
      (visual.lit ? visual.color : dim).toArray(colors, i * 3);
    });
    buffers.color.needsUpdate = true;
    const glowColors = glowGeometry.getAttribute("aColor") as THREE.BufferAttribute;
    glowColors.needsUpdate = true;
  }, [visuals, buffers, glowGeometry]);

  useEffect(() => {
    if (!wave) return;
    uniforms.uWaveOrigin.value.copy(wave.origin);
  }, [wave, uniforms]);

  useFrame((state, delta) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPixel.value = (size.height * viewport.dpr) / 7.6;
    uniforms.uWaveTime.value = wave ? (performance.now() - wave.at) / 1000 : -1;

    let dirtyLit = false;
    let dirtyHover = false;
    const lit = buffers.lit.array as Float32Array;
    const hover = buffers.hover.array as Float32Array;
    const litSpeed = Math.min(delta * 2.4, 1);
    const hoverSpeed = Math.min(delta * 12, 1);
    for (let i = 0; i < count; i += 1) {
      const litTarget = visuals[i]?.lit ? 1 : 0;
      if (Math.abs(lit[i] - litTarget) > 0.002) {
        // Вспышка: лампочка разгорается быстрее, чем гаснет.
        lit[i] += (litTarget - lit[i]) * litSpeed;
        dirtyLit = true;
      } else if (lit[i] !== litTarget) {
        lit[i] = litTarget;
        dirtyLit = true;
      }
      const hoverTarget = i === hovered || i === selected ? 1 : 0;
      if (Math.abs(hover[i] - hoverTarget) > 0.002) {
        hover[i] += (hoverTarget - hover[i]) * hoverSpeed;
        dirtyHover = true;
      } else if (hover[i] !== hoverTarget) {
        hover[i] = hoverTarget;
        dirtyHover = true;
      }
    }
    if (dirtyLit) {
      buffers.lit.needsUpdate = true;
      (glowGeometry.getAttribute("aLit") as THREE.BufferAttribute).needsUpdate = true;
    }
    if (dirtyHover) {
      buffers.hover.needsUpdate = true;
      (glowGeometry.getAttribute("aHover") as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  useEffect(() => () => {
    geometry.dispose();
    glowGeometry.dispose();
  }, [geometry, glowGeometry]);

  return (
    <group>
      <instancedMesh key={count} ref={meshRef} args={[geometry, undefined, count]}>
        <shaderMaterial vertexShader={bulbVertex} fragmentShader={bulbFragment} uniforms={uniforms} toneMapped={false} />
      </instancedMesh>
      <points geometry={glowGeometry} frustumCulled={false} renderOrder={5}>
        <shaderMaterial
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          uniforms={uniforms}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          toneMapped={false}
        />
      </points>
    </group>
  );
}
