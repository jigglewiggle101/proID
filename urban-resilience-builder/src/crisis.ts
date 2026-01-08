import type { Crisis } from "./types";

export const CRISIS_DECK: Crisis[] = [
  {
    id: "heatwave",
    title: "Heatwave 36°C!",
    description: "Baseline heat rises; trees cool less effectively.",
    params: { heatBaseBoost: 12, treeCoolingMultiplier: 0.7, floodStepsBoost: 0 },
  },
  {
    id: "flood30",
    title: "Floodwater +30cm!",
    description: "Flood spreads further and faster.",
    params: { floodStepsBoost: 6 },
  },
  {
    id: "tidalGateFail",
    title: "Tidal Gate Failure!",
    description: "Flood starts from two edges instead of one.",
    params: { floodStepsBoost: 4, twoEdgeFlood: true },
  },
  {
    id: "stormSurge",
    title: "Storm Surge Incoming!",
    description: "Coastal flooding pressure increases significantly.",
    params: { floodStepsBoost: 8 },
  },
];

export function pickRandomCrisis(): Crisis {
  const idx = Math.floor(Math.random() * CRISIS_DECK.length);
  return CRISIS_DECK[idx];
}
