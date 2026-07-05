import type { Shift } from "./types";
import { nextDay, shiftName } from "./ics";

const TIMEZONE = "Europe/Madrid";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Google Calendar color ids: 5 = amarillo, 6 = naranja, 11 = rojo
const SHIFT_COLOR: Record<string, string> = {
  "Mañana": "5",
  "Noche": "11",
  "Partido": "6",
};

interface TokenResponse {
  access_token?: string;
  error?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }): { requestAccessToken(): void };
        };
      };
    };
  }
}

let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () =>
        reject(new Error("No se pudo cargar el script de Google. ¿Sin conexión?"));
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

async function getAccessToken(clientId: string): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/calendar.events",
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error ?? "Google no concedió el permiso."));
      },
      error_callback: (err) =>
        reject(new Error(err.message ?? `Inicio de sesión cancelado (${err.type}).`)),
    });
    client.requestAccessToken();
  });
}

interface GEvent {
  id: string;
  body: Record<string, unknown>;
}

/**
 * Deterministic event ids (Google only allows chars a-v and 0-9) so that
 * sending the same day twice updates the event instead of duplicating it.
 */
function eventFor(s: Shift): GEvent {
  const digits = s.date.replaceAll("-", "");
  if (s.free) {
    return {
      id: `libre${digits}`,
      body: {
        summary: "Libre",
        transparency: "transparent",
        start: { date: s.date },
        end: { date: nextDay(s.date) },
      },
    };
  }
  const name = shiftName(s.start, s.end);
  const endDate = s.end <= s.start ? nextDay(s.date) : s.date;
  return {
    id: `turno${digits}`,
    body: {
      summary: name,
      colorId: SHIFT_COLOR[name],
      start: { dateTime: `${s.date}T${s.start}:00`, timeZone: TIMEZONE },
      end: { dateTime: `${endDate}T${s.end}:00`, timeZone: TIMEZONE },
    },
  };
}

export interface GoogleResult {
  created: number;
  updated: number;
}

export async function addShiftsToGoogle(
  clientId: string,
  shifts: Shift[],
  includeFreeDays: boolean,
): Promise<GoogleResult> {
  const token = await getAccessToken(clientId);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let created = 0;
  let updated = 0;

  for (const s of shifts) {
    if (s.free && !includeFreeDays) continue;
    const { id, body } = eventFor(s);

    const res = await fetch(CALENDAR_API, {
      method: "POST",
      headers,
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) {
      created++;
      continue;
    }
    if (res.status === 409) {
      // Event already exists for this day: update it
      const up = await fetch(`${CALENDAR_API}/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...body, status: "confirmed" }),
      });
      if (up.ok) {
        updated++;
        continue;
      }
      throw new Error(`Error ${up.status} al actualizar el día ${s.date}.`);
    }
    const err = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(err?.error?.message ?? `Error ${res.status} al crear el día ${s.date}.`);
  }

  return { created, updated };
}
