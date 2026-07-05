# Partner Scheduler

Web app estática (GitHub Pages) para pasar el horario de trabajo en papel al
calendario del móvil:

1. Haz una foto del horario y súbela.
2. Claude (visión) extrae los turnos de **Marta J** (bloque rojo: hora de
   inicio arriba, hora de fin abajo).
3. Revisa/corrige los turnos en la tabla.
4. Añádelos a Google Calendar (directo) o Apple Calendar (.ics).

**App:** https://agascocompte.github.io/partner-scheduler/

## Nombres de los turnos

| Horario | Título del evento |
|---|---|
| 07:00 – 15:00 | Mañana |
| 13:00 – 21:00 o 13:30 – 21:30 | Tarde |
| Cualquier otro | Partido |

## Requisitos

- **Clave API de Anthropic** (para la extracción de la foto): créala en
  [console.anthropic.com](https://console.anthropic.com/). Se guarda solo en el
  navegador (localStorage). Cada extracción cuesta unos céntimos.

- **Google Client ID** (opcional, solo para el botón «Añadir a Google
  Calendar»): ver abajo.

## Crear el Google Client ID (una vez, gratis)

El botón de Google usa OAuth desde el navegador; no hay servidor ni secretos.
El Client ID es un identificador público, es seguro pegarlo en la app.

1. Ve a [console.cloud.google.com](https://console.cloud.google.com/) y crea un
   proyecto (o reutiliza uno).
2. **APIs y servicios → Biblioteca** → busca *Google Calendar API* → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Externo** → Crear.
   - Rellena nombre de la app y correos. Guarda.
   - En **Usuarios de prueba** («Test users»), añade la cuenta de Google de
     quien vaya a usar el botón (p. ej. la de Marta). Mientras la app esté en
     modo «Prueba» solo esas cuentas pueden autorizarla, que es justo lo que
     queremos.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de
   OAuth**:
   - Tipo: **Aplicación web**.
   - Orígenes de JavaScript autorizados: `https://agascocompte.github.io`
     (y `http://localhost:5173` si quieres probar en local).
   - No hace falta URI de redirección.
5. Copia el **Client ID** (`xxxx.apps.googleusercontent.com`) y pégalo en el
   paso 1 de la app. Se guarda en el navegador.

La primera vez que se pulse el botón, Google pedirá permiso para gestionar
eventos del calendario. Los eventos usan un id determinista por día, así que
reenviar una semana corregida **actualiza** los eventos en vez de duplicarlos.

## Desarrollo

```sh
npm install
npm run dev      # http://localhost:5173/partner-scheduler/
npm run build
```

El deploy es automático: cada push a `main` publica en GitHub Pages mediante
GitHub Actions.
