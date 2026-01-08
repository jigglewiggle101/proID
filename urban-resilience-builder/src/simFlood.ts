import type { Grid, FloodResult, SimParams, CellType } from "./types";

const DIRS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function inBounds(x: number, y: number, w: number, h: number) {
  return x >= 0 && x < w && y >= 0 && y < h;
}

function isBlocked(tile: CellType) {
  return tile === "barrier";
}

function isWaterSource(tile: CellType) {
  return tile === "water";
}

// Simple elevation for realistic flow (higher = harder to flood)
const ELEVATION: Record<CellType, number> = {
  empty:     0.0,
  tree:     -0.3,     // slight depression
  water:    -0.8,     // low
  building:  1.4,     // raised
  road:      0.4,
  barrier:   2.2,     // high block
};

export function simulateFlood(grid: Grid, opts: SimParams = {}): FloodResult {
  const h = grid.length;
  const w = grid[0].length;

  const steps = 18 + (opts.floodStepsBoost ?? 0);
  const twoEdgeFlood = !!opts.twoEdgeFlood;

  const flooded: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));
  const queue: Array<{ x: number; y: number; d: number }> = [];

  // Source 1: user-placed water tiles
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isWaterSource(grid[y][x])) {
        flooded[y][x] = true;
        queue.push({ x, y, d: 0 });
      }
    }
  }

  // If no water tiles, start from bottom edge (storm surge / coastline)
  if (queue.length === 0) {
    for (let x = 0; x < w; x++) {
      flooded[h - 1][x] = true;
      queue.push({ x, y: h - 1, d: 0 });
    }
    if (twoEdgeFlood) {
      for (let x = 0; x < w; x++) {
        flooded[0][x] = true;
        queue.push({ x, y: 0, d: 0 });
      }
    }
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.d >= steps) continue;

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(nx, ny, w, h)) continue;
      if (flooded[ny][nx]) continue;

      const tile = grid[ny][nx];
      if (isBlocked(tile)) continue;

      const curElev = ELEVATION[grid[cur.y][cur.x]] ?? 0;
      const nextElev = ELEVATION[grid[ny][nx]] ?? 0;

      // Prefer downhill, block steep uphill
      if (nextElev > curElev + 1.5) continue;

      flooded[ny][nx] = true;
      queue.push({ x: nx, y: ny, d: cur.d + 1 });

      // Minor drainage chance (realistic slow recede)
      if (Math.random() < 0.03) flooded[ny][nx] = false;
    }
  }

  let buildingDamage = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (flooded[y][x] && grid[y][x] === "building") buildingDamage++;
    }
  }

  return { flooded, buildingDamage };
}