import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CellType, Grid, HeatMap } from "./types";
import { BLOCKS } from "./palette";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Props = {
  grid: Grid;
  heatMap: HeatMap | null;
  floodMap: boolean[][] | null;
  cellSize?: number;

  selectedType: CellType;
  onPaintCell: (x: number, y: number, type: CellType) => void;

  showHeat: boolean;
  showFlood: boolean;
};

export default function GridCanvas({
  grid,
  heatMap,
  floodMap,
  cellSize = 24,
  selectedType,
  onPaintCell,
  showHeat,
  showFlood,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPainting, setIsPainting] = useState(false);

  const colorByType = useMemo(() => {
    const m = new Map<CellType, string>();
    for (const b of BLOCKS) m.set(b.type, b.color);
    return m;
  }, []);

  const width = grid[0].length * cellSize;
  const height = grid.length * cellSize;

  function getCellFromEvent(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);
    return {
      x: clamp(x, 0, grid[0].length - 1),
      y: clamp(y, 0, grid.length - 1),
    };
  }

  function handleDown(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    setIsPainting(true);
    const { x, y } = getCellFromEvent(e);
    onPaintCell(x, y, selectedType);
  }

  function handleMove(e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    if (!isPainting) return;
    const { x, y } = getCellFromEvent(e);
    onPaintCell(x, y, selectedType);
  }

  function handleUp() {
    setIsPainting(false);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Base tiles
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        const t = grid[y][x];
        ctx.fillStyle = colorByType.get(t) ?? "#111827";
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    // Grid lines
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#0f172a";
    for (let x = 0; x <= grid[0].length; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, height);
      ctx.stroke();
    }
    for (let y = 0; y <= grid.length; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(width, y * cellSize);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Heat overlay
    if (showHeat && heatMap) {
      for (let y = 0; y < heatMap.length; y++) {
        for (let x = 0; x < heatMap[0].length; x++) {
          const v = heatMap[y][x]; // 0..100
          const alpha = clamp(v / 120, 0, 0.65);
          ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Flood overlay
    if (showFlood && floodMap) {
      for (let y = 0; y < floodMap.length; y++) {
        for (let x = 0; x < floodMap[0].length; x++) {
          if (!floodMap[y][x]) continue;
          ctx.fillStyle = `rgba(50, 140, 255, 0.55)`;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [grid, heatMap, floodMap, cellSize, width, height, colorByType, showHeat, showFlood]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#0b1220",
        display: "block",
        touchAction: "none",
      }}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
    />
  );
}
