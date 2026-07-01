"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateBaconStatus } from "@/lib/status";
import { formatDate } from "@/lib/date";
import { getHotelWithReports } from "@/lib/dataClient";
import type { HotelWithReports } from "@/types/db";

export function HotelDetailsClient({ hotelId }: { hotelId: string }) {
  const [hotel, setHotel] = useState<HotelWithReports | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getHotelWithReports(hotelId)
      .then((result) => { if (active) setHotel(result); })
      .catch((error) => { if (active) setError(error instanceof Error ? error.message : "Could not load hotel."); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [hotelId]);

  if (!loaded) return <p className="muted">Loading bacon intel…</p>;

  if (error) {
    return (
      <section className="stack">
        <h1>Could not load hotel.</h1>
        <p className="lead">{error}</p>
        <Link className="button" href="/search">Back to search</Link>
      </section>
    );
  }

  if (!hotel) {
    return (
      <section className="stack">
        <h1>Hotel not found.</h1>
        <p className="lead">This breakfast target has not been added yet.</p>
        <Link className="button" href="/hotels/add">Add hotel manually</Link>
      </section>
    );
  }

  const summary = calculateBaconStatus(hotel.reports);

  return (
    <section>
      <div className="hotel-photo-hero">
        <Link className="round-icon overlay-left" href="/search" aria-label="Back">‹</Link>
        <Link className="round-icon overlay-right" href="/map" aria-label="View on map">↗</Link>
        <div className="hotel-hero-copy">
          <span>🏨</span>
          <p>Breakfast target</p>
        </div>
      </div>

      <div className="detail-card">
        <h1 style={{ fontSize: 23, margin: 0 }}>{hotel.name}</h1>
        <p className="hotel-meta">📍 {hotel.address ? `${hotel.address}, ` : ""}{hotel.city}</p>

        <div className={`status-hero ${summary.key}`}>
          <span className="status-hero-emoji">{summary.emoji}</span>
          <div>
            <div className="status-hero-title">{summary.label}</div>
            <div className="status-hero-desc">{summary.confidenceLabel} confidence · {summary.description.toLowerCase()}</div>
          </div>
        </div>

        <div className="counts">
          <div className="count-card"><div className="count-number">{summary.yesCount}</div><div className="count-label">🥓 Yes</div></div>
          <div className="count-card"><div className="count-number" style={{ color: "#6b4a33" }}>{summary.noCount}</div><div className="count-label">🌵 No</div></div>
          <div className="count-card"><div className="count-number" style={{ color: "#a9712f" }}>{summary.unsureCount}</div><div className="count-label">🤔 Unsure</div></div>
        </div>
      </div>

      <div className="actions" style={{ margin: "16px 0" }}>
        <Link className="button" href={`/report/${hotel.id}`}>Report bacon here</Link>
        <Link className="button secondary" href="/map">View on map</Link>
      </div>

      <div className="section-row">
        <h3>Recent reports</h3>
        <span className="section-link">Last seen {formatDate(summary.lastReportedAt)}</span>
      </div>

      <section className="card stack">
        {hotel.reports.length === 0 ? (
          <div className="notice">
            <strong>No reports yet.</strong>
            <p className="muted small">Uncharted breakfast territory. Be the first bacon scout.</p>
          </div>
        ) : (
          hotel.reports.map((report) => (
            <article className="report-item" key={report.id}>
              <h3 className="hotel-title">{report.status === "yes" ? "🥓 Yes" : report.status === "no" ? "🌵 No" : "🤔 Not sure"} — {formatDate(report.observedDate)}</h3>
              <p className="hotel-meta">{report.breakfastContext === "buffet" ? "Breakfast buffet" : "Other breakfast setup"}</p>
              {report.note && <p style={{ margin: 0 }}>“{report.note}”</p>}
              {(report.photoDataUrl || report.photoUrl) && <img className="report-photo" src={report.photoDataUrl || report.photoUrl} alt="Bacon report photo evidence" />}
            </article>
          ))
        )}
      </section>
    </section>
  );
}
