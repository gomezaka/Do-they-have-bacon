"use client";

import { getClientDataMode, getDataModeLabel } from "@/lib/dataMode";

export function DataModeBanner() {
  const mode = getClientDataMode();
  return (
    <div className={`data-mode-banner ${mode}`}>
      Data mode: <strong>{getDataModeLabel(mode)}</strong>
      {mode === "local" ? " · survives refresh, but only in this browser" : " · shared database, anonymous reports allowed"}
    </div>
  );
}
