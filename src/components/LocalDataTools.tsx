"use client";

import { ChangeEvent, useRef, useState } from "react";
import { getClientDataMode, getDataModeLabel } from "@/lib/dataMode";
import {
  clearLocalBaconData,
  exportLocalBaconData,
  importLocalBaconData,
  seedDemoData
} from "@/lib/localStore";

export function LocalDataTools() {
  const mode = getClientDataMode();
  const [message, setMessage] = useState("Local bacon data tools are ready.");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleSeed() {
    const stats = seedDemoData();
    setMessage(`Demo breakfast intel loaded: ${stats.hotels} hotels and ${stats.reports} reports.`);
  }

  function handleExport() {
    const data = exportLocalBaconData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `do-they-have-bacon-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Local bacon data exported as JSON.");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const stats = importLocalBaconData(parsed);
      setMessage(`Imported ${stats.hotels} hotels and ${stats.reports} reports.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import bacon data.");
    } finally {
      event.target.value = "";
    }
  }

  function handleReset() {
    const confirmed = window.confirm("Remove all local bacon data from this browser?");
    if (!confirmed) return;
    clearLocalBaconData();
    setMessage("Local bacon data cleared. The buffet is empty again.");
  }

  return (
    <section className="card form">
      <div className="stack">
        <h2>Local bacon lab</h2>
        <p><strong>Active data mode:</strong> {getDataModeLabel(mode)}</p>
        <p className="muted">
          These tools only affect this browser&apos;s localStorage prototype. They are useful before Supabase is connected.
        </p>
      </div>

      <div className="actions">
        <button className="button" type="button" onClick={handleSeed}>Load demo data</button>
        <button className="button secondary" type="button" onClick={handleExport}>Export JSON</button>
        <button className="button secondary" type="button" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
        <button className="button ghost" type="button" onClick={handleReset}>Reset local data</button>
      </div>

      <input ref={fileInputRef} className="hidden-input" type="file" accept="application/json" onChange={handleImport} />
      <p className="muted">{message}</p>
    </section>
  );
}
