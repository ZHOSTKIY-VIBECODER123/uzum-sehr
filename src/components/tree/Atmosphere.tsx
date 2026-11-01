"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded, TREE_RADIUS } from "./layout";

const pointFade = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(vColor, pow(1.0 - d, 1.8) * vAlpha);
  }
`;

export function Snow({ count }: { count: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();

  const geometry = useMemo(() => {
    const rand = seeded(5);
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      position[i * 3] = (rand() - 0.5) * 34;
      position[i * 3 + 1] = rand() * 22;
      position[i * 3 + 2] = (rand() - 0.5) * 34;
      seed[i * 2] = rand();
      seed[i * 2 + 1] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 2));
    return g;
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixel: { value: 100 } }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPixel.value = (size.height * viewport.dpr) / 16;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={6}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        vertexShader={/* glsl */ `
          attribute vec2 aSeed;
          uniform float uTime;
          uniform float uPixel;
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            vec3 p = position;
            float fall = uTime * (0.22 + aSeed.x * 0.3);
            p.y = mod(p.y - fall, 22.0) - 1.0;
            p.x += sin(uTime * 0.3 + aSeed.y * 12.0) * 0.45;
            p.z += cos(uTime * 0.26 + aSeed.x * 12.0) * 0.45;
            vec4 view = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (0.08 + aSeed.y * 0.16) * uPixel / -view.z * 4.0;
            vAlpha = 0.25 + aSeed.x * 0.45;
            vColor = vec3(0.93, 0.95, 1.0);
            gl_Position = projectionMatrix * view;
          }
        `}
        fragmentShader={pointFade}
      />
    </points>
  );
}

export function Stars({ count }: { count: number }) {
  const { size, viewport } = useThree();

  const geometry = useMemo(() => {
    const rand = seeded(9);
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const dist = 55 + rand() * 25;
      position[i * 3] = r * Math.cos(theta) * dist;
      position[i * 3 + 1] = Math.abs(u) * dist * 0.9 - 6;
      position[i * 3 + 2] = r * Math.sin(theta) * dist;
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixel: { value: 1 } }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPixel.value = viewport.dpr * Math.max(1, size.height / 760);
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={-2}>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        vertexShader={/* glsl */ `
          attribute float aSeed;
          uniform float uTime;
          uniform float uPixel;
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            vec4 view = modelViewMatrix * vec4(position, 1.0);
            float big = step(0.93, aSeed);
            gl_PointSize = (1.3 + aSeed * 1.8 + big * 2.6) * uPixel;
            vAlpha = (0.32 + aSeed * 0.5) * (0.72 + 0.28 * sin(uTime * (0.5 + aSeed * 1.6) + aSeed * 50.0));
            vColor = mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.93, 0.78), step(0.72, fract(aSeed * 13.0)));
            gl_Position = projectionMatrix * view;
          }
        `}
        fragmentShader={pointFade}
      />
    </points>
  );
}

// Световая лента вокруг ёлки: только искры на спирали, без тяжёлой геометрии.
export function LightRibbon({ count }: { count: number }) {
  const { size, viewport } = useThree();

  const geometry = useMemo(() => {
    const rand = seeded(31);
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      position[i * 3] = i / count;
      position[i * 3 + 1] = (rand() - 0.5) * 0.09;
      position[i * 3 + 2] = (rand() - 0.5) * 0.09;
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixel: { value: 100 }, uRadius: { value: TREE_RADIUS * 1.14 } }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPixel.value = (size.height * viewport.dpr) / 24;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  if (count === 0) return null;

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={4}>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        vertexShader={/* glsl */ `
          attribute float aSeed;
          uniform float uTime;
          uniform float uPixel;
          uniform float uRadius;
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            float t = position.x;
            float y = 0.7 + t * 5.5;
            float radius = uRadius * (1.0 - t * 0.62);
            float angle = t * 18.0 - uTime * 0.14;
            vec3 p = vec3(cos(angle) * radius, y + position.y * 3.0, sin(angle) * radius);
            p.xz += position.z * 2.0;
            vec4 view = modelViewMatrix * vec4(p, 1.0);
            float travel = fract(t * 2.0 - uTime * 0.05);
            vAlpha = smoothstep(0.0, 0.5, travel) * smoothstep(1.0, 0.55, travel) * (0.35 + aSeed * 0.65);
            vColor = mix(vec3(1.0, 0.9, 0.72), vec3(0.75, 0.6, 1.0), t);
            gl_PointSize = (0.25 + aSeed * 0.5) * uPixel / -view.z * 4.0;
            gl_Position = projectionMatrix * view;
          }
        `}
        fragmentShader={pointFade}
      />
    </points>
  );
}

// Световой постамент под ёлкой.
export function Pedestal({ progress }: { progress: number }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uProgress: { value: progress } }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, delta) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uProgress.value += (progress - uniforms.uProgress.value) * Math.min(delta * 2, 1);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={1}>
      <circleGeometry args={[TREE_RADIUS * 1.9, 96]} />
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime;
          uniform float uProgress;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv - 0.5;
            float r = length(p) * 2.0;
            float angle = atan(p.y, p.x) / 6.28318 + 0.5;
            float disc = smoothstep(1.0, 0.0, r) * 0.2;
            float ring = exp(-pow((r - 0.74) * 60.0, 2.0));
            float halo = exp(-pow((r - 0.74) * 9.0, 2.0)) * 0.22;
            // Дуга кольца растёт вместе с прогрессом акции.
            float arc = smoothstep(uProgress + 0.003, uProgress, angle);
            vec3 lime = vec3(0.66, 0.94, 0.0);
            vec3 violet = vec3(0.52, 0.22, 0.91);
            vec3 base = vec3(0.45, 0.42, 0.75) * (ring * 0.32 + halo * 0.5);
            vec3 lit = mix(violet, lime, angle) * (ring * 1.0 + halo * 0.7) * arc;
            vec3 color = base + lit + vec3(0.30, 0.2, 0.72) * disc;
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// Звезда на вершине разгорается вместе с ёлкой.
export function TopStar({ y, progress }: { y: number; progress: number }) {
  const glow = useRef<THREE.ShaderMaterial>(null);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? 0.42 : 0.17;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return s;
  }, []);

  const uniforms = useMemo(() => ({ uStrength: { value: 0.3 } }), []);

  useFrame((state, delta) => {
    const target = 0.28 + progress * 0.9 + Math.sin(state.clock.elapsedTime * 1.2) * 0.05;
    uniforms.uStrength.value += (target - uniforms.uStrength.value) * Math.min(delta * 2, 1);
  });

  return (
    <group position={[0, y, 0]}>
      <mesh>
        <extrudeGeometry args={[shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }]} />
        <meshBasicMaterial color={new THREE.Color(1.0, 0.86, 0.55).multiplyScalar(0.5 + progress * 0.6)} toneMapped={false} />
      </mesh>
      <sprite scale={[3.2, 3.2, 1]} renderOrder={7}>
        <shaderMaterial
          ref={glow}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          vertexShader={/* glsl */ `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
              mv.xy += (uv - 0.5) * 3.2;
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={/* glsl */ `
            uniform float uStrength;
            varying vec2 vUv;
            void main() {
              vec2 p = (vUv - 0.5) * 2.0;
              float d = length(p);
              float halo = pow(max(1.0 - d, 0.0), 3.0);
              float rays = pow(max(1.0 - abs(p.x * p.y) * 34.0, 0.0), 3.0) * pow(max(1.0 - d, 0.0), 2.0);
              gl_FragColor = vec4(vec3(1.0, 0.86, 0.58) * (halo * 0.7 + rays * 0.5) * uStrength, 1.0);
            }
          `}
        />
      </sprite>
    </group>
  );
}

