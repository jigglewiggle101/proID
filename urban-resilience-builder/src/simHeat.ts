import type { Grid, HeatMap, SimParams, CellType } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Realistic summer daytime surface-ish temperatures (hot city scenario)
const BASE_HEAT: Record<CellType, number> = {
  empty:   48,       // neutral
  tree:    28,       // strong shade + evap
  water:   24,       // evaporative cooling
  building: 70,      // concrete absorbs a lot
  road:    78,       // asphalt hottest
  barrier: 55,

};

// Cooling / heating per distance (strong close, falloff fast)
const TREE_COOL: number[] = [7.5, 4.2, 1.8, 0.6]; // dist 1–4 cells
const WATER_COOL: number[] = [5.0, 2.5, 0.8];     // dist 1–3
const HOT_EMIT: number[]   = [3.5, 1.5];          // buildings/roads emit dist 1–2

// Extended neighborhood (Manhattan dist ≤4 for smooth gradients)
const NEIGHBORS: Array<{dx: number, dy: number, dist: number}> = [];
for (let dy = -4; dy <= 4; dy++) {
  for (let dx = -4; dx <= 4; dx++) {
    if (dx === 0 && dy === 0) continue;
    const manh = Math.abs(dx) + Math.abs(dy);
    if (manh <= 4) NEIGHBORS.push({ dx, dy, dist: manh });
  }
}

export function simulateHeat(grid: Grid, opts: SimParams = {}): HeatMap {
  const heatBaseBoost = opts.heatBaseBoost ?? 0;
  const treeMultiplier = opts.treeCoolingMultiplier ?? 1.0;

  const h = grid.length;
  const w = grid[0].length;
  const heat: HeatMap = Array.from({ length: h }, () => Array(w).fill(0));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = grid[y][x];
      let value = BASE_HEAT[t] + heatBaseBoost;

      let treeCoolTotal = 0;
      let waterCoolTotal = 0;
      let hotEmitTotal = 0;

      for (const {dx, dy, dist} of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;

        const nt = grid[ny][nx];

        if (nt === "tree") {
          const idx = dist - 1;
          if (idx < TREE_COOL.length) treeCoolTotal += TREE_COOL[idx];
        }
        if (nt === "water") {
          const idx = dist - 1;
          if (idx < WATER_COOL.length) waterCoolTotal += WATER_COOL[idx];
        }
        if (nt === "building" || nt === "road") {
          const idx = dist - 1;
          if (idx < HOT_EMIT.length) hotEmitTotal += HOT_EMIT[idx];
        }
      }

      value -= (treeCoolTotal * treeMultiplier) + waterCoolTotal;
      value += hotEmitTotal;

      heat[y][x] = clamp(value, 22, 92); // realistic range
    }
  }

  return heat;
}