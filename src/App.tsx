import type { LengthUnit } from './domain/model';
import ModePanel from "./components/ModePanel";
import { defaultModeSettings } from "./components/modeSettings";
import ModeChart from "./components/ModeChart";
import { calculateRoomModes } from "./domain/acoustics";
import Icon from './components/Icon';
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Scene from "./components/Scene";
import type { Display } from "./components/Scene";
import {
  Keyboard,
  ObjectEditor,
  RoomEditor,
  Section,
  Toggle,
} from "./components/Controls";
import { useStudio } from "./domain/store";
import { blankDesign, ft, distanceLabel, makeObject, mountTreatmentAtPoint, walls } from "./domain/model";
import type { Anchor, Room, RoomObject, Wall } from "./domain/model";
import { matchesRayCoverage, computePaths, resolveListener, speakerRayColor } from "./domain/acoustics";
import type { RayCoverageFilter, RaySettings } from "./domain/acoustics";
import { optimizeReflectionPanels } from "./domain/placement";
import type { PanelOrientation, ReflectionTarget } from "./domain/placement";
import type { LibraryItem } from "./domain/workspace";
import LibraryPanel from "./components/LibraryPanel";
import HistoryPanel from "./components/HistoryPanel";
import FilesPanel from "./components/FilesPanel";
import "./App.css";
import "./studio-v12.css";
import "./modes.css";
const defaultDisplay: Display = {
  transparent: true,
  grid: true,
  axes: false,
  dimensions: false,
  wallMeasures: false,
  custom: true,
  measurements: false,
  labels: false,
  panel: true,
  bass: true,
};
const tabItems = [
  { id: "Design", label: "Design", icon: "⌂" },
  { id: "Library", label: "Library", icon: "▦" },
  { id: "Rays", label: "Rays", icon: "⌁" },
  { id: "Mode", label: "Mode", icon: "∿" },
  { id: "Measure", label: "Measure", icon: "↔" },
  { id: "Saves", label: "Saves", icon: "◷" },
  { id: "Files", label: "Files", icon: "⇧" },
] as const;
const rayTravelTime = (distanceMetres: number) => {
  const milliseconds = Math.round((distanceMetres / 343) * 1000);
  return `${Math.floor(milliseconds / 1000)}:${String(milliseconds % 1000).padStart(3, "0")}`;
};
const surfaceMeta: Record<Wall, { label: string; icon: string }> = {
  front: { label: "Front wall", icon: "↑" },
  rear: { label: "Rear wall", icon: "↓" },
  left: { label: "Left wall", icon: "←" },
  right: { label: "Right wall", icon: "→" },
  floor: { label: "Floor", icon: "⌄" },
  ceiling: { label: "Ceiling", icon: "⌃" },
};
function SpeakerRayButton({
  object,
  room,
  onChange,
}: {
  object: RoomObject;
  room: Room;
  onChange: (value: boolean) => void;
}) {
  const side = speakerRayColor(object, room) === "#b498f1" ? "right" : "left";
  const label = object.name || `${side[0].toUpperCase()}${side.slice(1)} speaker`;
  return (
    <button
      type="button"
      className={`ray-source-button ${object.reflect ? "active" : ""}`}
      style={{"--source-color": speakerRayColor(object, room)} as CSSProperties}
      title={`Toggle ${label} rays`}
      aria-label={label}
      aria-pressed={object.reflect}
      onClick={() => onChange(!object.reflect)}
    >
      <span className={`ray-source-icon ${side}`} aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="6" y="2" width="12" height="16" rx="2"/><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="3"/><path d="M12 18v4M7 22h10"/></svg></span>
      <span>{label}</span>
      <small>{object.reflect ? "ON" : "OFF"}</small>
    </button>
  );
}
function SurfaceToggleGrid({
  values,
  onChange,
}: {
  values: Record<Wall, boolean>;
  onChange: (wall: Wall, value: boolean) => void;
}) {
  return (
    <div className="surface-toggle-grid">
      {walls.map((wall) => (
        <button
          type="button"
          key={wall}
          aria-label={surfaceMeta[wall].label}
          className={values[wall] ? "active" : ""}
          aria-pressed={values[wall]}
          onClick={() => onChange(wall, !values[wall])}
        >
          <span>{surfaceMeta[wall].icon}</span>
          <b>{surfaceMeta[wall].label}</b>
        </button>
      ))}
    </div>
  );
}
function App() {
  const [modeSettings, setModeSettings] = useState(defaultModeSettings);
  const [selectedModeId, setSelectedModeId] = useState("");
  const [objectQuery, setObjectQuery] = useState("");
  const {
    design: d,
    selected,
    select,
    commit,
    patch,
    place,
    remove,
    duplicate,
    resetObject,
    undo,
    redo,
    past,
    future,
    saveMilestone,
    persist,
  } = useStudio();
  const roomModes = useMemo(() => calculateRoomModes(d.room, modeSettings.maximum).filter(m => m.frequency >= modeSettings.minimum && modeSettings.kinds[m.kind]), [d.room, modeSettings.maximum, modeSettings.minimum, modeSettings.kinds]);
  const selectedMode = roomModes.find(m => m.id === selectedModeId) ?? roomModes[0];
  const [intro, setIntro] = useState(() => {
      try {
        return sessionStorage.getItem("acoustic-intro-seen") !== "1";
      } catch {
        return false;
      }
    }),
    [resetConfirm, setResetConfirm] = useState(""),
    [closeConfirm, setCloseConfirm] = useState(""),
    [tab, setTab] = useState("Design"),
    [collapsed, setCollapsed] = useState(false),
    [unit, setUnit] = useState<LengthUnit>("ft");
  const [panelWidth, setPanelWidth] = useState(440),
    [resizing, setResizing] = useState(false);
  const [display, setDisplay] = useState<Display>(defaultDisplay),
    [view, setView] = useState("Perspective"),
    [cameraRevision, setCameraRevision] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [mode, setMode] = useState<"translate" | "rotate">("translate"),
    [snapEnabled, setSnapEnabled] = useState(true);
  const library = useStudio((state) => state.library);
  const [surfaceAbsorberIds, setSurfaceAbsorberIds] = useState<Partial<Record<Wall, string>>>({});
  const [panelOptimizationWalls, setPanelOptimizationWalls] = useState<
    Record<Wall, PanelOrientation | null>
  >({ front: "vertical", rear: "vertical", left: "vertical", right: "vertical", floor: "vertical", ceiling: "vertical" });
  const snap = ft(0.5);
  const [rays, setRays] = useState<RaySettings>({
    enabled: true,
    direct: true,
    first: true,
    second: true,
    listener: "",
    band: "1000",
    frequency: 1000,
    listeners: { a: true, b: true },
    surfaces: {
      floor: true,
      ceiling: true,
      front: true,
      rear: true,
      left: true,
      right: true,
    },
    maxSecond: 24,
    quality: "high",
  });
  const [selectedRay, setSelectedRay] = useState<string | null>(null),
    [measuring, setMeasuring] = useState(false),
    [anchor, setAnchor] = useState<Anchor | null>(null),
    [message, setMessage] = useState(""),
    [help, setHelp] = useState(false),
    [rayHelp, setRayHelp] = useState(false);
  const [coverageFilter, setCoverageFilter] = useState<RayCoverageFilter>("all");
  const [rayFilters, setRayFilters] = useState({ source: "", listener: "", order: "", surface: "" });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem("acoustic-room-theme") === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("acoustic-room-theme", theme);
    } catch {
      /* Theme works without storage. */
    }
  }, [theme]);
  useEffect(() => {
    persist();
  }, [persist]);
  useEffect(() => {
    if (!resizing) return;
    const move = (event: PointerEvent) =>
      setPanelWidth(Math.min(620, Math.max(320, event.clientX)));
    const stop = () => setResizing(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, [resizing]);
  useEffect(() => {
    const syncFullscreen = () => setFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  const effectiveRays = useMemo(
    () => ({ ...rays, listener: resolveListener(d, rays.listener)?.id || "" }),
    [d, rays],
  );
  // Incident rays are source-to-listener geometry and remain visible for every
  // listener. Listener A/B filters apply to reflected destinations only.
  const incidentPaths = useMemo(
    () =>
      computePaths(
        d,
        {
          ...effectiveRays,
          enabled: true,
          first: false,
          second: false,
          allListeners: true,
        },
        display,
      ),
    [d, effectiveRays, display],
  );
  const reflectedPaths = useMemo(
    () =>
      computePaths(d, effectiveRays, display).filter(
        (path) => path.surfaces[0] !== "Direct / incident",
      ),
    [d, effectiveRays, display],
  );
  const paths = useMemo(
    () => (rays.enabled ? [...incidentPaths, ...reflectedPaths] : []),
    [incidentPaths, rays.enabled, reflectedPaths],
  );
  const coveragePaths = useMemo(() => paths.filter(path => matchesRayCoverage(path, coverageFilter)), [paths, coverageFilter]);
  const visiblePaths = useMemo(() => {
    return coveragePaths.filter(path =>
      (!rayFilters.source || path.source === rayFilters.source) &&
      (!rayFilters.listener || path.listener === rayFilters.listener) &&
      (!rayFilters.order || String(path.order) === rayFilters.order) &&
      (!rayFilters.surface || path.surfaces.includes(rayFilters.surface)),
    );
  }, [coveragePaths, rayFilters]);
  const object = d.objects.find((o) => o.id === selected);
  const absorberLibrary = useMemo(
    () => library.filter((item) => item.kind === "panel"),
    [library],
  );
  const absorberForWall = (wall: Wall) =>
    absorberLibrary.find((item) => item.id === surfaceAbsorberIds[wall]) ?? absorberLibrary[0];
  const selectSurfaceAbsorber = (wall: Wall, id: string) =>
    setSurfaceAbsorberIds(current => ({ ...current, [wall]: id }));
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  const toggleDisplay = (key: keyof Display, value: boolean) =>
    setDisplay((v) => ({ ...v, [key]: value }));
  const setFrequencyFromSlider = (raw: string) =>
    setRays((r) => ({
      ...r,
      frequency: 20 * Math.pow(1000, Math.min(1, Math.max(0, Number(raw)))),
    }));
  const resetRayControls = () => {
    setRays(r => ({...r, first:false, second:false, listeners:{a:false,b:false}, surfaces:{floor:false,ceiling:false,front:false,rear:false,left:false,right:false}}));
    commit({...d,objects:d.objects.map(o=>({...o,reflect:false}))});
    setSelectedRay(null);
  };
  const placeReflectionAbsorbers = () => {
    const wallNames = new Set(["Front wall", "Rear wall", "Left wall", "Right wall", "Floor", "Ceiling"]);
    const seen = new Set<string>();
    const additions: RoomObject[] = [];
    for (const path of reflectedPaths) {
      path.points.slice(1, -1).forEach((point, index) => {
        const surface = path.surfaces[index];
        if (!wallNames.has(surface)) return;
        const key = `${surface}:${point.map(n => n.toFixed(3)).join(",")}`;
        if (seen.has(key)) return;
        seen.add(key);
        const panel = makeObject("panel");
        const mount = ({"Front wall":"front","Rear wall":"rear","Left wall":"left","Right wall":"right","Floor":"floor","Ceiling":"ceiling"} as Record<string, Wall>)[surface];
        const positioned = mountTreatmentAtPoint({ ...panel, name: `Reflection absorber ${additions.length + 1}`, reflect: true }, mount, point, d.room);
        additions.push(positioned);
      });
    }
    if (!additions.length) { setMessage("No valid wall reflection points are available with the current ray settings."); return; }
    commit({ ...d, objects: [...d.objects, ...additions] });
    setMessage(`Placed ${additions.length} absorbers at first- and second-order reflection points for the active speakers.`);
  };
  const optimizePanels = () => {
    if (!absorberLibrary.length) {
      setMessage("Add an absorption panel to the Library before optimizing.");
      return;
    }
    const wallNames = new Set([
      "Front wall",
      "Rear wall",
      "Left wall",
      "Right wall",
      "Floor",
      "Ceiling",
    ]);
    const wallByName: Record<string, Wall> = {
      "Front wall": "front",
      "Rear wall": "rear",
      "Left wall": "left",
      "Right wall": "right",
      Floor: "floor",
      Ceiling: "ceiling",
    };
    // Existing panels can hide the wall points that the optimizer needs to
    // consolidate, so trace the active rays once with absorption panels removed.
    const cleanDesign = {
      ...d,
      objects: d.objects.filter((o) => o.kind !== "panel"),
    };
    const cleanPaths = computePaths(
      cleanDesign,
      effectiveRays,
      { ...display, panel: true },
    ).filter((path) => matchesRayCoverage(path, "untreated"));
    const targets: ReflectionTarget[] = [];
    for (const path of cleanPaths) {
      path.points.slice(1, -1).forEach((point, index) => {
        const surface = path.surfaces[index];
        if (wallNames.has(surface))
          targets.push({ wall: wallByName[surface], point, weight: path.order === 1 ? 2 : 0.5 });
      });
    }
    const optimizations = walls.flatMap(wall => {
      const orientation = panelOptimizationWalls[wall];
      const absorber = absorberForWall(wall);
      if (!rays.surfaces[wall] || !orientation || !absorber) return [];
      return [{ orientation, absorber, result: optimizeReflectionPanels(
        targets.filter(target => target.wall === wall), d.room, orientation,
        [absorber.size[0], absorber.size[1]],
      ) }];
    });
    const targetCount = optimizations.reduce((sum, optimization) => sum + optimization.result.targetCount, 0);
    const allPlacements = optimizations.flatMap(({ orientation, absorber, result }) =>
      result.placements.map((placement) => ({ ...placement, orientation, absorber })),
    );
    const existingPanels = d.objects.filter((o) => o.kind === "panel");
    const roomObjects = d.objects.filter((o) => o.kind !== "panel");
    const objectCapacity = Math.max(0, 150 - roomObjects.length);
    const placements = allPlacements.slice(0, objectCapacity);
    if (!targetCount) {
      setMessage(
        "No selected-surface reflection points are available. Turn on a speaker and at least one reflection order, then choose at least one surface.",
      );
      return;
    }
    if (!placements.length) {
      setMessage(
        "No panel fits the selected surfaces within the panel dimensions and 150-object room limit.",
      );
      return;
    }
    const additions = placements.map(({ wall, center, orientation, absorber: selectedAbsorber }, index) =>
      mountTreatmentAtPoint(
        {
          ...structuredClone(selectedAbsorber) as LibraryItem,
          id: crypto.randomUUID(),
          templateId: selectedAbsorber.id,
          size: orientation === "horizontal"
            ? [selectedAbsorber.size[1], selectedAbsorber.size[0], selectedAbsorber.size[2]]
            : [...selectedAbsorber.size],
          name: `Optimized ${orientation} ${selectedAbsorber.name} ${index + 1}`,
          reflect: true,
        },
        wall,
        center,
        d.room,
      ),
    );
    const removedPanelIds = new Set(existingPanels.map((panel) => panel.id));
    const measurements = d.measurements.filter(
      (measurement) =>
        ![measurement.a.objectId, measurement.b.objectId].some((id) =>
          id ? removedPanelIds.has(id) : false,
        ),
    );
    const optimizedDesign = { ...d, objects: [...roomObjects, ...additions], measurements };
    const optimizedPaths = computePaths(optimizedDesign, effectiveRays, display);
    const treatedRays = optimizedPaths.filter(path => matchesRayCoverage(path, "treated")).length;
    const untreatedRays = optimizedPaths.filter(path => matchesRayCoverage(path, "untreated")).length;
    commit(optimizedDesign);
    if (selected && removedPanelIds.has(selected)) select(null);
    setSelectedRay(null);
    const uncovered = Math.max(
      0,
      targetCount - placements.reduce((sum, placement) => sum + placement.covered, 0),
    );
    const capacityNote =
      placements.length < allPlacements.length
        ? ` Room capacity limited the result to ${placements.length} panels.`
        : "";
    const coverageNote = uncovered
      ? ` ${uncovered} point${uncovered === 1 ? "" : "s"} could not be covered without overlap.`
      : " All nearby points are covered without overlap.";
    setMessage(
      `Replaced ${existingPanels.length} panel${existingPanels.length === 1 ? "" : "s"} with ${additions.length} non-overlapping library panel${additions.length === 1 ? "" : "s"}.${coverageNote} ${treatedRays} treated rays; ${untreatedRays} untreated rays.${capacityNote}`,
    );
  };
  const toggleFullscreen = async () => {
    if (fullScreen || document.fullscreenElement) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      setFullScreen(false);
      return;
    }
    const studio = document.querySelector<HTMLElement>(".studio");
    if (!studio?.requestFullscreen) {
      setFullScreen(true);
      return;
    }
    try {
      await studio.requestFullscreen();
    } catch {
      // A few embedded browsers reject the native API; the CSS fallback still
      // provides a full-viewport presentation with the controls intact.
      setFullScreen(true);
    }
  };
  const escape = useCallback(() => {
    setMeasuring(false);
    setAnchor(null);
    setHelp(false);
    setRayHelp(false);
  }, []);
  const point = (a: Anchor) => {
    if (!anchor) {
      setAnchor(a);
      setMessage("First point selected. Click the second point or object.");
    } else {
      commit({
        ...d,
        measurements: [
          ...d.measurements,
          { id: crypto.randomUUID(), a: anchor, b: a },
        ],
      });
      setAnchor(null);
      setMeasuring(false);
      setMessage("Measurement added. Object anchors follow their positions.");
      setTab("Measure");
    }
  };
  const placeItem = (id: string) => {
    if (!place(id)) {
      setMessage(
        "Unable to place this item. The room supports up to 150 objects, including listeners.",
      );
      return;
    }
    setTab("Design");
    setMessage("Placed using library defaults. Select it to adjust placement.");
  };
  const saveProgress = () =>
    setMessage(
      saveMilestone()
        ? "Milestone saved. Open Saves to jump back to any earlier version."
        : "Storage is full or unavailable. Export workspace history to keep a backup.",
    );
  const enterStudio = () => {
    setIntro(false);
    try {
      sessionStorage.setItem("acoustic-intro-seen", "1");
    } catch {
      /* private browsing */
    }
  };
  const createNewRoom = () => {
    const s = useStudio.getState();
    if (s.design.objects.length || s.milestones.length)
      s.saveMilestone("Before new room");
    s.commit(blankDesign());
    s.select(null);
    setCollapsed(false);
    enterStudio();
  };
  const closeProject = () => {
    setIntro(true);
    setTab("Design");
    setCollapsed(false);
    try {
      sessionStorage.removeItem("acoustic-intro-seen");
    } catch {
      /* private browsing */
    }
  };
  const openImportDialog = () => {
    enterStudio();
    setTab("Files");
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>(
            'input[aria-label="Import design file"]',
          )
          ?.click(),
      60,
    );
  };
  if (intro)
    return (
      <div className="hero-screen">
        <div className="hero-card">
          <span className="brand-mark"><Icon name="Rays" /></span>
          <p className="eyebrow">ACOUSTIC ROOM VISUALIZER</p>
          <h1>A better space.
            A clearer sound.</h1>
          <p>
            Plan speaker placement, treatment surfaces and geometric reflections
            in a calm, visual workspace.
          </p>
          <div>
            <button className="primary" onClick={createNewRoom}>
              Create a new room
            </button>
            <button onClick={openImportDialog}>Import existing room</button>
          </div>
        </div>
      </div>
    );
  return (
    <div
      className={`studio ${collapsed ? "is-collapsed" : ""} ${resizing ? "is-resizing" : ""} ${fullScreen ? "is-fullscreen" : ""}`}
      style={{ "--panel-width": `${panelWidth}px` } as CSSProperties}
    >
      <Keyboard onEscape={escape} />
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark"><Icon name="Rays" /></span>
          <div>
            Acoustic Room<span>VISUALIZER</span>
          </div>
        </div>
        <div className="header-actions" role="toolbar" aria-label="Project actions">
          <button className="primary save-button" title="Save a new milestone" onClick={saveProgress}>
            <Icon name="save" /> Save / Update
          </button>
          <button
            className="danger reset-button"
            onClick={() => setResetConfirm("open")}
          >
            <Icon name="reset" /> Reset project
          </button>
          <button
            className="close-button"
            title="Close project and return to home"
            onClick={() => setCloseConfirm("open")}
          >
            <Icon name="close" /> Close project
          </button>
          <button
            className="theme-button"
            aria-label="Toggle light and dark mode"
            aria-pressed={theme === "light"}
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
            <span className="theme-label">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>
          <button
            title="Open user guide"
            aria-label="Open user guide"
            className="guide-button"
            onClick={() => setHelp(true)}
          >
            <Icon name="help" />
          </button>
        </div>
      </header>
      <aside className="tool-panel">
        <div className="panel-top">
          <div className="panel-identity"><span>WORKSPACE</span><strong>{tab === "Saves" ? "History" : tab}</strong></div>
          <button
            aria-label="Collapse editing panel"
            title="Collapse editing panel"
            onClick={() => setCollapsed(true)}
          >
            <Icon name="collapse" />
          </button>
        </div>
        <div className="panel-tabs">
          {tabItems.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              aria-pressed={tab === item.id}
              title={{Design:"Room geometry and object placement",Library:"Reusable objects and acoustic treatments",Rays:"Sources, reflection paths and frequency",Mode:"Room mode frequencies and 3D pressure patterns",Measure:"Distances and dimensions",Saves:"Saved milestones and restore",Files:"Import, export and demo room"}[item.id]}
              className={`tab-${item.id.toLowerCase()} ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span className="tab-icon" aria-hidden="true">
                <Icon name={item.id} />
              </span>
              <span className="tab-label">{item.label}</span>
            </button>
          ))}
        </div>
        <div className={`panel-scroll panel-content-${tab.toLowerCase()}`} key={tab}>
          <div className="panel-introduction"><p>{{Design:"Shape your room. Position every detail.",Library:"Reusable objects, tuned to your space.",Rays:"Explore the path from source to listener.",Mode:"Find resonances. Explore their pressure zones.",Measure:"Precision for every placement.",Saves:"Every milestone. Always within reach.",Files:"Your work, ready to travel."}[tab]}</p>{tab === "Design" && <button className="quick-add" onClick={()=>setTab("Library")}><Icon name="Library" /> Add objects</button>}</div>
          {tab === "Design" && (
            <>
              <RoomEditor unit={unit} />
              <Section
                title="Objects & layers"
                extra={<span className="badge">{d.objects.length}</span>}
              >
                <div className="layer-toggles">
                  <Toggle
                    label="All absorption panels"
                    checked={display.panel}
                    onChange={(v) => toggleDisplay("panel", v)}
                  />
                  <Toggle
                    label="All bass traps"
                    checked={display.bass}
                    onChange={(v) => toggleDisplay("bass", v)}
                  />
                </div>
                <input className="object-search" aria-label="Find placed objects" placeholder="Find an object…" value={objectQuery} onChange={e=>setObjectQuery(e.target.value)} />
                <div className="object-list object-grid">
                  {d.objects.length === 0 && (
                    <p className="hint">
                      Your room is empty. Open the Library to place your first
                      object.
                    </p>
                  )}
                  {d.objects.filter(o => o.name.toLowerCase().includes(objectQuery.toLowerCase())).map((o) => (
                    <div
                      className={`object-row ${selected === o.id ? "selected" : ""}`}
                      key={o.id}
                    >
                      <button
                        aria-label={`Select ${o.name}`}
                        aria-pressed={selected === o.id}
                        title={`Edit ${o.name}`}
                        onClick={() => {
                          select(o.id);
                          setSelectedRay(null);
                        }}
                      >
                        <span
                          className={`object-symbol ${o.kind}`}
                          style={{ color: o.color }}
                        >
                          <Icon name={o.kind} />
                        </span>
                        <span>
                          {o.name}
                          <small>
                            {o.kind === "panel" || o.kind === "bass"
                              ? o.mount
                              : o.kind}
                          </small>
                        </span>
                      </button>
                      <button className="object-visibility" aria-label={`Show ${o.name}`} title={o.visible ? `Hide ${o.name}` : `Show ${o.name}`} aria-pressed={o.visible} onClick={()=>patch(o.id,{visible:!o.visible})}><span aria-hidden="true">{o.visible ? "✓" : "−"}</span><span>{o.visible ? "Visible" : "Hidden"}</span></button>
                    </div>
                  ))}
                  {d.objects.length > 0 && !d.objects.some(o=>o.name.toLowerCase().includes(objectQuery.toLowerCase())) && <p className="hint">No matching objects.</p>}
                </div>
              </Section>
              {object && (
                <>
                  {!object.parentSofaId && (
                    <Section title="Selected object actions">
                      <div className="button-pair">
                        <button onClick={duplicate}>Duplicate</button>
                        <button onClick={resetObject}>Reset</button>
                        <button className="danger" onClick={remove}>
                          Delete
                        </button>
                      </div>
                    </Section>
                  )}
                  <ObjectEditor key={object.id} o={object} unit={unit} />
                </>
              )}
              <Section title="Direct manipulation">
                <div className="button-pair">
                  <button
                    className={mode === "translate" ? "active" : ""}
                    onClick={() => setMode("translate")}
                  >
                    ↔ Move
                  </button>
                  <button
                    className={mode === "rotate" ? "active" : ""}
                    onClick={() => setMode("rotate")}
                  >
                    ↻ Rotate
                  </button>
                </div>
                <Toggle
                  label="15° angle snapping"
                  checked={snapEnabled}
                  onChange={setSnapEnabled}
                />
              </Section>
            </>
          )}
          {tab === "Library" && (
            <LibraryPanel
              unit={unit}
              onPlace={placeItem}
              onMessage={setMessage}
            />
          )}
          {tab === "Saves" && <HistoryPanel onMessage={setMessage} />}
          {tab === "Rays" && (
            <div className="ray-controls">
              <Section title="Ray layers">
                <div className="segmented order-buttons" role="group" aria-label="Reflection orders">
                  <button aria-pressed={rays.direct !== false} onClick={()=>setRays(r=>({...r,direct:r.direct === false}))}>Direct <span>━</span></button>
                  <button aria-pressed={rays.first} onClick={()=>setRays(r=>({...r,first:!r.first}))}>First order <span>━</span></button>
                  <button aria-pressed={rays.second} onClick={()=>setRays(r=>({...r,second:!r.second}))}>Second order <span>┄</span></button>
                  <button aria-label="Explain second order reflections" title="How second order works" onClick={()=>setRayHelp(true)}>ⓘ</button>
                </div>
                <div className="segmented" role="group" aria-label="Ray coverage filter">
                  {([['all', 'All rays'], ['treated', 'Treated rays'], ['untreated', 'Untreated rays']] as const).map(([value, label]) => <button key={value} aria-pressed={coverageFilter === value} onClick={() => setCoverageFilter(value)}>{label}</button>)}
                </div>
                <p className="hint">Treated: at least one reflection point is covered by enabled treatment. Untreated: all reflection points are uncovered. Direct rays appear under All rays.</p>
                <h3 className="ray-subheading">Destination listeners</h3>
                <div className="segmented listener-buttons" role="group" aria-label="Listeners">
                <button aria-pressed={rays.listeners?.a ?? true} onClick={()=>setRays(r=>({...r,listeners:{a:!r.listeners?.a,b:r.listeners?.b??true}}))}><span className="listener-avatar">A</span>Listener A</button>
                <button aria-pressed={rays.listeners?.b ?? true} onClick={()=>setRays(r=>({...r,listeners:{a:r.listeners?.a??true,b:!r.listeners?.b}}))}><span className="listener-avatar listener-avatar-b">B</span>Listener B</button>
                </div>
                <label className="text-field frequency-field">
                  Frequency{" "}
                  <output className="frequency-output">
                    {Math.round(rays.frequency || 1000)} Hz
                  </output>
                  <input
                    aria-label="Frequency slider"
                    aria-valuetext={`${Math.round(rays.frequency || 1000)} Hz`}
                    type="range"
                    min="0"
                    max="1"
                    step="0.001"
                    value={
                      Math.log10((rays.frequency || 1000) / 20) /
                      Math.log10(1000)
                    }
                    onChange={(e) => setFrequencyFromSlider(e.target.value)}
                    onInput={(e) =>
                      setFrequencyFromSlider(e.currentTarget.value)
                    }
                  />
                </label>
              </Section>
              <Section title="Sources & room boundaries">
                <h3 className="ray-subheading">Speakers</h3>
                <div className="ray-source-grid">
                  {d.objects
                    .filter((o) => o.kind === "speaker")
                    .map((o) => (
                      <SpeakerRayButton
                        key={o.id}
                        object={o}
                        room={d.room}
                        onChange={(reflect) => patch(o.id, { reflect })}
                      />
                    ))}
                </div>
                {d.objects.filter((o) => o.kind === "speaker").length === 0 && (
                  <p className="hint">
                    Place a speaker from Library to trace its incident and
                    reflected paths.
                  </p>
                )}

                <h3 className="ray-subheading">Room surfaces</h3>
                <SurfaceToggleGrid
                  values={rays.surfaces}
                  onChange={(wall, value) =>
                    setRays((r) => ({
                      ...r,
                      surfaces: { ...r.surfaces, [wall]: value },
                    }))
                  }
                />
              </Section>
              <Section title="Treatment surfaces" extra={<span className="badge">{d.objects.filter(o => (o.kind === "panel" || o.kind === "bass") && o.reflect).length} enabled</span>}>
                <div className="absorber-placement-actions" role="group" aria-label="Automatic absorber placement">
                <button title="Place absorbers at all reflection points" onClick={placeReflectionAbsorbers}>＋ Add absorbers</button>
                <button className="remove-absorbers" onClick={() => { commit({...d, objects:d.objects.filter(o => o.kind !== "panel" && o.kind !== "bass")}); setMessage("Removed all absorbers."); }}>－ Remove absorbers</button>
                </div>
                <div className="optimization-controls">
                  <span>Choose panel dimensions for each selected surface</span>
                  {!absorberLibrary.length && <p className="hint">No absorption panels are in the Library yet. Add a panel type in Library to enable selection.</p>}
                  <div className="optimization-wall-grid" aria-label="Panel selection by surface">
                    {walls.filter(wall => rays.surfaces[wall]).map((wall) => {
                      const absorber = absorberForWall(wall);
                      const label = surfaceMeta[wall].label;
                      return <div key={wall} className="optimization-wall-row">
                      <h3 className="optimization-wall-title">{label}</h3>
                      <div className="surface-panel-dimensions">
                        {([ ["Length", 1], ["Width", 0], ["Thickness", 2] ] as const).map(([dimension, axis]) => <label className="text-field" key={dimension}>{dimension}
                          <select aria-label={`${label} panel ${dimension.toLowerCase()}`} value={absorber?.size[axis] ?? ""} disabled={!absorber} onChange={e => {
                            const candidates = absorberLibrary.filter(item => item.size[axis] === Number(e.target.value));
                            candidates.sort((a, b) => b.size.filter((n, i) => i !== axis && n === absorber?.size[i]).length - a.size.filter((n, i) => i !== axis && n === absorber?.size[i]).length);
                            if (candidates[0]) selectSurfaceAbsorber(wall, candidates[0].id);
                          }}>
                            {!absorber && <option value="">—</option>}
                            {[...new Set(absorberLibrary.map(item => item.size[axis]))].sort((a, b) => a - b).map(value => <option key={value} value={value}>{distanceLabel(value, unit)}</option>)}
                          </select>
                        </label>)}
                      </div>
                      <div className="surface-panel-orientation" role="group" aria-label={`${surfaceMeta[wall].label} panel orientation`}>
                        {(["vertical", "horizontal"] as PanelOrientation[]).map((orientation) => <button
                          type="button"
                          key={orientation}
                          aria-pressed={panelOptimizationWalls[wall] === orientation}
                          onClick={() => setPanelOptimizationWalls((current) => ({ ...current, [wall]: current[wall] === orientation ? null : orientation }))}
                        >{orientation[0].toUpperCase() + orientation.slice(1)}</button>)}
                      </div>
                    </div>})}
                  </div>
                  {!walls.some(wall => rays.surfaces[wall]) && <p className="hint">Select a surface in Room surfaces above to configure optimization.</p>}
                  <p className="hint">Dimension dropdowns list saved library sizes. When a compatible panel type exists, changing one dimension keeps the other selected dimensions unchanged. Add more sizes in Library. Choose either orientation per surface; click the active option again to exclude that surface. Each surface uses its selected library panel’s width, length, thickness and absorption data.</p>
                </div>
                <button className="wide-button primary optimize-button" onClick={optimizePanels} disabled={!absorberLibrary.length}>✦ Optimize panels</button>
                <div className="treatment-bulk-actions" role="group" aria-label="Treatment reflection selection">
                  <span>Include in reflections</span>
                  <button onClick={()=>commit({...d,objects:d.objects.map(o=>o.kind === "panel" || o.kind === "bass" ? {...o,reflect:true} : o)})}>All on</button>
                  <button onClick={()=>commit({...d,objects:d.objects.map(o=>o.kind === "panel" || o.kind === "bass" ? {...o,reflect:false} : o)})}>All off</button>
                </div>
                <div className="treatment-ray-grid">
                  {d.objects.filter(o=>o.kind === "panel" || o.kind === "bass").map(o=><button key={o.id} className="treatment-ray-card" aria-label={`Reflect from ${o.name}`} aria-pressed={o.reflect} title={`${o.name}: reflections ${o.reflect ? "on" : "off"}`} onClick={()=>patch(o.id,{reflect:!o.reflect})}>
                    <span className="treatment-ray-icon"><Icon name={o.kind}/></span>
                    <span className="treatment-ray-copy"><strong>{o.name}</strong><small>{o.mount === "free" ? "Free-standing" : o.mount === "floor" || o.mount === "ceiling" ? o.mount : `${o.mount} wall`}</small></span>
                    <span className="treatment-ray-state">{o.reflect ? "On" : "Off"}</span>
                  </button>)}
                </div>
                {!d.objects.some(o=>o.kind === "panel" || o.kind === "bass") && <p className="hint">Add absorption panels or bass traps from Library to select treatment reflections.</p>}
              </Section>
              <button className="wide-button" onClick={resetRayControls}>
                Reset ray controls
              </button>
              <Section title="Ray inspector">
                {paths.length ? (
                  <>
                    <div className="ray-filter-row" role="group" aria-label="Ray inspector filters">
                      {([['source', 'Source'], ['listener', 'Destination'], ['order', 'Order'], ['surface', 'Surface']] as const).map(([key, label]) => {
                        const choices = key === 'source' ? [...new Set(paths.map(path => path.source))] : key === 'listener' ? [...new Set(paths.map(path => path.listener))] : key === 'order' ? [...new Set(paths.map(path => String(path.order)))] : [...new Set(paths.flatMap(path => path.surfaces))];
                        return <select key={key} aria-label={`Filter by ${label.toLowerCase()}`} value={rayFilters[key]} onChange={e => setRayFilters(current => ({ ...current, [key]: e.target.value }))}><option value="">All {label}s</option>{choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}</select>;
                      })}
                      <button type="button" onClick={() => setRayFilters({ source: "", listener: "", order: "", surface: "" })} disabled={!Object.values(rayFilters).some(Boolean)}>Remove all filters</button>
                    </div>
                    <div className="ray-table-scroll" role="region" aria-label="Ray inspector table" tabIndex={0}>
                      <table className="ray-table" aria-label="Ray paths">
                        <thead><tr>
                          <th scope="col">Source</th>
                          <th scope="col">Destination</th>
                          <th scope="col">Order</th>
                          <th scope="col">Surfaces</th>
                          <th scope="col">Path length</th>
                          <th scope="col">Travel time</th>
                          <th scope="col">Energy retained</th>
                          <th scope="col">Visual loss</th>
                        </tr></thead>
                        <tbody>{visiblePaths.map((path) => (
                          <tr key={path.id} data-ray-id={path.id} data-selected={selectedRay === path.id} onClick={() => setSelectedRay(current => current === path.id ? null : path.id)}>
                            <td><button className="ray-select" aria-pressed={selectedRay === path.id} aria-label={`Highlight ${path.source} to ${path.listener} via ${path.surfaces.join(" → ")}`} onClick={e => { e.stopPropagation(); setSelectedRay(current => current === path.id ? null : path.id); }}>{path.source}</button></td>
                            <td>{path.listener}</td>
                            <td className="ray-number">{path.order}</td>
                            <td>{path.surfaces.join(" → ")}</td>
                            <td className="ray-number">{distanceLabel(path.length, unit)}</td>
                            <td className="ray-number">{rayTravelTime(path.length)}</td>
                            <td className="ray-number">{(path.energy * 100).toFixed(1)}%</td>
                            <td className="ray-number">{path.energy > 0 ? (-10 * Math.log10(path.energy)).toFixed(1) : "∞"} dB</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <p className="hint">{visiblePaths.length} of {paths.length} paths · Travel time is seconds:milliseconds at 343 m/s. Select a row to highlight its ray; select it again to clear. Energy loss excludes distance spreading.</p>
                  </>
                ) : (
                  <p className="hint">No paths to inspect. Enable rays and add a speaker and sofa to see paths.</p>
                )}
              </Section>
            </div>
          )}
          {tab === "Mode" && <ModePanel room={d.room} unit={unit} settings={modeSettings} onSettings={setModeSettings} modes={roomModes} selected={selectedMode} onSelect={setSelectedModeId} />}
          {tab === "Measure" && (
            <>
              <Section title="Measurements">
                <Toggle
                  label="Show all measurements"
                  checked={display.measurements}
                  onChange={(v) => toggleDisplay("measurements", v)}
                />
                <Toggle
                  label="Room dimensions"
                  checked={display.dimensions}
                  onChange={(v) => toggleDisplay("dimensions", v)}
                />
                <Toggle
                  label="Object-to-wall distances"
                  checked={display.wallMeasures}
                  onChange={(v) => toggleDisplay("wallMeasures", v)}
                />
                <Toggle
                  label="Custom measurements"
                  checked={display.custom}
                  onChange={(v) => toggleDisplay("custom", v)}
                />
                <button
                  className="wide-button"
                  onClick={() => {
                    setMeasuring(!measuring);
                    setAnchor(null);
                    toggleDisplay("measurements", true);
                    toggleDisplay("custom", true);
                  }}
                >
                  {measuring ? "Cancel measurement" : "＋ Measure two points"}
                </button>
                <p className="hint">
                  Click two surface points or objects. Object anchors follow the
                  object origin; surface points remain fixed. Wall distances
                  measure from the selected origin to the specified wall plane.
                </p>
                {measuring && (
                  <p className="model-notice">
                    {anchor
                      ? "Click the second point."
                      : "Click the first point."}{" "}
                    Press Escape to cancel.
                  </p>
                )}
              </Section>
              <Section title="Saved measurements">
                {d.measurements.length === 0 && (
                  <p className="hint">
                    No measurements yet. Pick any two points in the viewport.
                  </p>
                )}
                {d.measurements.map((m, i) => (
                  <div key={m.id} className="measurement-row">
                    <span>Measurement {i + 1}</span>
                    <button
                      aria-label={`Delete measurement ${i + 1}`}
                      onClick={() =>
                        commit({
                          ...d,
                          measurements: d.measurements.filter(
                            (q) => q.id !== m.id,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </Section>
            </>
          )}
          {tab === "Files" && (
            <FilesPanel
              onMessage={setMessage}
              onHistory={() => setTab("Saves")}
            />
          )}
        </div>
      </aside>
      <div
        className="panel-resizer"
        role="separator"
        tabIndex={0}
        aria-label="Resize control panel"
        aria-orientation="vertical"
        aria-valuemin={320}
        aria-valuemax={620}
        aria-valuenow={panelWidth}
        onPointerDown={(event) => {
          event.preventDefault();
          setResizing(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft")
            setPanelWidth((width) => Math.max(320, width - 20));
          if (event.key === "ArrowRight")
            setPanelWidth((width) => Math.min(620, width + 20));
        }}
      />
      <main className={`viewport-area ${tab === "Mode" ? "mode-viewport" : ""}`}>
        <div className="viewport-toolbar">
          <div className="camera-tools">
            {collapsed && (
              <button
                className="panel-expand"
                aria-label="Expand editing panel"
                title="Expand editing panel"
                onClick={() => setCollapsed(false)}
              >
                <Icon name="expand" />
              </button>
            )}
            <select
              aria-label="Camera view"
              value={view}
              onChange={(e) => setView(e.target.value)}
            >
              {[
                "Perspective",
                "Front",
                "Rear",
                "Left",
                "Right",
                "Top",
                "Side",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <button
              className="history-button"
              title="Undo (⌘/Ctrl Z)"
              aria-label="Undo"
              disabled={!past.length}
              onClick={undo}
            >
              <Icon name="undo" />
            </button>
            <button
              className="history-button"
              title="Redo (⌘/Ctrl Shift Z)"
              aria-label="Redo"
              disabled={!future.length}
              onClick={redo}
            >
              <Icon name="redo" />
            </button>
            <button title="Toggle fullscreen" aria-label="Toggle fullscreen" aria-pressed={fullScreen} onClick={toggleFullscreen}>
              <Icon name={fullScreen ? "minimize" : "fullscreen"} />
            </button>
            <button
              title="Reset camera view"
              aria-label="Reset camera view"
              onClick={() => {
                setView("Perspective");
                setCameraRevision((n) => n + 1);
              }}
            >
              <Icon name="reset" />
            </button>
          </div>
          <div className="display-tools"><div className="unit-switch" role="group" aria-label="Display units">{(["ft","cm","in"] as const).map(u=><button key={u} aria-pressed={unit===u} onClick={()=>setUnit(u)}>{u}</button>)}</div>
            {(
              [
                ["axes", "axes", "Axes"],
                ["labels", "labels", "Labels"],
                ["measurements", "Measure", "Dimensions"],
              ] as const
            ).map(([key, icon, label]) => (
              <button
                title={label}
                aria-label={label}
                aria-pressed={display[key]}
                key={key}
                className={display[key] ? "active" : ""}
                onClick={() => {
                  if (key === "measurements")
                    setDisplay((v) => ({
                      ...v,
                      measurements: !v.measurements,
                      dimensions: !v.measurements,
                    }));
                  else toggleDisplay(key, !display[key]);
                }}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        {tab === "Mode" && <ModeChart room={d.room} settings={modeSettings} modes={roomModes} selected={selectedMode} onSelect={setSelectedModeId} />}
        <div
          className={`scene-container ${measuring ? "measuring" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("application/acoustic-template");
            if (id) placeItem(id);
          }}
        >
          <Scene
            roomModeView={tab === "Mode" ? { selected: selectedMode, animate: modeSettings.animate, nodes: modeSettings.nodes } : undefined}
            theme={theme}
            onObjectSelected={() => setTab("Design")}
            display={display}
            view={view}
            cameraRevision={cameraRevision}
            mode={mode}
            snap={snapEnabled ? snap : 0}
            paths={tab === "Mode" ? [] : coveragePaths}
            selectedRay={selectedRay}
            onRay={(id) => {
              setSelectedRay(id);
              setTab("Rays");
            }}
            measuring={tab === "Mode" ? false : measuring}
            onPoint={point}
            unit={unit}
          />
          {tab === "Mode" ? <div className="mode-room-heading"><h2>Room3D</h2><span>{selectedMode ? `${selectedMode.frequency.toFixed(2)} Hz · ${selectedMode.kind} (${selectedMode.orders.join(', ')})` : 'No mode selected'}</span></div> : <div className="scene-heading">
            <input
              className="scene-title-input"
              aria-label="Design name"
              maxLength={100}
              value={d.name}
              placeholder="Untitled design"
              onChange={(e) => commit({ ...d, name: e.target.value })}
            />
            <p>
              {distanceLabel(d.room.width, unit)} ×{" "}
              {distanceLabel(d.room.length, unit)} ×{" "}
              {distanceLabel(d.room.height, unit)}
            </p>
          </div>}
          {tab !== "Mode" && d.objects.length === 0 && (
            <div className="empty-room">
              <h2>A blank room. Your next idea.</h2>
              <p>Start with a sofa and speakers from your library.</p>
              <button className="primary" onClick={() => setTab("Library")}>
                Explore library →
              </button>
            </div>
          )}
          {tab === "Mode" && <div className="mode-room-legend"><span className="mode-pressure-scale" /><span>− / + pressure · gray = zero</span><small>Drag to orbit · scroll to zoom</small></div>}
        </div>
      </main>
      {closeConfirm && (
        <div className="modal-backdrop">
          <div
            className="guide-modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Close project confirmation"
          >
            <h2>Close project?</h2>
            <p>
              Your current work is already autosaved locally. Type <b>close</b>{" "}
              to return to the home screen.
            </p>
            <input
              autoFocus
              aria-label="Close confirmation"
              placeholder="Type close"
              value={closeConfirm === "open" ? "" : closeConfirm}
              onChange={(e) => setCloseConfirm(e.target.value)}
            />
            <button
              className="danger"
              disabled={closeConfirm !== "close"}
              onClick={() => {
                closeProject();
                setCloseConfirm("");
              }}
            >
              <Icon name="close" /> Close project
            </button>
            <button onClick={() => setCloseConfirm("")}>Cancel</button>
          </div>
        </div>
      )}
      {resetConfirm && (
        <div className="modal-backdrop">
          <div
            className="guide-modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Reset project confirmation"
          >
            <h2>Reset project?</h2>
            <p>
              This removes all room objects, measurements, and milestones. Type{" "}
              <b>reset</b> to confirm.
            </p>
            <input
              autoFocus
              aria-label="Reset confirmation"
              placeholder="Type reset"
              value={resetConfirm === "open" ? "" : resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
            />
            <button
              className="danger"
              disabled={resetConfirm !== "reset"}
              onClick={() => {
                useStudio
                  .getState()
                  .commit({
                    ...useStudio.getState().design,
                    objects: [],
                    measurements: [],
                  });
                useStudio.setState({ milestones: [], activeMilestoneId: null });
                useStudio.getState().persist();
                setResetConfirm("");
                setMessage("Project reset to an empty room.");
              }}
            >
              Reset permanently
            </button>
            <button onClick={() => setResetConfirm("")}>Cancel</button>
          </div>
        </div>
      )}
      {message && (
        <div className="notification" role="status">
          <span>{message}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}
      {rayHelp && (
        <div className="modal-backdrop" onClick={() => setRayHelp(false)}>
          <div
            className="guide-modal ray-explainer-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Second order reflection explanation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ray-explainer-heading">
              <span className="eyebrow">RAY PATH EXPLAINER</span>
              <button
                type="button"
                aria-label="Close ray explanation"
                onClick={() => setRayHelp(false)}
              >
                ×
              </button>
            </div>
            <h2>Two surface contacts, one continuous path.</h2>
            <p>
              The source ray reaches the first surface, reflects to a second
              distinct surface, then continues to the listener. Each contact
              multiplies the retained energy by <b>1 − NRC</b> for the selected
              frequency.
            </p>
            <svg
              className="ray-explainer-graphic"
              viewBox="0 0 560 190"
              role="img"
              aria-label="Speaker ray reflects from two surfaces before reaching the listener"
            >
              <defs>
                <marker
                  id="ray-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L7,3 z" />
                </marker>
              </defs>
              <rect x="34" y="18" width="492" height="144" rx="12" />
              <line x1="90" y1="130" x2="230" y2="54" className="ray-explainer-line incident" markerEnd="url(#ray-arrow)" />
              <line x1="230" y1="54" x2="350" y2="54" className="ray-explainer-line reflected" markerEnd="url(#ray-arrow)" />
              <line x1="350" y1="54" x2="470" y2="130" className="ray-explainer-line reflected" markerEnd="url(#ray-arrow)" />
              <circle cx="90" cy="130" r="10" className="ray-explainer-node speaker" />
              <circle cx="230" cy="54" r="8" className="ray-explainer-node surface" />
              <circle cx="350" cy="54" r="8" className="ray-explainer-node surface second" />
              <circle cx="470" cy="130" r="10" className="ray-explainer-node listener" />
              <text x="72" y="153">Speaker</text>
              <text x="196" y="35">Surface 1</text>
              <text x="316" y="35">Surface 2</text>
              <text x="446" y="153">Listener</text>
            </svg>
            <button className="export-button" onClick={() => setRayHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <div
            className="guide-modal"
            role="dialog"
            aria-modal="true"
            aria-label="User guide"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="eyebrow">A SPACE FOR BETTER LISTENING</span>
            <h2>Your studio, from every angle.</h2>
            <p>
              Start with a blank room and choose reusable objects in Library.
              Set each type’s dimensions once; absorption starts at NRC 1.00. A
              sofa includes two fixed listeners that follow it. Select an object
              in the viewport or list to edit it. Move and rotate using the
              colored gizmo; mounting controls snap panels to surfaces and
              corners.
            </p>
            <p>
              In Rays, toggle Listener A and Listener B independently, adjust
              the logarithmic frequency slider, enable first or second order,
              then click a ray to inspect its geometry.
            </p>
            <p>
              Measure two points from the Measure tab. Object anchors update
              when objects move. Standard views help inspect placement.
            </p>
            <p>
              <b>Shortcuts:</b> Delete to remove · ⌘/Ctrl D to duplicate ·
              ⌘/Ctrl Z to undo · ⌘/Ctrl Shift Z to redo · Escape to cancel.
            </p>
            <p>
              Everything stays in your browser. Save / Update creates a
              permanent milestone. Open Saves to jump back in time. Files
              exports the full history or imports a design. This tool models
              finite specular planes, not wave acoustics.
            </p>
            <button
              autoFocus
              className="export-button"
              onClick={() => setHelp(false)}
            >
              Start designing →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
