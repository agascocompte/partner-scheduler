import type { Shift } from "./types";

const TZID = "Europe/Madrid";

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
].join("\r\n");

function compact(date: string): string {
  return date.replaceAll("-", "");
}

function toDt(date: string, time: string): string {
  const [h, m] = time.split(":");
  return `${compact(date)}T${h.padStart(2, "0")}${(m ?? "00").padStart(2, "0")}00`;
}

function nextDay(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildICS(
  shifts: Shift[],
  person: string,
  includeFreeDays: boolean,
): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const events: string[] = [];

  for (const s of shifts) {
    if (s.free) {
      if (!includeFreeDays) continue;
      events.push(
        [
          "BEGIN:VEVENT",
          // Stable UID per day: re-importing the same week updates instead of duplicating
          `UID:libre-${compact(s.date)}@partner-scheduler`,
          `DTSTAMP:${now}`,
          `DTSTART;VALUE=DATE:${compact(s.date)}`,
          `DTEND;VALUE=DATE:${compact(nextDay(s.date))}`,
          `SUMMARY:Libre (${person})`,
          "TRANSP:TRANSPARENT",
          "END:VEVENT",
        ].join("\r\n"),
      );
      continue;
    }

    // Overnight shift (e.g. 23:00-07:00) ends the next day
    const endDate = s.end <= s.start ? nextDay(s.date) : s.date;
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:turno-${compact(s.date)}@partner-scheduler`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=${TZID}:${toDt(s.date, s.start)}`,
        `DTEND;TZID=${TZID}:${toDt(endDate, s.end)}`,
        `SUMMARY:Trabajo ${person} (${s.start}-${s.end})`,
        "END:VEVENT",
      ].join("\r\n"),
    );
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//partner-scheduler//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    VTIMEZONE,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
