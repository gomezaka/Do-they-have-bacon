"use client";

import dynamic from "next/dynamic";

const MapClient = dynamic(() => import("@/components/MapClient"), {
  ssr: false,
  loading: () => <div className="notice">Loading bacon map...</div>
});

export function MapShell() {
  return <MapClient />;
}
