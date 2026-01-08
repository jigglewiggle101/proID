import type { Scenario } from "./types";

export const SCENARIOS: Scenario[] = [
  {
    id: "heat",
    title: "Extreme Heat Zone",
    successCriteria: [
      "Increase greenery/shade coverage",
      "Reduce heat around buildings/roads",
      "Create cooling corridors (trees/water)",
    ],
    defaultParams: {
      heatBaseBoost: 6,
      treeCoolingMultiplier: 1.0,
      floodStepsBoost: 0,
    },
  },
  {
    id: "flood",
    title: "Flood Risk Zone",
    successCriteria: [
      "Use barriers to block flood spread",
      "Protect buildings from flood paths",
      "Add buffer zones / water routing",
    ],
    defaultParams: {
      heatBaseBoost: 0,
      treeCoolingMultiplier: 1.0,
      floodStepsBoost: 4,
    },
  },
  {
    id: "land",
    title: "Land Scarcity Zone",
    successCriteria: [
      "Keep surface space for community/greenery",
      "Maintain resilience under crisis events",
    ],
    defaultParams: {
      heatBaseBoost: 0,
      treeCoolingMultiplier: 1.0,
      floodStepsBoost: 0,
    },
  },
];
