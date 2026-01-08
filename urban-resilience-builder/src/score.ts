import type { Grid, HeatMap, FloodResult } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export interface ScoreResult {
  avgHeat: number;
  coolCityScore: number;
  floodScore: number;
  crisisAdaptationScore: number;
}

export function computeScores(args: {
  heatMap: HeatMap;
  floodResult: FloodResult;
  surfaceGrid: Grid;
  crisisActive: boolean;
}): ScoreResult {
  const { heatMap, floodResult, surfaceGrid, crisisActive } = args;

  const h = surfaceGrid.length;
  const w = surfaceGrid[0].length;
  const total = h * w;

  // Avg heat
  let sumHeat = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sumHeat += heatMap[y][x];
  const avgHeat = sumHeat / total;

  // Cool City Score: non-linear reward for low heat + green coverage
  const greenCount = surfaceGrid.flat().filter(t => t === "tree" || t === "water").length;
  const greenPct = greenCount / total;
  const coolCityScore = clamp(Math.round(100 - avgHeat * 1.8 + greenPct * 80), 0, 100);

  // Flood Score: penalize clustered damage more
  const floodScore = clamp(Math.round(100 - floodResult.buildingDamage * 8 - (floodResult.buildingDamage > 5 ? 15 : 0)), 0, 100);


  const base = Math.round((coolCityScore + floodScore ) / 3);
  const crisisAdaptationScore = crisisActive ? base : 0;

  return {
    avgHeat: Math.round(avgHeat),
    coolCityScore,
    floodScore,
    crisisAdaptationScore,
  };
}