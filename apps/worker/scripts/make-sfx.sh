#!/usr/bin/env bash
#
# Genera los efectos de sonido ORIGINALES de Escenai con ffmpeg puro.
# Sin samples de terceros, sin licencias que atribuir: todo es síntesis.
#
# Uso:  bash apps/worker/scripts/make-sfx.sh
# Salida: apps/worker/public/sfx/{whoosh,impact,riser}.wav (48 kHz, estéreo, pcm_s16le)
#
# Las fórmulas están en las expresiones de `aevalsrc`: son deterministas, así que
# volver a ejecutar el script produce exactamente los mismos bytes (salvo el
# header WAV, que es estable). `random(0)` y `random(1)` usan semilla interna fija.
#
# Niveles: se normalizan a mano con `volume` para que los tres efectos tengan
# picos parecidos (≈ -6 dBFS) y los volúmenes de mezcla del código (0.18 / 0.22 /
# 0.12) signifiquen lo mismo para los tres. Los valores de ganancia salen de
# medir con `ffmpeg -af volumedetect` (ver comentario de cada bloque).

set -euo pipefail

FFMPEG="${FFMPEG:-/opt/homebrew/bin/ffmpeg}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)/public/sfx"
SR=48000

mkdir -p "${OUT_DIR}"

# ---------------------------------------------------------------------------
# 1. whoosh.wav (0,40 s) — ruido blanco con ataque rápido y caída exponencial,
#    pasado por un pasa-banda que le quita el "hiss" y le deja cuerpo.
#    Raw: max -14,3 dBFS; se sube a ≈ -1 dBFS para que a 0,18 de mezcla se oiga
#    sin tapar la voz (en el mix queda ~12 dB por debajo del pico de la voz).
# ---------------------------------------------------------------------------
"${FFMPEG}" -hide_banner -loglevel error -y \
  -f lavfi -i "aevalsrc='0.55*(random(0)-0.5)*min(t/0.09,1)*exp(-max(t-0.09,0)*8)':s=${SR}:d=0.40" \
  -af "highpass=f=260,lowpass=f=6000,equalizer=f=1300:t=q:w=1.4:g=5,volume=13.3dB,afade=t=in:st=0:d=0.02,afade=t=out:st=0.33:d=0.07" \
  -ac 2 -c:a pcm_s16le "${OUT_DIR}/whoosh.wav"

# ---------------------------------------------------------------------------
# 2. impact.wav (0,55 s) — seno con barrido 150 Hz -> 40 Hz (chirp lineal) con
#    caída exponencial, más un click de ruido de 3 ms para el transitorio.
#    Raw: max -2,7 dBFS; se deja en ≈ -1 dBFS.
# ---------------------------------------------------------------------------
"${FFMPEG}" -hide_banner -loglevel error -y \
  -f lavfi -i "aevalsrc='0.85*sin(2*PI*(150*t-110*t*t))*exp(-t*11)+0.5*(random(1)-0.5)*min(t/0.003,1)*exp(-t*60)':s=${SR}:d=0.55" \
  -af "lowpass=f=9000,highpass=f=35,volume=1.7dB,afade=t=in:st=0:d=0.003,afade=t=out:st=0.45:d=0.08" \
  -ac 2 -c:a pcm_s16le "${OUT_DIR}/impact.wav"

# ---------------------------------------------------------------------------
# 3. riser.wav (0,60 s) — barrido de frecuencia 180 Hz -> 1400 Hz con amplitud
#    creciente (t/T)^1,6 y un armónico superior tenue que le da brillo.
#    Termina con fade-out de 50 ms para no chasquear al cortar en el CTA.
#    Raw: max -8,3 dBFS; se deja en ≈ -2 dBFS (es el más largo: 0,6 s, y se
#    solapa con el whoosh del mismo corte).
# ---------------------------------------------------------------------------
"${FFMPEG}" -hide_banner -loglevel error -y \
  -f lavfi -i "aevalsrc='0.55*sin(2*PI*(180*t+1016.667*t*t))*pow(t/0.6,1.6)+0.14*sin(2*PI*(360*t+2033.333*t*t))*pow(t/0.6,1.6)':s=${SR}:d=0.60" \
  -af "highpass=f=150,volume=6.3dB,afade=t=in:st=0:d=0.02,afade=t=out:st=0.55:d=0.05" \
  -ac 2 -c:a pcm_s16le "${OUT_DIR}/riser.wav"

echo "SFX generados en ${OUT_DIR}"
for f in whoosh impact riser; do
  printf '  %-8s ' "${f}.wav"
  "${FFMPEG}" -hide_banner -i "${OUT_DIR}/${f}.wav" -af volumedetect -f null - 2>&1 |
    grep -E 'mean_volume|max_volume' | sed 's/.*] //' | tr '\n' ' '
  echo
done
