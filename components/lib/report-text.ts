import { formatDate } from "./format";
import { COMPLETED_TASKS, UPCOMING_TASKS } from "./report-presets";

import type { BookingWithDetails } from "@/types";

const PET_PLACEHOLDER = "{寵物名字}";
const OWNER_PLACEHOLDER = "{家長}";

/** Replace `{寵物名字}` / `{家長}` with real names. */
export function fillPlaceholders(
  text: string,
  petName: string,
  ownerName: string,
): string {
  return text
    .split(PET_PLACEHOLDER)
    .join(petName)
    .split(OWNER_PLACEHOLDER)
    .join(ownerName);
}

/** Split free text into bullet lines, dropping blank lines. */
export function toBullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `- ${line}`);
}

export interface ReportInput {
  /** The single booking the report is about (first selected). */
  booking: BookingWithDetails;
  /** Ids of ticked completed tasks (category + "::" + task). */
  completedIds: Set<string>;
  /** 觀察記錄 raw text. */
  observations: string;
  /** Ids of ticked upcoming tasks (the preset string itself). */
  upcomingIds: Set<string>;
  /** 後續注意事項 free-text, one per line. */
  customUpcoming: string;
  /** 其他注意事項 raw text. */
  otherNotes: string;
}

/**
 * Build the plain-text report. Grouping mirrors the client's workflow:
 * completed tasks grouped by category, then observations, then follow-ups.
 */
export function generateReportText(input: ReportInput): string {
  const { booking } = input;
  const petName = booking.pet?.name ?? "毛孩";
  const ownerName =
    booking.customer?.name ?? booking.guestName ?? "家長";

  const fill = (s: string) => fillPlaceholders(s, petName, ownerName);

  const lines: string[] = [];

  // ── Header ──
  lines.push("🐈 Blackcat.petsitter 服務報告");
  lines.push("");
  lines.push(`• 寵物：${petName}`);
  lines.push(`  服務：${booking.serviceType}`);
  lines.push(`  日期：${formatDate(booking.startTime)}`);
  if (ownerName !== "家長") {
    lines.push(`  客戶：${ownerName}`);
  }
  lines.push("");

  // ── Completed tasks (only categories with a tick) ──
  lines.push("✅ 是日完成事項：");
  let anyCompleted = false;
  for (const group of COMPLETED_TASKS) {
    const ticked = group.tasks.filter((t) =>
      input.completedIds.has(`${group.category}::${t}`),
    );
    if (ticked.length === 0) continue;
    anyCompleted = true;
    lines.push(`${group.category}`);
    for (const t of ticked) lines.push(`- ${fill(t)}`);
  }
  if (!anyCompleted) lines.push("- （無）");
  lines.push("");

  // ── Observations ──
  lines.push("📝 觀察記錄：");
  const obs = toBullets(input.observations);
  if (obs.length) lines.push(...obs);
  else lines.push("- （無）");
  lines.push("");

  // ── Follow-ups: ticked presets + free-text ──
  lines.push("⏭️ 後續注意事項：");
  const upcoming = UPCOMING_TASKS.filter((t) => input.upcomingIds.has(t)).map(
    fill,
  );
  const custom = toBullets(input.customUpcoming).map((l) =>
    fill(l.replace(/^- /, "")),
  ).map((l) => `- ${l}`);
  const followUps = [...upcoming.map((t) => `- ${t}`), ...custom];
  if (followUps.length) lines.push(...followUps);
  else lines.push("- （無）");
  lines.push("");

  // ── Other notes ──
  const other = toBullets(input.otherNotes);
  if (other.length) {
    lines.push("📌 其他注意事項：");
    lines.push(...other);
    lines.push("");
  }

  lines.push("感謝你選用 Blackcat.petsitter！");
  return lines.join("\n");
}
