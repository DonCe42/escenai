# Escenai

Convierte un brief de marketing en un video vertical con voz, texto animado y subtítulos, usando tus propias API keys. Sin suscripción y sin intermediarios: tú pones la key, tú pagas el consumo.

Escribes cuatro campos, el modelo propone el guion, se generan las ilustraciones y la voz, y sale un MP4 de 1080x1920 con subtítulos sincronizados.

---

## Requisitos

- Node 20 o superior (probado con 25.8.1)
- pnpm 10 o superior (probado con 12.15.0)
- ffmpeg
- Docker (opcional; solo para el self-host)
- Chrome o Chromium instalados (el render los usa)

Funciona igual en macOS, Linux y Windows. Los finales de línea están forzados a LF en `.gitattributes` y los scripts son multiplataforma a propósito.

## Arrancar en local

```bash
pnpm install

# genera la clave que cifra las API keys de los usuarios (32 bytes en base64)
node -e "console.log('MASTER_KEY=' + require('crypto').randomBytes(32).toString('base64'))" > apps/web/.env.local

pnpm dev
# http://localhost:3000  →  /new
```

Sin `.env.local` la app arranca igual, pero la pantalla de Ajustes avisa de que falta `MASTER_KEY` y no deja guardar keys.

## Proveedores

Las keys se pegan en `/settings`. Se guardan cifradas con AES-256-GCM y se verifican contra el proveedor en el momento de guardarlas.

| Proveedor | Credencial | Para qué |
|---|---|---|
| Google Vertex | cuenta de servicio (JSON) | guion (`gemini-3.6-flash`) e imágenes (`gemini-nano-banana-2.1`) |
| Google AI Studio | API key `AIza…` | guion por la API pública |
| MiniMax | API key | voz (`speech-2.8-hd`), imágenes (`image-01`), video (`MiniMax-Hailuo-02`) |

Precios de video (por segundo, consultados el 2026-11-06):

    MiniMax-H3            2K 0.13   ·  768P 0.08
    MiniMax-H3-Highspeed          ·  768P 0.06  ·  480P 0.04
    MiniMax-H3-Lite               ·  768P 0.04  ·  480P 0.025

Un clip de 5 s con H3-Lite en 768P cuesta $0.20; con H3 en 2K, $0.65.

Notas de uso:

- **Imágenes**: Nano Banana respeta el estilo plano y la paleta; `image-01` de MiniMax deriva a cómic/fotorrealismo e inventa marcas reales. Vertex es el motor por defecto.
- **Video generativo**: los modelos H3 se cobran por **Pay-as-you-go**, no por el plan de tokens; sin saldo de video responden 402. Alternativa con el plan actual: `MiniMax-Hailuo-02` (6 s, 16:9 salvo que se le pase el primer fotograma). El modelo se cambia con `MINIMAX_VIDEO_MODEL`.
- **Vertex**: los modelos nuevos solo responden en la ubicación `global`; en `us-central1` devuelven 404. Por eso `VERTEX_LOCATION` está en `.env`.

## Verificar que todo está sano

```bash
pnpm check     # lint + typecheck + tests
pnpm build     # build de producción
```

La regla de arquitectura también se prueba: cualquier import de `next`, `react`, `@supabase/*` o `node:*` dentro de `packages/core` hace fallar el lint.

## Estructura

```
apps/
  web/            Next.js 15 (App Router) + Tailwind 4 + i18n ES/EN
  worker/         render con Remotion
packages/
  core/           dominio, puertos, casos de uso, prompts y validadores
  adapters/       cifrado, almacenamiento, Google Vertex, Google AI Studio, MiniMax
infra/            docker-compose para self-host
```

`packages/core` no importa nada de `next`, `react`, SDKs de proveedor ni módulos de Node. No es una convención: lo impone ESLint y hay que respetarlo.

## Principios del proyecto

1. **Contrato primero.** El LLM propone un JSON, un validador determinista lo acepta o lo rechaza, el render consume exactamente ese JSON. El modelo nunca escribe código ni calcula tiempos.
2. **La voz manda.** La duración de cada escena la decide el audio real, no el guion. Un guion de 45 s que narra en 55 s se recorta, no se acelera.
3. **BYOK con cifrado.** Las keys del usuario se guardan cifradas en servidor (AES-256-GCM), nunca en localStorage ni en el bundle.
4. **Todo lo caro es asíncrono.** Imagen, voz, video y render tienen estado; la UI nunca espera bloqueada.
5. **El núcleo no sabe quién es MiniMax.** Si mañana entra Kling o Runway, se escribe un adaptador y no se toca `packages/core`.

## Licencia

MIT (ver `LICENSE`).
