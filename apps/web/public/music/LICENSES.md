# Música incluida

Tres pistas instrumentales para el fondo. Todas **CC0 1.0** (dominio público): se pueden
usar comercialmente, modificar y redistribuir sin atribución. Se eligen CC0 y no
«royalty free» con condiciones porque este repositorio **distribuye los MP3 tal cual**, y
licencias como la de Pixabay prohíben redistribuir la pista de forma aislada.

| Archivo | Título | Autor | Fuente | Licencia |
|---|---|---|---|---|
| `corporativo.mp3` | Tropicorp Advertisement | code_box | https://freesound.org/people/code_box/sounds/561190 | CC0 1.0 |
| `upbeat.mp3` | 30-Second Upbeat Background Loop | circlevalleysounds | https://freesound.org/people/circlevalleysounds/sounds/725884 | CC0 1.0 |
| `piano.mp3` | Upbeat Piano Loop | zPianodude | https://freesound.org/people/zPianodude/sounds/712610 | CC0 1.0 |

Texto de la licencia: https://creativecommons.org/publicdomain/zero/1.0/

## Cómo se procesaron

- Normalizadas con `ffmpeg loudnorm=I=-18:TP=-2:LRA=9` para que las tres suenen al mismo
  nivel antes del ducking.
- 44,1 kHz, estéreo, MP3 128 kbps. De ~2,5 MB originales a 0,5–1,6 MB por pista.
- El render las mezcla a 0,12 de ganancia y baja aún más el volumen bajo la voz
  (`duckingGain` en `packages/composition/src/sound.ts`).

## Añadir o cambiar una pista

1. Comprueba en la ficha de origen que la licencia es **CC0 1.0** (o dominio público).
   Una licencia «gratis para YouTube» o «royalty free» no basta si el repo redistribuye el archivo.
2. Normaliza con el comando de arriba y guárdala en esta carpeta.
3. Añade la fila a esta tabla con autor y URL de origen: es la trazabilidad que se
   necesita si alguien pregunta por derechos.
4. Registra el identificador en `apps/web/src/lib/music.ts`.

Ninguna pista lleva Content ID: al ser CC0 no hay reclamación posible por parte del autor.
