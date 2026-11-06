# Escenai

Convierte un brief de marketing en video vertical con voz, texto animado y subtítulos, usando tus propias API keys. Sin suscripción y sin intermediarios: tú pones la key, tú pagas el consumo.

Estado: **Fase 0 completada** (2026-11-06). Esqueleto, núcleo hexagonal y cifrado de keys funcionando y verificados. El pipeline de video entra en las fases 3-4.

---

## Requisitos

- Node 20 o superior (probado con 25.8.1)
- pnpm 10 o superior (probado con 12.15.0)
- ffmpeg (solo a partir de la fase 4, para el render)
- Docker (opcional; solo para el self-host y el worker en contenedor)

Funciona igual en macOS, Linux y Windows. Los finales de línea están forzados a LF en `.gitattributes` y los scripts son multiplataforma a propósito.

## Arrancar en local

```bash
pnpm install

# genera la clave que cifra las API keys de los usuarios (32 bytes en base64)
node -e "console.log('MASTER_KEY=' + require('crypto').randomBytes(32).toString('base64'))" > apps/web/.env.local

pnpm dev
# http://localhost:3000
```

Sin `.env.local` la app arranca igual, pero la pantalla de Ajustes avisa de que falta `MASTER_KEY` y no deja guardar keys.

## Verificar que todo está sano

```bash
pnpm check     # lint + typecheck + tests
pnpm build     # build de producción de la web
```

La regla de arquitectura también se prueba: cualquier import de `next`, `react`, `@supabase/*` o `node:*` dentro de `packages/core` hace fallar el lint.

## Estructura

```
apps/
  web/            Next.js 15 (App Router) + Tailwind 4 + i18n ES/EN
packages/
  core/           dominio, puertos, casos de uso, prompts y validadores
  adapters/       implementaciones: cifrado, Supabase, Google, MiniMax
infra/            docker-compose para self-host
*.md              documentación de producto, arquitectura y plan
```

`packages/core` no importa nada de `next`, `react`, SDKs de proveedor ni módulos de Node. Eso no es una convención: lo impone ESLint y hay que respetarlo.

## Estado de las fases

| Fase | Contenido | Estado |
|---|---|---|
| F0 | Monorepo, núcleo, cifrado de keys, UI bilingüe, CI | completada |
| F1 | Contrato `VideoPlan` + validador | completada (adelantada dentro de F0) |
| F2 | Guion de punta a punta con modelo real | pendiente |
| F3 | Imágenes (Nano Banana) y voz (MiniMax) | pendiente |
| F4 | Render con Remotion en worker | pendiente |
| F5 | Variantes 1:1 y 16:9, bilingüe, costos | pendiente |
| F6 | Publicación: demo, video y post en X | pendiente |

## Documentación

| Doc | Qué contiene |
|---|---|
| `00_Producto/01_vision_y_alcance.md` | Qué es, qué NO es, alcance cerrado de la v1 |
| `00_Producto/02_flujo_de_usuario.md` | Un ejemplo concreto de principio a fin (Café Aurora) |
| `01_Arquitectura/01_arquitectura_hexagonal.md` | Capas, regla de dependencia, puertos y adaptadores |
| `01_Arquitectura/02_contrato_videoplan.md` | El contrato JSON que produce el LLM y consume el render |
| `01_Arquitectura/03_proveedores_y_despliegue.md` | MiniMax y Google (endpoints verificados), jobs y despliegue |
| `02_Plan/01_fases.md` | Fases con criterio de salida objetivo |
| `02_Plan/02_decisiones.md` | Registro de decisiones con fecha y estado |
| `03_Referencias/01_formatos_de_video.md` | Análisis técnico de los videos de referencia |

## Cómo retomar en una sesión futura

1. Lee `02_Plan/02_decisiones.md`: ahí está qué se decidió y qué sigue abierto.
2. Mira la tabla de fases de arriba para saber dónde quedó.
3. Antes de tocar código, revisa la sección "regla de dependencia" de `01_Arquitectura/01_arquitectura_hexagonal.md`.

## Principios del proyecto

1. **Contrato primero.** El LLM propone un JSON, un validador determinista lo acepta o lo rechaza, el render consume exactamente ese JSON. El modelo nunca escribe código ni calcula tiempos.
2. **La voz manda.** La duración de cada escena la decide el audio real, no el guion. Un guion de 45 s que narra en 52 s se recorta, no se acelera.
3. **BYOK con cifrado.** Las keys del usuario se guardan cifradas en servidor (AES-256-GCM), nunca en localStorage ni en el bundle.
4. **Todo lo caro es asíncrono.** Imagen, voz, video y render son jobs con estado; la UI nunca espera bloqueada.
5. **El núcleo no sabe quién es MiniMax.** Si mañana entra Kling o Runway, se escribe un adaptador y no se toca `packages/core`.

## Licencia

MIT (ver `LICENSE`).
