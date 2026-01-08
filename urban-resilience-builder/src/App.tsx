import { useMemo, useState } from "react";
import type { CellType, Grid, Scenario, SimParams, Crisis, ModelPrefs } from "./types";
import { BLOCKS } from "./palette";
import { SCENARIOS } from "./scenarios";
import { pickRandomCrisis } from "./crisis";
import { simulateHeat } from "./simHeat";
import { simulateFlood } from "./simFlood";
import { computeScores } from "./score";
import Grid3D from "./Grid3D";

const MODEL_CATALOG = {
  tree: [
    "tree-oak.glb",
    "tree-lime.glb",
    "tree.glb",
    "tree-forest.glb"
  ],
  water: ["tile-water.glb"],
  building: [
    "building-house-family-small.glb",
    "building-house-modern.glb",
    "building-mall.glb",
    "building-skyscraper.glb"
  ],
  barrier: [
    "fence.glb",
    "fence-stone-gate.glb",
    "fence-classic.glb"
  ],
  roadStyles: ["tile", "mainroad"]
} as const;

function makeGrid(rows: number, cols: number, fill: CellType = "empty"): Grid {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

function mergeParams(base: SimParams, mod?: SimParams | null): SimParams {
  return { ...base, ...(mod ?? {}) };
}

export default function App() {
  const ROWS = 20;
  const COLS = 20;

  const [modelPrefs, setModelPrefs] = useState<ModelPrefs>(() => ({
    treeModel: MODEL_CATALOG.tree[0],
    waterModel: MODEL_CATALOG.water[0],
    buildingModel: MODEL_CATALOG.building[0],
    barrierModel: MODEL_CATALOG.barrier[0],
    roadStyle: "tile",
  }));

  const [surfaceGrid, setSurfaceGrid] = useState<Grid>(() => makeGrid(ROWS, COLS, "empty"));

  const [selectedType, setSelectedType] = useState<CellType>("tree");

  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [crisis, setCrisis] = useState<Crisis | null>(null);

  const [heatMap, setHeatMap] = useState<number[][] | null>(null);
  const [floodMap, setFloodMap] = useState<boolean[][] | null>(null);
  const [buildingDamage, setBuildingDamage] = useState<number>(0);

  const grid = surfaceGrid; // Only surface layer now

  const params = useMemo(() => mergeParams(scenario.defaultParams, crisis?.params), [scenario, crisis]);

  function paintCell(x: number, y: number, type: CellType) {
    setSurfaceGrid((prev) => {
      if (prev[y][x] === type) return prev;
      const next = prev.map((r) => r.slice());
      next[y][x] = type;
      return next;
    });
  }

  function runHeat() {
    setHeatMap(simulateHeat(surfaceGrid, params));
  }

  function runFlood() {
    const res = simulateFlood(surfaceGrid, params);
    setFloodMap(res.flooded);
    setBuildingDamage(res.buildingDamage);
  }

  function clearOverlays() {
    setHeatMap(null);
    setFloodMap(null);
    setBuildingDamage(0);
  }

  function resetAll() {
    setSurfaceGrid(makeGrid(ROWS, COLS, "empty"));
    setCrisis(null);
    clearOverlays();
  }

  function triggerCrisis() {
    const c = pickRandomCrisis();
    setCrisis(c);
    setHeatMap(simulateHeat(surfaceGrid, mergeParams(scenario.defaultParams, c.params)));
    const res = simulateFlood(surfaceGrid, mergeParams(scenario.defaultParams, c.params));
    setFloodMap(res.flooded);
    setBuildingDamage(res.buildingDamage);
  }

  function onScenarioChange(id: string) {
    const next = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
    setScenario(next);
    setCrisis(null);
    clearOverlays();
  }

  const scores = useMemo(() => {
    const hm = heatMap ?? simulateHeat(surfaceGrid, params);
    const fr = floodMap ? { flooded: floodMap, buildingDamage } : simulateFlood(surfaceGrid, params);

    return computeScores({
      heatMap: hm,
      floodResult: fr,
      surfaceGrid,
      crisisActive: !!crisis,
    });
  }, [heatMap, floodMap, buildingDamage, surfaceGrid, crisis, params]);

  const showHeat = !!heatMap;
  const showFlood = !!floodMap;

  function setPref<K extends keyof ModelPrefs>(key: K, value: ModelPrefs[K]) {
    setModelPrefs((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div style={{ minHeight: "100vh", width: "100vw", overflowX: "hidden", padding: 20, background: "#0b1220", color: "#e8eefc" }}>
      <div style={{ width: "100%", margin: "0 auto" }}>
        <header style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Digital Urban Resilience Builder</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Scenario → Build → Simulate → Crisis → Score</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={scenario.id}
              onChange={(e) => onScenarioChange(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                color: "#e8eefc",
                border: "1px solid rgba(255,255,255,0.12)",
                fontWeight: 800,
              }}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id} style={{ color: "#0b1220" }}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, marginTop: 16 }}>
          <aside style={card}>
            <Title title="Scenario success criteria" subtitle="Use these bullets to justify your scoring logic." />
            <ul style={{ marginTop: 6, paddingLeft: 18, opacity: 0.9, fontSize: 13, lineHeight: 1.4 }}>
              {scenario.successCriteria.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>

            <hr style={hr} />

            <Title title="Blocks" subtitle="Pick a block, then click to paint." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {BLOCKS.map((b) => (
                <button
                  key={b.type}
                  onClick={() => setSelectedType(b.type)}
                  style={{
                  ...blockBtn(selectedType === b.type),
                  borderLeft: `10px solid ${b.color}`,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{b.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{b.type}</div>
                </button>
              ))}
            </div>

            <hr style={hr} />

            <Title title="Model Picker" subtitle="Choose which 3D model to use for each category." />
            <div style={{ display: "grid", gap: 10 }}>
              <label style={label}>
                Tree Model
                <select value={modelPrefs.treeModel ?? ""} onChange={(e) => setPref("treeModel", e.target.value)} style={selectBox}>
                  {MODEL_CATALOG.tree.map((m) => (
                    <option key={m} value={m} style={{ color: "#0b1220" }}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label style={label}>
                Water Model
                <select value={modelPrefs.waterModel ?? ""} onChange={(e) => setPref("waterModel", e.target.value)} style={selectBox}>
                  {MODEL_CATALOG.water.map((m) => (
                    <option key={m} value={m} style={{ color: "#0b1220" }}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label style={label}>
                Building Model
                <select value={modelPrefs.buildingModel ?? ""} onChange={(e) => setPref("buildingModel", e.target.value)} style={selectBox}>
                  {MODEL_CATALOG.building.map((m) => (
                    <option key={m} value={m} style={{ color: "#0b1220" }}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label style={label}>
                Barrier Model
                <select value={modelPrefs.barrierModel ?? ""} onChange={(e) => setPref("barrierModel", e.target.value)} style={selectBox}>
                  {MODEL_CATALOG.barrier.map((m) => (
                    <option key={m} value={m} style={{ color: "#0b1220" }}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label style={label}>
                Road Style (future)
                <select value={modelPrefs.roadStyle ?? "tile"} onChange={(e) => setPref("roadStyle", e.target.value as ModelPrefs["roadStyle"])} style={selectBox}>
                  {MODEL_CATALOG.roadStyles.map((m) => (
                    <option key={m} value={m} style={{ color: "#0b1220" }}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <hr style={hr} />

            <Title title="Simulations" subtitle="Run overlays and generate scores." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={runHeat} style={btnPrimary}>
                Run Heat
              </button>
              <button onClick={runFlood} style={btnPrimary}>
                Run Flood
              </button>
              <button onClick={clearOverlays} style={btnSecondary}>
                Clear
              </button>
              <button onClick={triggerCrisis} style={btnDanger}>
                Crisis Card
              </button>
            </div>

            <hr style={hr} />

            <Title title="Crisis (wildcard)" subtitle="Step 4 of your event flow." />
            <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.04)" }}>
              {crisis ? (
                <>
                  <div style={{ fontWeight: 950 }}>{crisis.title}</div>
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>{crisis.description}</div>
                </>
              ) : (
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  No crisis active. Click <b>Crisis Card</b>.
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <button onClick={resetAll} style={{ ...btnSecondary, width: "100%" }}>
                Reset All
              </button>
            </div>
          </aside>

          <main style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Editor (Surface)</div>
                <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                  Heat: {showHeat ? "ON" : "OFF"} • Flood: {showFlood ? "ON" : "OFF"}
                  {showFlood ? ` • Building damage: ${buildingDamage}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <ScorePill label="Avg Heat" value={`${scores.avgHeat}`} />
                <ScorePill label="Cool City" value={`${scores.coolCityScore}/100`} />
                <ScorePill label="Flood" value={`${scores.floodScore}/100`} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <Grid3D
                grid={grid}
                heatMap={heatMap}
                floodMap={floodMap}
                selectedType={selectedType}
                onPaintCell={paintCell}
                showHeat={showHeat}
                showFlood={showFlood}
                cellSize={1}
                modelPrefs={modelPrefs}
              />
            </div>

            <div style={{ marginTop: 12, opacity: 0.85, fontSize: 13, lineHeight: 1.35 }}>
              <b>Logic:</b> Trees/water cool nearby cells; buildings/roads add heat. Flood spreads from water/coastline and is blocked by barriers.
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 950 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 12,
        minWidth: 110,
        textAlign: "center",
      }}
    >
      <div style={{ opacity: 0.75 }}>{label}</div>
      <div style={{ fontWeight: 950 }}>{value}</div>
    </div>
  );
}


const card: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
};

const hr: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid rgba(255,255,255,0.10)",
  margin: "14px 0",
};

function blockBtn(active: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: 10,
    borderRadius: 12,
    border: active ? "1px solid rgba(255,255,255,0.24)" : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
    color: "#e8eefc",
  };
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.10)",
  color: "#e8eefc",
  fontWeight: 950,
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.06)",
  color: "#e8eefc",
  fontWeight: 900,
};

const btnDanger: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255, 70, 70, 0.22)",
  color: "#ffd6d6",
  fontWeight: 950,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  opacity: 0.9,
};

const selectBox: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.06)",
  color: "#e8eefc",
  border: "1px solid rgba(255,255,255,0.12)",
  fontWeight: 800,
};