"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createReport } from "@/lib/dataClient";
import { todayISO, yesterdayISO } from "@/lib/date";
import type { BaconReportStatus, BreakfastContext, Hotel } from "@/types/db";
import { PhotoUploader } from "@/components/PhotoUploader";
import { TurnstileField } from "@/components/TurnstileField";
import { preparePhotoEvidence } from "@/lib/uploadClient";

export function ReportForm({ hotel }: { hotel: Hotel }) {
  const router = useRouter();
  const [status, setStatus] = useState<BaconReportStatus>("yes");
  const [observedDate, setObservedDate] = useState(todayISO());
  const [breakfastContext, setBreakfastContext] = useState<BreakfastContext>("buffet");
  const [note, setNote] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!observedDate) {
      setError("Observation date is required.");
      return;
    }

    setIsSaving(true);
    try {
      const photo = await preparePhotoEvidence(photoDataUrl);
      await createReport({
        hotelId: hotel.id,
        status,
        observedDate,
        breakfastContext,
        note,
        photoDataUrl: photo.photoDataUrl,
        photoUrl: photo.photoUrl,
        turnstileToken
      });

      router.push(`/hotels/${hotel.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save bacon report.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form report-form" onSubmit={handleSubmit}>
      <div className="intro-card report-intro">
        <p className="hero-kicker">Scout report</p>
        <h2>Did they have bacon?</h2>
        <p className="hotel-meta">Reporting for <strong>{hotel.name}</strong>, {hotel.city}. No sign-in needed.</p>
      </div>

      <div className="choice-row" role="group" aria-label="Bacon status">
        <button type="button" className="report-choice" aria-pressed={status === "yes"} onClick={() => setStatus("yes")}>
          <span className="choice-emoji">🥓</span>
          <span className="choice-label"><strong>Yes — bacon spotted</strong><small>The buffet delivered the goods.</small></span>
          {status === "yes" && <span className="choice-check">✓</span>}
        </button>
        <button type="button" className="report-choice" aria-pressed={status === "no"} onClick={() => setStatus("no")}>
          <span className="choice-emoji">🌵</span>
          <span className="choice-label"><strong>No bacon</strong><small>Only sadness and scrambled eggs.</small></span>
          {status === "no" && <span className="choice-check">✓</span>}
        </button>
        <button type="button" className="report-choice" aria-pressed={status === "unsure"} onClick={() => setStatus("unsure")}>
          <span className="choice-emoji">🤔</span>
          <span className="choice-label"><strong>Not sure</strong><small>Couldn&apos;t tell / didn&apos;t check.</small></span>
          {status === "unsure" && <span className="choice-check">✓</span>}
        </button>
      </div>

      <div className="field">
        <label>When did you see this?</label>
        <div className="segmented">
          <button className={observedDate === todayISO() ? "segment active" : "segment"} type="button" onClick={() => setObservedDate(todayISO())}>Today</button>
          <button className={observedDate === yesterdayISO() ? "segment active" : "segment"} type="button" onClick={() => setObservedDate(yesterdayISO())}>Yesterday</button>
        </div>
        <input className="input" type="date" value={observedDate} onChange={(event) => setObservedDate(event.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="breakfast-context">Breakfast setup</label>
        <select id="breakfast-context" className="select" value={breakfastContext} onChange={(event) => setBreakfastContext(event.target.value as BreakfastContext)}>
          <option value="buffet">Breakfast buffet</option>
          <option value="other">Other breakfast setup</option>
        </select>
      </div>

      <PhotoUploader value={photoDataUrl} onChange={setPhotoDataUrl} />

      <TurnstileField value={turnstileToken} onChange={setTurnstileToken} />

      <div className="field">
        <label htmlFor="note">Add a note <span className="muted">(optional)</span></label>
        <textarea
          id="note"
          className="textarea"
          maxLength={280}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Crispy or chewy? Refilled often? Spill the details…"
        />
        <p className="muted small">{note.length}/280</p>
      </div>

      {error && <p className="error">{error}</p>}

      <button className="button submit-wide" type="submit" disabled={isSaving}>{isSaving ? "Submitting…" : "Submit bacon report →"}</button>
    </form>
  );
}
