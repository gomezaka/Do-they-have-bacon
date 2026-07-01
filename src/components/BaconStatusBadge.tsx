import type { BaconStatusSummary } from "@/types/db";

function shortLabel(label: string) {
  if (label === "Bacon confirmed") return "Confirmed";
  if (label === "No bacon reported") return "No bacon";
  if (label === "Bacon status contested") return "Contested";
  if (label === "Unscouted bacon territory") return "Unscouted";
  if (label === "Stale bacon intel") return "Stale intel";
  if (label === "Bacon uncertainty detected") return "Unsure";
  return label;
}

export function BaconStatusBadge({ summary }: { summary: BaconStatusSummary }) {
  return (
    <span className={`status-badge ${summary.key}`} title={summary.description}>
      <span aria-hidden="true">{summary.emoji}</span>
      <span>{shortLabel(summary.label)}</span>
    </span>
  );
}
