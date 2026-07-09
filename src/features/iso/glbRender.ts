/**
 * GLB/GLTF → 스프라이트 렌더 (v1.1.5).
 *
 * 현재 3D 미리보기는 Canvas 2D 아이소메트릭 렌더러(renderIso.ts)라 메쉬를 직접 그릴 수 없습니다.
 * 그래서 Three.js(WebGL)로 GLB 를 현재 카메라 각도(방위/고도)에 맞춰 오프스크린 렌더하여
 * 투명 PNG "스프라이트" 로 만든 뒤, renderIso 가 footprint 위치에 깊이순으로 합성합니다.
 *
 * - 입력한 실물 사이즈(mm)로 자동 스케일(축별)
 * - BoundingBox minY 기준 바닥 접지
 * - 집기 회전값(수직축) 적용
 * - Three.js 는 3D 미리보기에서 GLB 가 있을 때만 동적 import (초기 번들 영향 최소화)
 */

export interface GlbSpriteResult {
  /** 스프라이트 PNG dataURL (투명 배경) */
  dataUrl: string;
  /** 스프라이트 px 크기 (정사각) */
  spx: number;
  /** 스프라이트의 px/mm (합성 스케일 계산용) */
  pxPerMm: number;
  /** 스프라이트 안에서 모델 바닥중심(월드 0,0,0)이 투영된 픽셀 위치 */
  anchorX: number;
  anchorY: number;
}

export interface GlbRenderOptions {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  rotationDeg: number;
  azimuthDeg: number;
  elevationDeg: number;
  /** 스프라이트 해상도(px, 정사각). 기본 640 */
  spx?: number;
}

// three 모듈/렌더러/로더 캐시 (동적 import 1회)
let threeMod: typeof import('three') | null = null;
let loaderMod: typeof import('three/examples/jsm/loaders/GLTFLoader.js') | null = null;
let renderer: import('three').WebGLRenderer | null = null;

async function ensureThree() {
  if (!threeMod) threeMod = await import('three');
  if (!loaderMod) loaderMod = await import('three/examples/jsm/loaders/GLTFLoader.js');
  return { THREE: threeMod, GLTFLoader: loaderMod.GLTFLoader };
}

/** GLB ArrayBuffer 를 파싱해 씬(Group) 로드 */
function parseGlb(
  GLTFLoader: typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader,
  buffer: ArrayBuffer,
): Promise<import('three').Object3D> {
  return new Promise((resolve, reject) => {
    try {
      const loader = new GLTFLoader();
      loader.parse(buffer, '', (gltf) => resolve(gltf.scene), (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * GLB 를 실물 사이즈·회전·카메라 각도에 맞춰 렌더한 스프라이트를 반환. 실패 시 null.
 */
export async function renderGlbSprite(
  buffer: ArrayBuffer,
  opts: GlbRenderOptions,
): Promise<GlbSpriteResult | null> {
  try {
    const { THREE, GLTFLoader } = await ensureThree();
    const spx = opts.spx ?? 640;

    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setClearColor(0x000000, 0);
    }
    renderer.setSize(spx, spx, false);

    const root = await parseGlb(GLTFLoader, buffer);

    // 1) 실물 사이즈로 축별 스케일 (X=가로, Y=높이, Z=깊이 가정)
    const box0 = new THREE.Box3().setFromObject(root);
    const size0 = box0.getSize(new THREE.Vector3());
    const sx = size0.x > 1e-6 ? opts.widthMm / size0.x : 1;
    const sy = size0.y > 1e-6 ? opts.heightMm / size0.y : 1;
    const sz = size0.z > 1e-6 ? opts.depthMm / size0.z : 1;
    root.scale.set(sx, sy, sz);

    // 2) 바닥 접지 + 가로/깊이 중심 정렬 (BoundingBox minY → 0)
    const box1 = new THREE.Box3().setFromObject(root);
    const center1 = box1.getCenter(new THREE.Vector3());
    root.position.set(-center1.x, -box1.min.y, -center1.z);

    // 3) 집기 회전(수직축 Y)
    const group = new THREE.Group();
    group.add(root);
    group.rotation.y = (-opts.rotationDeg * Math.PI) / 180;

    const scene = new THREE.Scene();
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(1, 2, 1.5);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dir2.position.set(-1, 1, -1);
    scene.add(dir2);

    // 4) 프레이밍: 회전 반영한 바운딩 스피어
    const box = new THREE.Box3().setFromObject(group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(1, sphere.radius);
    const frust = radius * 2 * 1.08; // 여유 8%
    const pxPerMm = spx / frust;

    // 5) 카메라(정사영)를 방위/고도에 맞춰 배치
    const az = (opts.azimuthDeg * Math.PI) / 180;
    const el = (Math.max(15, Math.min(89, opts.elevationDeg)) * Math.PI) / 180;
    const dist = radius * 6 + 100;
    const cx = sphere.center.x;
    const cy = sphere.center.y;
    const cz = sphere.center.z;
    const cam = new THREE.OrthographicCamera(-frust / 2, frust / 2, frust / 2, -frust / 2, 0.1, dist * 2 + radius * 4);
    cam.position.set(
      cx + dist * Math.cos(el) * Math.sin(az),
      cy + dist * Math.sin(el),
      cz + dist * Math.cos(el) * Math.cos(az),
    );
    cam.up.set(0, 1, 0);
    cam.lookAt(cx, cy, cz);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();

    renderer.render(scene, cam);
    const dataUrl = renderer.domElement.toDataURL('image/png');

    // 6) 바닥중심(월드 0,0,0)의 스프라이트 픽셀 위치 계산 (합성 앵커)
    const floor = new THREE.Vector3(0, 0, 0).project(cam);
    const anchorX = (floor.x * 0.5 + 0.5) * spx;
    const anchorY = (-floor.y * 0.5 + 0.5) * spx;

    // 메모리 정리 (지오메트리/텍스처)
    scene.traverse((o) => {
      const m = o as unknown as { geometry?: { dispose?: () => void }; material?: unknown };
      m.geometry?.dispose?.();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => (x as { dispose?: () => void }).dispose?.());
      else (mat as { dispose?: () => void } | undefined)?.dispose?.();
    });

    return { dataUrl, spx, pxPerMm, anchorX, anchorY };
  } catch (e) {
    console.error('[glbRender] failed', e);
    return null;
  }
}
