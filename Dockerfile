# Escenai en un solo contenedor: web + worker de render.
# El render necesita Chromium y minutos de CPU, así que no cabe en serverless.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ffmpeg \
      ca-certificates \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Remotion usa el Chromium del sistema; así no descarga 150 MB en cada arranque.
ENV REMOTION_BROWSER=/usr/bin/chromium
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build

# Los datos (keys cifradas, proyectos, assets y renders) van a un volumen.
VOLUME ["/app/apps/web/.data"]

EXPOSE 3000
CMD ["pnpm", "--filter", "@escenai/web", "start"]
