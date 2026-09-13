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
import { blankDesign, distanceLabel, walls } from "./domain/model";
import type { Anchor, Room, RoomObject, Wall } from "./domain/model";
import { computePaths, resolveListener, speakerRayColor } from "./domain/acoustics";
import type { RaySettings } from "./domain/acoustics";
import LibraryPanel from "./components/LibraryPanel";
import HistoryPanel from "./components/HistoryPanel";
import FilesPanel from "./components/FilesPanel";
import "./App.css";
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
  { id: "Measure", label: "Measure", icon: "↔" },
  { id: "Saves", label: "Saves", icon: "◷" },
  { id: "Files", label: "Files", icon: "⇧" },
] as const;
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
function HistoryIcon({ redo = false }: { redo?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={redo ? "M15 6h5V1" : "M9 6H4V1"} />
      <path d={redo ? "M20 6a8 8 0 1 0 0 10" : "M4 6a8 8 0 1 1 0 10"} />
    </svg>
  );
}
function App() {
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
    [unit, setUnit] = useState<"ft" | "cm">("ft");
  const [panelWidth, setPanelWidth] = useState(440),
    [resizing, setResizing] = useState(false);
  const [display, setDisplay] = useState<Display>(defaultDisplay),
    [view, setView] = useState("Perspective"),
    [cameraRevision, setCameraRevision] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [mode, setMode] = useState<"translate" | "rotate">("translate"),
    [snapEnabled, setSnapEnabled] = useState(true);
  const snap = 0.1524;
  const [rays, setRays] = useState<RaySettings>({
    enabled: true,
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
  const paths = rays.enabled ? [...incidentPaths, ...reflectedPaths] : [];
  const object = d.objects.find((o) => o.id === selected),
    ray = paths.find((p) => p.id === selectedRay);
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
          <span className="brand-mark">▥</span>
          <p className="eyebrow">ACOUSTIC ROOM VISUALIZER</p>
          <h1>Build a perfect sounding room.</h1>
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
          <span className="brand-mark">▥</span>
          <div>
            Acoustic Room<span>VISUALIZER</span>
          </div>
        </div>
        <div className="header-actions" role="toolbar" aria-label="Project actions">
          <button className="primary save-button" title="Save a new milestone" onClick={saveProgress}>
            <span aria-hidden="true">▣</span> Save / Update
          </button>
          <button
            className="danger reset-button"
            onClick={() => setResetConfirm("open")}
          >
            <span aria-hidden="true">↺</span> Reset project
          </button>
          <button
            className="close-button"
            title="Close project and return to home"
            onClick={() => setCloseConfirm("open")}
          >
            <span aria-hidden="true">×</span> Close project
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
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
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
            ?
          </button>
        </div>
      </header>
      <aside className="tool-panel">
        <div className="panel-top">
          <span>YOUR ROOM, REFINED.</span>
          <button
            aria-label="Collapse editing panel"
            title="Collapse editing panel"
            onClick={() => setCollapsed(true)}
          >
            ‹
          </button>
        </div>
        <div className="panel-tabs">
          {tabItems.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              <span className="tab-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="tab-label">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="panel-scroll">
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
                <div className="object-list">
                  {d.objects.length === 0 && (
                    <p className="hint">
                      Your room is empty. Open the Library to place your first
                      object.
                    </p>
                  )}
                  {d.objects.map((o) => (
                    <div
                      className={`object-row ${selected === o.id ? "selected" : ""}`}
                      key={o.id}
                    >
                      <button
                        onClick={() => {
                          select(o.id);
                          setSelectedRay(null);
                        }}
                      >
                        <span
                          className={`object-symbol ${o.kind}`}
                          style={{ color: o.color }}
                        >
                          {o.kind === "speaker"
                            ? "◉"
                            : o.kind === "listener"
                              ? "◎"
                              : o.kind === "sofa"
                                ? "▰"
                                : o.kind === "bass"
                                  ? "◒"
                                  : "▥"}
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
                      <input
                        type="checkbox"
                        aria-label={`Show ${o.name}`}
                        title={`Show ${o.name}`}
                        checked={o.visible}
                        onChange={(e) =>
                          patch(o.id, { visible: e.target.checked })
                        }
                      />
                    </div>
                  ))}
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
                  <button aria-pressed={rays.first} onClick={()=>setRays(r=>({...r,first:!r.first}))}>First order <span>━</span></button>
                  <button aria-pressed={rays.second} onClick={()=>setRays(r=>({...r,second:!r.second}))}>Second order <span>┄</span></button>
                  <button aria-label="Explain second order reflections" title="How second order works" onClick={()=>setRayHelp(true)}>ⓘ</button>
                </div>
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
              <Section title="Sources & reflecting surfaces">
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
                {d.objects.some(
                  (o) => o.kind === "panel" || o.kind === "bass",
                ) && (
                  <>
                    <h3 className="ray-subheading">Treatment surfaces</h3>
                    {d.objects
                      .filter((o) => o.kind === "panel" || o.kind === "bass")
                      .map((o) => (
                        <Toggle
                          key={o.id}
                          label={`Reflect from ${o.name}`}
                          checked={o.reflect}
                          onChange={(reflect) => patch(o.id, { reflect })}
                        />
                      ))}
                  </>
                )}
              </Section>
              <button className="wide-button" onClick={resetRayControls}>
                Reset ray controls
              </button>
              <Section
                key={`ray-inspector-${paths.map((p) => p.id).join("|")}`}
                title="Ray inspector"
              >
                <label className="text-field">
                  Select a path
                  <select
                    aria-label="Select ray"
                    value={ray?.id || ""}
                    onChange={(e) => setSelectedRay(e.target.value)}
                  >
                    <option value="">Select in viewport or choose here</option>
                    {paths.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.source} → {p.surfaces.join(" → ")}
                      </option>
                    ))}
                  </select>
                </label>
                {ray ? (
                  <div className="ray-inspector">
                    <p>
                      <span>Source</span>
                      <b>{ray.source}</b>
                    </p>
                    <p>
                      <span>Destination</span>
                      <b>{ray.listener}</b>
                    </p>
                    <p>
                      <span>Order</span>
                      <b>{ray.order}</b>
                    </p>
                    <p>
                      <span>Surfaces</span>
                      <b>{ray.surfaces.join(" → ")}</b>
                    </p>
                    <p>
                      <span>Path length</span>
                      <b>{distanceLabel(ray.length, unit)}</b>
                    </p>
                    <p>
                      <span>Energy retained</span>
                      <b>{(ray.energy * 100).toFixed(1)}%</b>
                    </p>
                    <p>
                      <span>Visual loss</span>
                      <b>
                        {ray.energy > 0
                          ? (-10 * Math.log10(ray.energy)).toFixed(1)
                          : "∞"}{" "}
                        dB
                      </b>
                    </p>
                    <p className="hint">
                      Coefficient-only energy loss; excludes distance spreading
                      and is not a calibrated sound level.
                    </p>
                  </div>
                ) : (
                  <p className="hint">
                    Click a ray to inspect its surfaces, length and attenuation.
                  </p>
                )}
              </Section>
            </div>
          )}
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
              unit={unit}
              onUnit={setUnit}
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
      <main className="viewport-area">
        <div className="viewport-toolbar">
          <div className="camera-tools">
            {collapsed && (
              <button
                className="panel-expand"
                aria-label="Expand editing panel"
                title="Expand editing panel"
                onClick={() => setCollapsed(false)}
              >
                ☰
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
              <HistoryIcon />
            </button>
            <button
              className="history-button"
              title="Redo (⌘/Ctrl Shift Z)"
              aria-label="Redo"
              disabled={!future.length}
              onClick={redo}
            >
              <HistoryIcon redo />
            </button>
            <button title="Toggle fullscreen" aria-label="Toggle fullscreen" aria-pressed={fullScreen} onClick={toggleFullscreen}>
              ⛶
            </button>
            <button
              title="Reset camera view"
              aria-label="Reset camera view"
              onClick={() => {
                setView("Perspective");
                setCameraRevision((n) => n + 1);
              }}
            >
              ↺
            </button>
          </div>
          <div className="display-tools">
            {(
              [
                ["axes", "⌁", "Axes"],
                ["labels", "Aa", "Labels"],
                ["measurements", "↔", "Dimensions"],
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
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
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
            theme={theme}
            onObjectSelected={() => setTab("Design")}
            display={display}
            view={view}
            cameraRevision={cameraRevision}
            mode={mode}
            snap={snapEnabled ? snap : 0}
            paths={paths}
            selectedRay={selectedRay}
            onRay={(id) => {
              setSelectedRay(id);
              setTab("Rays");
            }}
            measuring={measuring}
            onPoint={point}
            unit={unit}
          />
          <div className="scene-heading">
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
          </div>
          {d.objects.length === 0 && (
            <div className="empty-room">
              <h2>A blank room. Your next idea.</h2>
              <p>Start with a sofa and speakers from your library.</p>
              <button className="primary" onClick={() => setTab("Library")}>
                Explore library →
              </button>
            </div>
          )}
          <div className="viewport-guidance"><div className="viewport-legend">
            <span>
              <i className="left-ray" />
              Left speaker
            </span>
            <span>
              <i className="right-ray" />
              Right speaker
            </span>
            <span>━ First · ┄ Second</span><small data-testid="ray-count">
              {paths.length} valid paths · {Math.round(rays.frequency || 1000)}{" "}
              Hz
            </small>
          </div>
          <div className="orbit-hint">
            Drag to orbit <b>·</b> Right-drag to pan <b>·</b> Scroll to zoom
          </div></div>
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
              <span aria-hidden="true">×</span> Close project
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
