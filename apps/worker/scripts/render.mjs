// Render de un video a partir de un JSON de props.
// Uso: node scripts/render.mjs <props.json> <salida.mp4>
import { renderMedia, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [propsPath, outputPath] = process.argv.slice(2);
if (!propsPath || !outputPath) {
  console.error('Uso: node scripts/render.mjs <props.json> <salida.mp4>');
  process.exit(1);
}

const props = JSON.parse(await readFile(propsPath, 'utf8'));
const entry = path.resolve(import.meta.dirname, '../src/index.ts');

const serveUrl = await bundle({ entryPoint: entry });
const composition = await selectComposition({
  serveUrl,
  id: 'Escenai',
  inputProps: props,
  browserExecutable: process.env.REMOTION_BROWSER ?? null,
});

const startedAt = Date.now();
await renderMedia({
  serveUrl,
  composition,
  codec: 'h264',
  outputLocation: outputPath,
  inputProps: props,
  concurrency: 2,
  browserExecutable: process.env.REMOTION_BROWSER ?? null,
  onProgress: ({ progress }) => {
    if (Math.round(progress * 100) % 20 === 0) {
      console.log(`render ${Math.round(progress * 100)}%`);
    }
  },
});

console.log(`listo en ${((Date.now() - startedAt) / 1000).toFixed(1)}s -> ${outputPath}`);
