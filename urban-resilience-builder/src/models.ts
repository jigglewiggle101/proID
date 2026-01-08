import type { CellType } from "./types";

export const MODEL_FILES: Partial<Record<CellType, string[]>> = {
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

export const ROAD_MODELS = {
  straight: "tile-road-straight.glb",
  curve: "tile-road-curve.glb",
  t: "tile-road-intersection-t.glb",
  cross: "tile-road-intersection.glb",
  end: "tile-road-end.glb",
};

export const PROP_MODELS = {
  car: ["car-taxi.glb", "car-passenger.glb", "car-police.glb"],
  trafficLight: ["traffic-lights.glb"],
};

export const SUBWAY_MODEL = "free__subway_station__r46_subway.glb";