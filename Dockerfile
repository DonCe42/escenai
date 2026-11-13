# syntax=docker/dockerfile:1
#
# Escenai en un solo contenedor: web + worker de render.
# El render necesita Chromium y minutos de CPU, así que no cabe en serverless.
#
# Tres etapas para que la imagen final no arrastre lo que solo hace falta para
# compilar: dependencias de desarrollo, store de pnpm (650 MB) y caché de Next.

# ---------------------------------------------------------------- base
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    DEBIAN_FRONTEND=noninteractive
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------- dependencias
# Solo manifiestos: un cambio en el código no invalida la instalación.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/adapters/package.json packages/adapters/
COPY packages/composition/package.json packages/composition/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------- build
FROM deps AS build
COPY . .
RUN pnpm build

# Se poda en la misma etapa: si se copiara el árbol completo a la imagen final,
# el store y las devDependencies quedarían en una capa de la que no se pueden
# quitar. `--prod` rehace node_modules solo con lo que se usa en ejecución.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile \
 && rm -rf apps/web/.next/cache .turbo

# Sobran en ejecución y pesan: swc compila, TypeScript solo mira tipos y el
# studio de Remotion es la interfaz de edición. Se borran ANTES del COPY: si se
# borraran en la etapa final, la capa copiada seguiría contando los bytes.
RUN rm -rf node_modules/.pnpm/@next+swc-* \
           node_modules/.pnpm/@turbo+* \
           node_modules/.pnpm/@remotion+studio* \
           node_modules/.pnpm/typescript@* \
           node_modules/.pnpm/@typescript-eslint* \
    || true

# ---------------------------------------------------------------- runtime
FROM node:22-bookworm-slim AS runner
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ffmpeg \
      ca-certificates \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Remotion usa el Chromium del sistema; así no descarga 150 MB en cada arranque.
ENV REMOTION_BROWSER=/usr/bin/chromium \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /app
COPY --from=build /app ./

# Los datos (keys cifradas, proyectos, assets y renders) van a un volumen.
VOLUME ["/app/apps/web/.data"]

EXPOSE 3000
CMD ["pnpm", "--filter", "@escenai/web", "start"]
