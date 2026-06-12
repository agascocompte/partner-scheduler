import Anthropic from "@anthropic-ai/sdk";
import type { Shift } from "./types";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shifts"],
  properties: {
    shifts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "free", "start", "end"],
        properties: {
          date: {
            type: "string",
            description: "Fecha del día en formato ISO YYYY-MM-DD",
          },
          free: {
            type: "boolean",
            description: "true si la trabajadora no tiene turno ese día (día libre)",
          },
          start: {
            type: "string",
            description: "Hora de inicio del turno en formato HH:MM (24h). Cadena vacía si es día libre.",
          },
          end: {
            type: "string",
            description: "Hora de fin del turno en formato HH:MM (24h). Cadena vacía si es día libre.",
          },
        },
      },
    },
  },
} as const;

function buildPrompt(person: string, year: number): string {
  return `La imagen es una foto de un horario semanal de personal (en español).

Cómo leer el horario:
- La parte superior es una tabla con una columna por día. La cabecera de cada columna muestra la fecha (p. ej. "01-jun") y el día de la semana (LUNES, MARTES...).
- Dentro de cada columna de día, cada trabajador tiene un bloque vertical de color con su nombre escrito en vertical dentro del bloque.
- La hora escrita en la parte SUPERIOR del bloque es la hora de inicio del turno, y la hora en la parte INFERIOR del bloque es la hora de fin (p. ej. "7h" arriba y "15h" abajo = turno de 07:00 a 15:00). Pueden aparecer horas con minutos como "13:30".

Tu tarea: extraer ÚNICAMENTE el horario de la trabajadora "${person}" (su bloque es de color rojo oscuro).

MUY IMPORTANTE:
- Puede existir otra trabajadora llamada "Marta" (sin la J). Es una persona DISTINTA: ignórala por completo, incluidas las anotaciones de texto como "Marta 8:00-16:00" que aparecen dentro de las columnas. Esas anotaciones se refieren a otras personas, no a "${person}".
- Ignora también las filas inferiores de la tabla (las de MADJOUA, CARLOS, JUAN, ISMAEL, MARTA, RAIZA, RYAN... con horarios tipo "11:00 - 21:00").
- Los nombres listados justo debajo del gráfico bajo cada día (p. ej. "Raiza / Mandy") indican personas que libran ese día.
- Si "${person}" no tiene bloque en la columna de un día, ese día es libre (free = true, start y end como cadena vacía).

El año es ${year}. Los meses aparecen abreviados en español: ene, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic.

Devuelve una entrada por cada día que aparezca en la imagen, en orden cronológico.`;
}

export async function extractShifts(
  apiKey: string,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  person: string,
  year: number,
): Promise<Shift[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: buildPrompt(person, year) },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("La API rechazó la petición. Inténtalo de nuevo con otra foto.");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("La respuesta de la API no contiene datos.");
  }
  const parsed = JSON.parse(text.text) as { shifts: Shift[] };
  return parsed.shifts;
}

/**
 * Downscales the photo so the long edge is at most 2400px (Opus supports
 * up to 2576px natively) and re-encodes as JPEG to keep the payload small.
 */
export async function fileToResizedBase64(
  file: File,
): Promise<{ data: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const MAX = 2400;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}
