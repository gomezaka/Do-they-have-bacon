import type { BaconReport, BaconStatusSummary } from "@/types/db";
import { daysSince } from "@/lib/date";

const STALE_DAYS = 90;

export function calculateBaconStatus(reports: BaconReport[]): BaconStatusSummary {
  const visibleReports = reports.filter((report) => report.flaggedCount < 3);

  const yesCount = visibleReports.filter((report) => report.status === "yes").length;
  const noCount = visibleReports.filter((report) => report.status === "no").length;
  const unsureCount = visibleReports.filter((report) => report.status === "unsure").length;

  const latestReport = [...visibleReports].sort((a, b) => {
    return new Date(b.observedDate).getTime() - new Date(a.observedDate).getTime();
  })[0];

  if (!latestReport) {
    return {
      key: "unscouted",
      label: "Unscouted bacon territory",
      emoji: "🕵️",
      description: "No bacon scout has reported from this breakfast yet.",
      confidenceLabel: "Unknown",
      yesCount,
      noCount,
      unsureCount
    };
  }

  const lastReportedAt = latestReport.observedDate;
  const isStale = daysSince(lastReportedAt) > STALE_DAYS;

  if (isStale) {
    return {
      key: "stale",
      label: "Stale bacon intel",
      emoji: "⏳",
      description: "The latest bacon report is old. Breakfast may have changed alliances.",
      confidenceLabel: "Low",
      yesCount,
      noCount,
      unsureCount,
      lastReportedAt
    };
  }

  if (yesCount >= 2 && noCount >= 2 && Math.abs(yesCount - noCount) <= 1) {
    return {
      key: "contested",
      label: "Bacon status contested",
      emoji: "⚠️",
      description: "Scouts disagree. The buffet may be unstable.",
      confidenceLabel: "Medium",
      yesCount,
      noCount,
      unsureCount,
      lastReportedAt
    };
  }

  if (yesCount > noCount && yesCount >= unsureCount) {
    return {
      key: "bacon_confirmed",
      label: "Bacon confirmed",
      emoji: "🥓",
      description: "A brave scout has reported bacon.",
      confidenceLabel: yesCount >= 3 ? "High" : "Medium",
      yesCount,
      noCount,
      unsureCount,
      lastReportedAt
    };
  }

  if (noCount > yesCount && noCount >= unsureCount) {
    return {
      key: "no_bacon_reported",
      label: "No bacon reported",
      emoji: "🌵",
      description: "No bacon sightings. Stay strong.",
      confidenceLabel: noCount >= 3 ? "High" : "Medium",
      yesCount,
      noCount,
      unsureCount,
      lastReportedAt
    };
  }

  return {
    key: "uncertain",
    label: "Bacon uncertainty detected",
    emoji: "🤔",
    description: "The evidence is unclear. Further breakfast inspection required.",
    confidenceLabel: "Low",
    yesCount,
    noCount,
    unsureCount,
    lastReportedAt
  };
}
