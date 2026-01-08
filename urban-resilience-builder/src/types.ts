// src/types.ts
export type PropType = "car" | "trafficLight";

export interface PropEntity {
  id: string;
  type: PropType;
  x: number;
  y: number;
  rotationY?: number; // radians
}

export type RoadStyle = "tile" | "mainroad";

export type ModelPrefs = Partial<{
  treeModel: string;
  waterModel: string;
  buildingModel: string;
  barrierModel: string;
  roadStyle: RoadStyle; 
}>;

export type ModelCatalog = {
  tree: string[];
  water: string[];
  building: string[];
  barrier: string[];
  roadStyles: RoadStyle[];
};

export type CellType =
  | "empty"
  | "tree"
  | "water"
  | "building"
  | "road"
  | "barrier"
 

export type Grid = CellType[][];
export type HeatMap = number[][];

export interface FloodResult {
  flooded: boolean[][];
  buildingDamage: number;
}

/** Shared simulation tuning knobs (Scenario defaults + Crisis modifiers). */
export interface SimParams {
  heatBaseBoost?: number;
  treeCoolingMultiplier?: number;
  floodStepsBoost?: number;
  twoEdgeFlood?: boolean;
}

export interface Crisis {
  id: string;
  title: string;
  description: string;
  params: SimParams;
}

export type ScenarioId = "heat" | "flood" | "land";

export interface Scenario {
  id: ScenarioId;
  title: string;
  successCriteria: string[]; // optional but helpful for scoring explanation
  defaultParams: SimParams;
}

export interface Solution {
  id: string;
  name: string;
  oneLiner: string;
  targetUsers: string[];
  uniqueFeatures: string[];
}