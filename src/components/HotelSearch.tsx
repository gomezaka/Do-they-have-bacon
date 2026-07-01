"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HotelCard } from "@/components/HotelCard";
import { createHotel, searchHotels } from "@/lib/dataClient";
import { nominatimToHotelDraft, searchOpenMapHotels, type NominatimPlace } from "@/lib/geocoding";
import type { HotelWithReports } from "@/types/db";

export function HotelSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [localResults, setLocalResults] = useState<HotelWithReports[]>([]);
  const [openResults, setOpenResults] = useState<NominatimPlace[]>([]);
  const [message, setMessage] = useState("Search our bacon map first.");
  const [isSearchingOpen, setIsSearchingOpen] = useState(false);

  async function handleLocalSearch(event: FormEvent) {
    event.preventDefault();
    try {
      const results = await searchHotels(query);
      setLocalResults(results);
      setOpenResults([]);
      setMessage(results.length ? `${results.length} hotels found` : "No scout reports found yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bacon database search failed.");
    }
  }

  async function handleOpenSearch() {
    setIsSearchingOpen(true);
    setMessage("Searching open map data. Bacon scouts are patient.");

    try {
      const results = await searchOpenMapHotels(query);
      setOpenResults(results);
      setMessage(results.length ? `${results.length} open map results found` : "No open map results found. Manual hotel creation is standing by.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Open map search failed.");
    } finally {
      setIsSearchingOpen(false);
    }
  }

  async function createFromOpenResult(place: NominatimPlace) {
    try {
      const draft = nominatimToHotelDraft(place);
      const hotel = await createHotel(draft);
      router.push(`/report/${hotel.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create hotel from open map result.");
    }
  }

  return (
    <section className="tight-stack search-card">
      <form className="tight-stack" onSubmit={handleLocalSearch}>
        <label className="search-pill" htmlFor="hotel-search">
          <span aria-hidden="true">⌕</span>
          <input
            id="hotel-search"
            value={query}
            minLength={2}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any hotel…"
          />
        </label>
        <div className="chips">
          <button className="chip active" type="submit">All</button>
          <span className="chip">🥓 Confirmed</span>
          <span className="chip">⚠️ Contested</span>
          <span className="chip">🌵 No bacon</span>
        </div>
        <div className="actions">
          <button className="button secondary wide-mobile" type="button" onClick={handleOpenSearch} disabled={isSearchingOpen || query.trim().length < 3}>
            {isSearchingOpen ? "Searching…" : "Search open map data"}
          </button>
        </div>
      </form>

      <p className="results-label">{message}</p>

      {localResults.length > 0 && (
        <div className="tight-stack">
          {localResults.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} />)}
        </div>
      )}

      {openResults.length > 0 && (
        <div className="tight-stack">
          {openResults.map((place) => (
            <article className="card search-result-card" key={place.place_id}>
              <div>
                <h3 className="hotel-title">{place.display_name.split(",")[0]}</h3>
                <p className="hotel-meta">{place.display_name}</p>
                <span className="status-badge unscouted">🕵️ Unscouted bacon territory</span>
              </div>
              <button className="button secondary" type="button" onClick={() => createFromOpenResult(place)}>
                Use and report bacon
              </button>
            </article>
          ))}
        </div>
      )}

      <Link className="add-manual-card" href="/hotels/add">
        <span className="add-manual-icon">+</span>
        <span><strong>Can&apos;t find it?</strong><br /><span className="muted small">Add the hotel manually</span></span>
      </Link>
    </section>
  );
}
