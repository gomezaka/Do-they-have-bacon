"use client";

import { FormEvent, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createHotel, findPossibleDuplicate } from "@/lib/dataClient";
import type { Hotel } from "@/types/db";
import { TurnstileField } from "@/components/TurnstileField";

const HotelPinPicker = dynamic(() => import("@/components/HotelPinPicker"), {
  ssr: false,
  loading: () => <div className="notice">Loading map pin picker...</div>
});

export function ManualHotelForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState(59.9139);
  const [longitude, setLongitude] = useState(10.7522);
  const [duplicates, setDuplicates] = useState<Hotel[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && city.trim().length >= 2 && country.trim().length >= 2;
  }, [name, city, country]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(Number(position.coords.latitude.toFixed(6)));
        setLongitude(Number(position.coords.longitude.toFixed(6)));
        setError("");
      },
      () => setError("Could not read your location.")
    );
  }

  async function checkDuplicates() {
    const matches = await findPossibleDuplicate({ name, city, country, latitude, longitude });
    setDuplicates(matches);
    return matches;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Hotel name, city and country are required.");
      return;
    }

    setIsSaving(true);
    try {
      const matches = await checkDuplicates();
      if (matches.length > 0) return;
      await createAndContinue();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create hotel.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createAndContinue() {
    setIsSaving(true);
    try {
      const hotel = await createHotel({ name, city, country, address, latitude, longitude, source: "manual", turnstileToken });
      router.push(`/report/${hotel.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create hotel.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="notice stack">
        <strong>No account needed</strong>
        <p className="muted">Add the hotel, then submit the first bacon report. Your browser gets an anonymous scout ID for basic spam protection.</p>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="hotel-name">Hotel name *</label>
          <input id="hotel-name" className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Grand Hotel" />
        </div>
        <div className="field">
          <label htmlFor="city">City *</label>
          <input id="city" className="input" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Oslo" />
        </div>
        <div className="field">
          <label htmlFor="country">Country *</label>
          <input id="country" className="input" value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Norway" />
        </div>
        <div className="field">
          <label htmlFor="address">Address, if known</label>
          <input id="address" className="input" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, district, anything useful" />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="latitude">Latitude *</label>
          <input id="latitude" className="input" type="number" step="0.000001" value={latitude} onChange={(event) => setLatitude(Number(event.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="longitude">Longitude *</label>
          <input id="longitude" className="input" type="number" step="0.000001" value={longitude} onChange={(event) => setLongitude(Number(event.target.value))} />
        </div>
      </div>

      <div className="notice stack">
        <strong>Place the breakfast target</strong>
        <p className="muted">Drag the bacon pin, click the map, or use your current location.</p>
        <button className="button secondary" type="button" onClick={useMyLocation}>Use my location</button>
      </div>

      <HotelPinPicker
        latitude={latitude}
        longitude={longitude}
        onChange={(coords) => {
          setLatitude(coords.latitude);
          setLongitude(coords.longitude);
        }}
      />

      <TurnstileField value={turnstileToken} onChange={setTurnstileToken} />

      {duplicates.length > 0 && (
        <div className="notice stack">
          <strong>Possible match found</strong>
          <p className="muted">Use an existing hotel if it is the same place. The bacon database dislikes duplicates.</p>
          {duplicates.map((hotel) => (
            <div className="card" key={hotel.id}>
              <h3>{hotel.name}</h3>
              <p className="muted">{hotel.city}, {hotel.country}</p>
              <div className="actions">
                <button className="button secondary" type="button" onClick={() => router.push(`/report/${hotel.id}`)}>Use this hotel</button>
              </div>
            </div>
          ))}
          <button className="button ghost" type="button" onClick={createAndContinue} disabled={isSaving}>Create new anyway</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="button" type="submit" disabled={!canSubmit || isSaving}>{isSaving ? "Saving..." : "Create hotel and report bacon"}</button>
      </div>
    </form>
  );
}
