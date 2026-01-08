// src/Grid3D.tsx
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CellType, Grid, HeatMap, PropEntity, ModelPrefs } from "./types";

// Base colors for overlay tiles (used for heat/flood tint + hit test tiles)
const COLOR_BY_TYPE: Record<CellType, number> = {
  empty: 0x111827,
  tree: 0x16a34a,
  water: 0x2563eb,
  building: 0x9ca3af,
  road: 0x374151,
  barrier: 0xf59e0b,
};

// --- Your file names in /public/models (use exactly what you have) ---
const TILE_MODELS: Partial<Record<CellType, string[]>> = {
  tree: ["tree-oak.glb", "tree-lime.glb", "tree.glb", "tree-forest.glb"],
  water: ["tile-water.glb"],
  building: [
    "building-house-family-small.glb",
    "building-house-modern.glb",
    "building-mall.glb",
    "building-skyscraper.glb",
    "industry-building.glb",
    "industry-factory.glb",
  ],
  barrier: ["fence.glb", "fence-stone-gate.glb", "fence-classic.glb"],
};

// Road models (auto-picked based on neighbours)
const ROAD_MODELS = {
  straight: "tile-road-straight.glb",
  curve: "tile-road-curve.glb",
  t: "tile-road-intersection-t.glb",
  cross: "tile-road-intersection.glb",
  end: "tile-road-end.glb",
};

const PROP_MODELS: Record<PropEntity["type"], string[]> = {
  car: ["car-taxi.glb", "car-passenger.glb", "car-police.glb"],
  trafficLight: ["traffic-lights.glb"],
};

type Props = {
  grid: Grid;
  heatMap: HeatMap | null;
  floodMap: boolean[][] | null;
  showHeat: boolean;
  showFlood: boolean;

  selectedType: CellType;
  onPaintCell: (x: number, y: number, type: CellType) => void;

  cellSize?: number;
  props?: PropEntity[];
  modelPrefs?: ModelPrefs; // from App dropdowns
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pathOf(file: string) {
  return `/models/${file}`;
}

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isRoad(t: CellType) {
  return t === "road";
}

function roadMask(grid: Grid, x: number, y: number) {
  const rows = grid.length;
  const cols = grid[0].length;
  const n = y > 0 && isRoad(grid[y - 1][x]);
  const s = y < rows - 1 && isRoad(grid[y + 1][x]);
  const w = x > 0 && isRoad(grid[y][x - 1]);
  const e = x < cols - 1 && isRoad(grid[y][x + 1]);
  return { n, s, w, e, count: Number(n) + Number(s) + Number(w) + Number(e) };
}

function pickRoadVariant(mask: ReturnType<typeof roadMask>) {
  const { n, s, w, e, count } = mask;

  if (count >= 4) return { file: ROAD_MODELS.cross, rot: 0 };

  if (count === 3) {
    if (!n) return { file: ROAD_MODELS.t, rot: Math.PI };
    if (!s) return { file: ROAD_MODELS.t, rot: 0 };
    if (!w) return { file: ROAD_MODELS.t, rot: Math.PI / 2 };
    return { file: ROAD_MODELS.t, rot: -Math.PI / 2 };
  }

  if (count === 2) {
    if ((n && s) || (w && e)) {
      const rot = n && s ? Math.PI / 2 : 0;
      return { file: ROAD_MODELS.straight, rot };
    }
    if (n && e) return { file: ROAD_MODELS.curve, rot: 0 };
    if (e && s) return { file: ROAD_MODELS.curve, rot: -Math.PI / 2 };
    if (s && w) return { file: ROAD_MODELS.curve, rot: Math.PI };
    return { file: ROAD_MODELS.curve, rot: Math.PI / 2 };
  }

  if (count === 1) {
    if (n) return { file: ROAD_MODELS.end, rot: Math.PI };
    if (s) return { file: ROAD_MODELS.end, rot: 0 };
    if (w) return { file: ROAD_MODELS.end, rot: Math.PI / 2 };
    return { file: ROAD_MODELS.end, rot: -Math.PI / 2 };
  }

  return { file: ROAD_MODELS.straight, rot: 0 };
}

function pickTileModel(type: CellType, prefs?: ModelPrefs): string | null {
  if (!prefs) return null;
  if (type === "tree") return prefs.treeModel ?? null;
  if (type === "water") return prefs.waterModel ?? null;
  if (type === "building") return prefs.buildingModel ?? null;
  if (type === "barrier") return prefs.barrierModel ?? null;
  return null;
}

function tameMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const mat = mesh.material;
    const materials = Array.isArray(mat) ? mat : [mat];

    for (const m of materials) {
      const std = m as THREE.MeshStandardMaterial;

      if (typeof std.metalness === "number") std.metalness = 0.0;
      if (typeof std.roughness === "number") std.roughness = 0.95;

      if ("emissive" in std && std.emissive && std.emissive instanceof THREE.Color) {
        std.emissive.set(0x000000);
      }

      std.needsUpdate = true;
    }
  });
}

