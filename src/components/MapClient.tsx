"use client";

import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { calculateBaconStatus } from "@/lib/status";
import { listHotelsWithReports } from "@/lib/dataClient";
import type { HotelWithReports } from "@/types/db";

function makeIcon(emoji: string, key: string) {
  return L.divIcon({
    html: `<span class="map-pin ${key}"><span>${emoji}</span></span>`,
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -36]
  });
}

export default function MapClient() {
  const [hotels, setHotels] = useState<HotelWithReports[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listHotelsWithReports()
      .then((results) => { if (active) setHotels(results.filter((hotel) => hotel.reports.length > 0)); })
      .catch((error) => { if (active) setError(error instanceof Error ? error.message : "Could not load bacon map."); });
    return () => { active = false; };
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (hotels[0]) return [hotels[0].latitude, hotels[0].longitude];
    return [59.9139, 10.7522];
  }, [hotels]);

  if (error) {
    return (
      <div className="notice stack" style={{ marginTop: 56 }}>
        <strong>Could not load bacon map.</strong>
        <p className="muted small">{error}</p>
        <Link className="button secondary" href="/search">Search hotels</Link>
      </div>
    );
  }

  if (hotels.length === 0) {
    return (
      <div className="notice stack" style={{ marginTop: 56 }}>
        <strong>No bacon reports on the map yet.</strong>
        <p className="muted small">Add a hotel, report breakfast, and the first pin will appear.</p>
        <Link className="button secondary" href="/hotels/add">Add hotel manually</Link>
      </div>
    );
  }

  const firstHotel = hotels[0];
  const firstSummary = calculateBaconStatus(firstHotel.reports);

  return (
    <div className="map-screen">
      <div className="map-frame">
        <MapContainer center={center} zoom={hotelZoom(hotels.length)} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hotels.map((hotel) => {
            const summary = calculateBaconStatus(hotel.reports);
            return (
              <Marker key={hotel.id} position={[hotel.latitude, hotel.longitude]} icon={makeIcon(summary.emoji, summary.key)}>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>{hotel.name}</strong>
                    <p>{hotel.city}, {hotel.country}</p>
                    <p>{summary.label}</p>
                    <Link href={`/hotels/${hotel.id}`}>Open hotel</Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="map-overlay-top">
        <Link className="map-search-pill" href="/search">
          <span aria-hidden="true">⌕</span>
          <span>Bacon map · reported hotels</span>
        </Link>
        <div className="chips">
          <span className="map-chip active">🥓 Confirmed</span>
          <span className="map-chip">⚠️ Contested</span>
          <span className="map-chip">🌵 No bacon</span>
        </div>
      </div>

      <Link className="map-bottom-sheet" href={`/hotels/${firstHotel.id}`}>
        <div className="hotel-thumb">🏨</div>
        <div className="hotel-main">
          <h3 className="hotel-title">{firstHotel.name}</h3>
          <span className={`status-badge ${firstSummary.key}`}>{firstSummary.emoji} {firstSummary.label}</span>
        </div>
        <span className="sheet-arrow">›</span>
      </Link>
    </div>
  );
}

function hotelZoom(count: number) {
  return count === 1 ? 13 : 3;
}
