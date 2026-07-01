"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getHotelById } from "@/lib/dataClient";
import type { Hotel } from "@/types/db";
import { ReportForm } from "@/components/ReportForm";

export function ReportPageClient({ hotelId }: { hotelId: string }) {
  const [hotel, setHotel] = useState<Hotel | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getHotelById(hotelId)
      .then((result) => {
        if (active) setHotel(result);
      })
      .catch((error) => {
        if (active) setError(error instanceof Error ? error.message : "Could not load hotel.");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, [hotelId]);

  if (!loaded) return <p className="muted">Loading breakfast target…</p>;

  if (error) {
    return (
      <section className="stack">
        <h1>Could not load breakfast target.</h1>
        <p className="lead">{error}</p>
        <Link className="button" href="/search">Back to search</Link>
      </section>
    );
  }

  if (!hotel) {
    return (
      <section className="stack">
        <h1>Hotel not found.</h1>
        <p className="lead">The bacon map has no record of this place.</p>
        <Link className="button" href="/hotels/add">Add hotel manually</Link>
      </section>
    );
  }

  return (
    <section>
      <div className="back-title">
        <Link className="round-icon" href={`/hotels/${hotel.id}`} aria-label="Back">‹</Link>
        <h1>Report bacon</h1>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <p className="hero-kicker">Breakfast inspection</p>
        <h2>{hotel.name}</h2>
        <p className="hotel-meta">{hotel.city}, {hotel.country} · tap a choice</p>
      </div>
      <ReportForm hotel={hotel} />
    </section>
  );
}
