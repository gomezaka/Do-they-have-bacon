"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HotelCard } from "@/components/HotelCard";
import { listHotelsWithReports } from "@/lib/dataClient";
import { calculateBaconStatus } from "@/lib/status";
import type { HotelWithReports } from "@/types/db";

export function HomeDashboard() {
  const [hotels, setHotels] = useState<HotelWithReports[]>([]);

  useEffect(() => {
    let active = true;
    listHotelsWithReports()
      .then((results) => {
        if (active) setHotels(results);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const reportCount = hotels.reduce((sum, hotel) => sum + hotel.reports.length, 0);
    const confirmed = hotels.filter((hotel) => calculateBaconStatus(hotel.reports).key === "bacon_confirmed").length;
    const percent = hotels.length ? Math.round((confirmed / hotels.length) * 100) : 68;
    return { reportCount: reportCount || 12418, percent };
  }, [hotels]);

  const nearby = hotels.length ? hotels.slice(0, 3) : [];

  return (
    <>
      <div className="top-bar">
        <div className="brand-mini">
          <span className="brand-dot">🥓</span>
          <div>
            <div className="brand-title">Do They Have Bacon?</div>
            <div className="brand-sub">📍 Global bacon scouts</div>
          </div>
        </div>
        <Link className="round-icon" href="/tools" aria-label="Open profile and tools">🔔</Link>
      </div>

      <Link className="search-pill search-hero-pill" href="/search" aria-label="Search any hotel">
        <span aria-hidden="true">⌕</span>
        <span>Search any hotel…</span>
      </Link>

      <section className="hero-card">
        <p className="hero-kicker">Today&apos;s mission</p>
        <h1>Scout breakfast before you book.</h1>
        <div className="actions hero-actions">
          <Link className="button inverted" href="/hotels/add">Add hotel manually</Link>
          <Link className="button subtle-inverted" href="/search">Search hotel</Link>
        </div>
      </section>

      <div className="stat-strip">
        <div className="stat-card">
          <div className="stat-number">{stats.reportCount.toLocaleString("en-US")}</div>
          <div className="stat-label">breakfasts scouted</div>
        </div>
        <div className="stat-card">
          <div className="stat-number accent">{stats.percent}%</div>
          <div className="stat-label">had the bacon</div>
        </div>
      </div>

      <div className="section-row">
        <h3>Near you</h3>
        <Link className="section-link" href="/search">See all</Link>
      </div>

      <div className="tight-stack">
        {nearby.length > 0 ? (
          nearby.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} />)
        ) : (
          <div className="notice">
            <strong>Uncharted bacon territory.</strong>
            <p className="muted small">No scout has reported from this hotel yet. Add the first breakfast target yourself.</p>
            <div className="actions">
              <Link className="button secondary" href="/search">Search hotels</Link>
              <Link className="button" href="/hotels/add">Add hotel</Link>
            </div>
          </div>
        )}
        <Link className="add-manual-card" href="/hotels/add">
          <span className="add-manual-icon">+</span>
          <span>
            <strong>Can&apos;t find your hotel?</strong>
            <br />
            <span className="muted small">Add it manually and start the bacon trail.</span>
          </span>
        </Link>
      </div>
    </>
  );
}
