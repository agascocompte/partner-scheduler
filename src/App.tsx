import { useEffect, useState } from "react";
import { extractShifts, fileToResizedBase64 } from "./extract";
import { buildICS, downloadICS } from "./ics";
import type { Shift } from "./types";
import "./App.css";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function weekday(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getDay()];
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("anthropic_api_key") ?? "");
  const [person, setPerson] = useState(() => localStorage.getItem("person_name") ?? "Marta J");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [includeFreeDays, setIncludeFreeDays] = useState(false);

  useEffect(() => {
    localStorage.setItem("anthropic_api_key", apiKey);
  }, [apiKey]);
  useEffect(() => {
    localStorage.setItem("person_name", person);
  }, [person]);

  function onFileChange(f: File | null) {
    setFile(f);
    setShifts([]);
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function onExtract() {
    if (!file || !apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const { data, mediaType } = await fileToResizedBase64(file);
      const result = await extractShifts(apiKey, data, mediaType, person, year);
      setShifts(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function updateShift(i: number, patch: Partial<Shift>) {
    setShifts((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function removeShift(i: number) {
    setShifts((prev) => prev.filter((_, j) => j !== i));
  }

  function addShift() {
    const last = shifts[shifts.length - 1];
    const date = last
      ? new Date(`${last.date}T12:00:00`)
      : new Date();
    if (last) date.setDate(date.getDate() + 1);
    setShifts((prev) => [
      ...prev,
      { date: date.toISOString().slice(0, 10), free: false, start: "07:00", end: "15:00" },
    ]);
  }

  function onDownload() {
    const ics = buildICS(shifts, person, includeFreeDays);
    const first = shifts[0]?.date ?? "horario";
    downloadICS(ics, `horario-${person.replaceAll(" ", "_")}-${first}.ics`);
  }

  const canExtract = Boolean(file && apiKey && !loading);
  const workDays = shifts.filter((s) => !s.free).length;

  return (
    <main className="app">
      <h1>📅 Partner Scheduler</h1>
      <p className="subtitle">
        Sube una foto del horario en papel, extrae los turnos de {person || "…"} y
        descárgalos para Google Calendar o Apple Calendar.
      </p>

      <section className="card">
        <h2>1. Configuración</h2>
        <label>
          Clave API de Anthropic
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value.trim())}
            placeholder="sk-ant-..."
            autoComplete="off"
          />
          <small>
            Se guarda solo en este navegador. Consigue una en{" "}
            <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            .
          </small>
        </label>
        <div className="row">
          <label>
            Nombre en el horario
            <input value={person} onChange={(e) => setPerson(e.target.value)} />
          </label>
          <label>
            Año
            <input
              type="number"
              value={year}
              min={2020}
              max={2100}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>2. Foto del horario</h2>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        {preview && <img className="preview" src={preview} alt="Horario" />}
        <button className="primary" disabled={!canExtract} onClick={onExtract}>
          {loading ? "Extrayendo… (puede tardar un minuto)" : "Extraer turnos"}
        </button>
        {error && <p className="error">⚠️ {error}</p>}
      </section>

      {shifts.length > 0 && (
        <section className="card">
          <h2>3. Turnos extraídos</h2>
          <p>
            <strong>{workDays}</strong> días de trabajo y{" "}
            <strong>{shifts.length - workDays}</strong> libres. Revisa y corrige antes de
            descargar.
          </p>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Día</th>
                <th>Libre</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s, i) => (
                <tr key={i} className={s.free ? "free-day" : ""}>
                  <td>
                    <input
                      type="date"
                      value={s.date}
                      onChange={(e) => updateShift(i, { date: e.target.value })}
                    />
                  </td>
                  <td>{weekday(s.date)}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={s.free}
                      onChange={(e) => updateShift(i, { free: e.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={s.start}
                      disabled={s.free}
                      onChange={(e) => updateShift(i, { start: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={s.end}
                      disabled={s.free}
                      onChange={(e) => updateShift(i, { end: e.target.value })}
                    />
                  </td>
                  <td>
                    <button className="ghost" onClick={() => removeShift(i)} title="Eliminar">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="ghost" onClick={addShift}>
            + Añadir día
          </button>

          <h2>4. Exportar</h2>
          <label className="inline">
            <input
              type="checkbox"
              checked={includeFreeDays}
              onChange={(e) => setIncludeFreeDays(e.target.checked)}
            />
            Incluir días libres como eventos de día completo
          </label>
          <button className="primary" onClick={onDownload}>
            ⬇️ Descargar .ics
          </button>
          <details>
            <summary>¿Cómo lo añado al calendario?</summary>
            <ul>
              <li>
                <strong>iPhone / Apple Calendar:</strong> abre el archivo .ics descargado y
                pulsa «Añadir todos».
              </li>
              <li>
                <strong>Google Calendar:</strong> en{" "}
                <a
                  href="https://calendar.google.com/calendar/u/0/r/settings/export"
                  target="_blank"
                  rel="noreferrer"
                >
                  calendar.google.com → Ajustes → Importar y exportar
                </a>
                , selecciona el archivo .ics e impórtalo. Si reimportas la misma semana
                corregida, los eventos se actualizan (no se duplican).
              </li>
            </ul>
          </details>
        </section>
      )}
    </main>
  );
}