// Вспышка искр при зажигании лампочки.
export function Burst({ burst }: { burst: { origin: THREE.Vector3; color: THREE.Color; at: number } | null }) {
  const COUNT = 70;
  const { size, viewport } = useThree();

  const geometry = useMemo(() => {
    const rand = seeded(21);
    const velocity = new Float32Array(COUNT * 3);
    const position = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      const v = new THREE.Vector3(rand() - 0.5, rand() - 0.32, rand() - 0.5).normalize().multiplyScalar(0.9 + rand() * 1.7);
      v.toArray(velocity, i * 3);
      seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aVel", new THREE.BufferAttribute(velocity, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uT: { value: -1 },
      uOrigin: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color() },
      uPixel: { value: 100 },
    }),
    [],
  );

  useEffect(() => {
    if (!burst) return;
    uniforms.uOrigin.value.copy(burst.origin);
    uniforms.uColor.value.copy(burst.color);
  }, [burst, uniforms]);

  useFrame(() => {
    uniforms.uT.value = burst ? (performance.now() - burst.at) / 1000 : -1;
    uniforms.uPixel.value = (size.height * viewport.dpr) / 22;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={8}>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        vertexShader={/* glsl */ `
          attribute vec3 aVel;
          attribute float aSeed;
          uniform float uT;
          uniform vec3 uOrigin;
          uniform vec3 uColor;
          uniform float uPixel;
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            float life = 1.1 + aSeed * 0.9;
            float k = uT / life;
            vAlpha = (uT < 0.0 || k > 1.0) ? 0.0 : pow(1.0 - k, 1.6);
            vec3 p = uOrigin + aVel * (1.0 - exp(-uT * 2.2)) * 0.9;
            p.y -= 0.34 * uT * uT;
            vec4 view = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (0.4 + aSeed * 0.7) * uPixel / -view.z * 4.0;
            vColor = mix(uColor, vec3(1.0), 0.25 + aSeed * 0.3);
            gl_Position = projectionMatrix * view;
          }
        `}
        fragmentShader={pointFade}
      />
    </points>
  );
}
