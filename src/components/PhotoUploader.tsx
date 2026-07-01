"use client";

import { ChangeEvent, useRef } from "react";
import { compressImageToDataUrl } from "@/lib/imageCompression";

export function PhotoUploader({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressImageToDataUrl(file);
    onChange(dataUrl);
  }

  return (
    <div className="field">
      <label>Photo evidence <span className="muted">(optional)</span></label>
      <button className="photo-upload-card" type="button" onClick={() => inputRef.current?.click()}>
        <span className="photo-upload-icon">📷</span>
        <span>
          <strong>{value ? "Photo attached" : "Snap the buffet"}</strong>
          <small>{value ? "Tap to replace photo" : "Tap to add a photo"}</small>
        </span>
      </button>
      <input ref={inputRef} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={handleFile} />
      {value && (
        <div className="photo-preview-wrap">
          <img className="report-photo" src={value} alt="Selected bacon evidence" />
          <button className="button ghost" type="button" onClick={() => onChange(undefined)}>Remove photo</button>
        </div>
      )}
    </div>
  );
}
