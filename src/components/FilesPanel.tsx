import { useRef } from "react";
import type { ChangeEvent } from "react";
import { blankDesign, validateDesign } from "../domain/model";
import { validateLibrary, validateWorkspace } from "../domain/workspace";
import { useStudio, workspaceData } from "../domain/store";
import { Section } from "./Controls";

function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(data: unknown, label: string) {
  const version =
    typeof data === "object" && data !== null && "version" in data
      ? (data as { version?: unknown }).version
      : undefined;
  const parsed = version === 2 ? validateWorkspace(data) : validateDesign(data);
  const library =
    version === 1 &&
    typeof data === "object" &&
    data !== null &&
    "library" in data
      ? validateLibrary((data as { library: unknown }).library)
      : null;
  const studio = useStudio.getState();
  if (!studio.saveMilestone(`Before ${label}`)) {
    throw new Error(
      "Unable to checkpoint current progress. Export a backup before importing.",
    );
  }
  if (parsed.version === 2) {
    studio.importWorkspace(parsed);
  } else if (library) {
    studio.importWorkspace({
      version: 2,
      design: parsed,
      library,
      milestones: [],
      activeMilestoneId: null,
    });
  } else {
    studio.commit(parsed);
  }
  studio.select(null);
}

export default function FilesPanel({
  unit,
  onUnit,
  onMessage,
  onHistory,
}: {
  unit: "ft" | "cm";
  onUnit: (u: "ft" | "cm") => void;
  onMessage: (m: string) => void;
  onHistory: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const loadDemo = async () => {
    try {
      const response = await fetch("/demo-room.json");
      if (!response.ok) throw new Error("Demo room file is unavailable.");
      importData(await response.json(), "demo load");
      onMessage(
        "Demo room loaded. Your previous progress remains in save history.",
      );
    } catch (error) {
      onMessage(
        error instanceof Error
          ? error.message
          : "Demo room could not be loaded.",
      );
    }
  };
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 20_000_000)
        throw new Error("File is too large. Maximum size is 20 MB.");
      importData(JSON.parse(await file.text()), "import");
      onMessage(
        "Import complete. Previous progress and saves remain in your history.",
      );
    } catch (error) {
      onMessage(
        error instanceof SyntaxError
          ? "This file is not valid JSON. Your design is unchanged."
          : error instanceof Error
            ? error.message
            : "Import failed. Your design is unchanged.",
      );
    }
    event.target.value = "";
  };
  return (
    <>
      <Section title="Design & backups">
        <label className="text-field">
          Display units
          <select
            aria-label="Display units"
            value={unit}
            onChange={(event) => onUnit(event.target.value as "ft" | "cm")}
          >
            <option value="ft">Feet</option>
            <option value="cm">Centimeters</option>
          </select>
        </label>
        <div className="demo-card">
          <div>
            <strong>Demo room</strong>
            <p>16 × 20 × 9 ft · two speakers · sofa with two listeners</p>
          </div>
          <button className="primary" onClick={loadDemo}>
            Open demo room
          </button>
          <a
            className="demo-download"
            href="/demo-room.json"
            download="acoustic-room-demo.json"
          >
            Download JSON
          </a>
        </div>
        <div className="file-actions">
          <button
            onClick={() => {
              const studio = useStudio.getState();
              if (!studio.saveMilestone("Before new room")) {
                onMessage(
                  "Unable to save your current progress. Export a backup before starting a new room.",
                );
                return;
              }
              studio.commit(blankDesign());
              studio.select(null);
              onMessage(
                "Blank room created. Your previous room is in Save history.",
              );
            }}
          >
            ＋ New blank room
          </button>
          <button onClick={onHistory}>View save history</button>
          <button
            onClick={() => {
              const studio = useStudio.getState();
              downloadJson(
                { ...studio.design, library: studio.library },
                "acoustic-room-design.json",
              );
              onMessage("Design and reusable library exported.");
            }}
          >
            Export design JSON
          </button>
          <button
            onClick={() => {
              downloadJson(
                workspaceData(useStudio.getState()),
                "acoustic-room-history.json",
              );
              onMessage(
                "Full workspace exported, including every milestone and branch.",
              );
            }}
          >
            Export workspace history
          </button>
          <button onClick={() => input.current?.click()}>Import JSON</button>
        </div>
        <input
          ref={input}
          type="file"
          className="hidden-input"
          aria-label="Import design file"
          accept=".json,application/json"
          onChange={handleFile}
        />
        <p className="hint">
          Your working design autosaves locally. Save / Update creates a
          permanent milestone. A full workspace export includes all saves; a
          design export includes the current room and library.
        </p>
      </Section>
      <Section title="About reflection output">
        <p className="hint">
          Approximate specular geometric visualization, not an acoustical
          measurement or prediction. Absorption values reduce visual energy.
          Room modes, wave interference, scattering, diffraction and calibrated
          SPL are not modeled.
        </p>
      </Section>
    </>
  );
}