function normalizeToTile(obj: THREE.Object3D, tileSize: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim <= 0) return;

  const target = tileSize * 0.85;
  const s = target / maxDim;
  obj.scale.setScalar(s);

  const box2 = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  obj.position.sub(center);

  const box3 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box3.min.y;
}

function cloneModel(src: THREE.Object3D): THREE.Object3D {
  return src.clone(true);
}

export default function Grid3D({
  grid,
  heatMap,
  floodMap,
  showHeat,
  showFlood,
  selectedType,
  onPaintCell,
  cellSize = 1,
  props = [],
  modelPrefs,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());

  const tileMeshesRef = useRef<THREE.Mesh[][] | null>(null);

  const modelCacheRef = useRef<Record<string, THREE.Object3D>>({});

  const tilesHolderRef = useRef<THREE.Group | null>(null);
  const propsHolderRef = useRef<THREE.Group | null>(null);

  const rows = grid.length;
  const cols = grid[0].length;

  const baseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6,
        metalness: 0,
      }),
    []
  );

  // INIT SCENE
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88ccff); // soft sky blue
    scene.fog = new THREE.FogExp2(0x88ccff, 0.0008); // gentle atmospheric fade

    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      3000 // increased far plane for large ground
    );
    camera.position.set(cols * 0.8, rows * 1.5, cols * 1.8); // higher & farther
    camera.lookAt(cols * 0.5, 0, rows * 0.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(50, 100, 50);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 500;
    dir.shadow.camera.left = -cols * cellSize * 4;
    dir.shadow.camera.right = cols * cellSize * 4;
    dir.shadow.camera.top = rows * cellSize * 4;
    dir.shadow.camera.bottom = -rows * cellSize * 4;
    scene.add(dir);

    // LARGE ground plane with solid green color (classy & reliable)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x88aa88, // soft green
      roughness: 1.0,
      metalness: 0.0,
    });

    const groundSize = Math.max(cols, rows) * cellSize * 10; // 10× larger - no black edges
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      groundMaterial
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01; // tiny offset to avoid z-fighting
    ground.receiveShadow = true;
    scene.add(ground);

    // Optional grid helper (comment out for cleaner look)
    const gridHelper = new THREE.GridHelper(
      cols * cellSize,
      cols,
      0x23304a,
      0x172035
    );
    gridHelper.position.set(
      (cols * cellSize) / 2 - cellSize / 2,
      0,
      (rows * cellSize) / 2 - cellSize / 2
    );
    scene.add(gridHelper);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(
      (cols * cellSize) / 2 - cellSize / 2,
      0,
      (rows * cellSize) / 2 - cellSize / 2
    );
    controls.update();
    controlsRef.current = controls;

    const tilesHolder = new THREE.Group();
    scene.add(tilesHolder);
    tilesHolderRef.current = tilesHolder;

    const propsHolder = new THREE.Group();
    scene.add(propsHolder);
    propsHolderRef.current = propsHolder;

    // Base tile meshes (hit testing + overlay tint)
    const tiles: THREE.Mesh[][] = [];
    const geom = new THREE.BoxGeometry(cellSize * 0.95, 0.18, cellSize * 0.95);

    for (let y = 0; y < rows; y++) {
      const row: THREE.Mesh[] = [];
      for (let x = 0; x < cols; x++) {
        const mesh = new THREE.Mesh(geom, baseMaterial.clone());
        mesh.position.set(x * cellSize, 0.09, y * cellSize);
        mesh.userData = { x, y, isTile: true };
        mesh.receiveShadow = true;
        scene.add(mesh);
        row.push(mesh);
      }
      tiles.push(row);
    }
    tileMeshesRef.current = tiles;

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);

      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat?.dispose?.();
      });
    };
  }, [rows, cols, cellSize, baseMaterial]);

  // LOAD MODELS ONCE
  useEffect(() => {
    const loader = new GLTFLoader();

    const files = new Set<string>();
    Object.values(TILE_MODELS).forEach((arr) => arr?.forEach((f) => files.add(f)));
    Object.values(ROAD_MODELS).forEach((f) => files.add(f));
    Object.values(PROP_MODELS).forEach((arr) => arr.forEach((f) => files.add(f)));

    files.forEach((file) => {
      if (modelCacheRef.current[file]) return;

      loader.load(
        pathOf(file),
        (gltf) => {
          const model = gltf.scene;
          tameMaterials(model);
          normalizeToTile(model, cellSize);
          modelCacheRef.current[file] = model;
        },
        undefined,
        (err) => console.warn("Failed to load", file, err)
      );
    });
  }, [cellSize]);

  // UPDATE TILE COLORS (heat/flood overlays) + hide base under roads
  useEffect(() => {
    const tiles = tileMeshesRef.current;
    if (!tiles) return;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = grid[y][x];
        const mesh = tiles[y][x];
        const mat = mesh.material as THREE.MeshStandardMaterial;

        const base = new THREE.Color(COLOR_BY_TYPE[t]);

        if (showHeat && heatMap) {
          const raw = heatMap[y][x];
          const norm = clamp((raw - 22) / (92 - 22), 0, 1);

          let color: THREE.Color;

          if (norm < 0.2) color = new THREE.Color(0x0000ff);
          else if (norm < 0.4) color = new THREE.Color(0x00ffff);
          else if (norm < 0.55) color = new THREE.Color(0x00ff00);
          else if (norm < 0.7) color = new THREE.Color(0xffff00);
          else if (norm < 0.85) color = new THREE.Color(0xff9900);
          else color = new THREE.Color(0xff0000);

          base.lerp(color, 0.75);
        }

        if (showFlood && floodMap && floodMap[y][x]) {
          base.lerp(new THREE.Color(0x328cff), 0.55);
        }

        mat.color.copy(base);

        if (t === "road") {
          mat.transparent = true;
          mat.opacity = 0;
        } else {
          mat.transparent = false;
          mat.opacity = 1;
        }
      }
    }
  }, [grid, heatMap, floodMap, showHeat, showFlood, rows, cols]);

  // RENDER GLB TILES (on top) + modelPrefs support
  useEffect(() => {
    const holder = tilesHolderRef.current;
    if (!holder) return;

    holder.clear();
    const cache = modelCacheRef.current;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const type = grid[y][x];
        if (type === "empty") continue;

        let file: string | null = null;
        let rotY = 0;

        if (type === "road") {
          const choice = pickRoadVariant(roadMask(grid, x, y));
          file = choice.file;
          rotY = choice.rot;
        } else {
          file = pickTileModel(type, modelPrefs);

          if (!file) {
            const opts = TILE_MODELS[type];
            if (!opts || opts.length === 0) continue;
            file = pickRandom(opts);
          }
        }

        const src = cache[file];
        if (!src) continue;

        const obj = cloneModel(src);
        obj.position.set(x * cellSize, 0.18, y * cellSize);
        obj.rotation.y = rotY;

        holder.add(obj);
      }
    }
  }, [grid, rows, cols, cellSize, modelPrefs]);

  // RENDER PROPS
  useEffect(() => {
    const holder = propsHolderRef.current;
    if (!holder) return;

    holder.clear();
    const cache = modelCacheRef.current;

    for (const p of props) {
      const arr = PROP_MODELS[p.type];
      if (!arr?.length) continue;

      const file = pickRandom(arr);
      const src = cache[file];
      if (!src) continue;

      const obj = cloneModel(src);
      obj.position.set(p.x * cellSize, 0.18, p.y * cellSize);
      obj.rotation.y = p.rotationY ?? 0;

      obj.scale.multiplyScalar(0.75);

      holder.add(obj);
    }
  }, [props, cellSize]);

  // CLICK TO PAINT
  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    const onPointerDown = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(pointerRef.current, camera);

      const hits = raycaster.intersectObjects(scene.children, true);

      const hit = hits.find((i) => {
        const obj = i.object as THREE.Object3D;
        return (obj.userData as Record<string, unknown>)?.isTile;
      });
      if (!hit) return;

      const data = hit.object.userData as { x: number; y: number };
      onPaintCell(data.x, data.y, selectedType);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    return () => renderer.domElement.removeEventListener("pointerdown", onPointerDown);
  }, [selectedType, onPaintCell]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: 520,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    />
  );
}