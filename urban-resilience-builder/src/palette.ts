import type { CellType } from "./types";

export interface BlockDef {
  type: CellType;
  label: string;
  color: string;
}

export const BLOCKS: BlockDef[] = [
  { type: "empty", label: "Eraser", color: "#111827" },
  { type: "tree", label: "Trees", color: "#16a34a" },
  { type: "water", label: "Water", color: "#2563eb" },
  { type: "building", label: "Building", color: "#9ca3af" },
  { type: "road", label: "Road", color: "#374151" },
  { type: "barrier", label: "Flood Barrier", color: "#f59e0b" },
];
