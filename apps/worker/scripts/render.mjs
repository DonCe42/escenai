// Render de un video a partir de un JSON de props.
// Uso: node scripts/render.mjs <props.json> <salida.mp4>
import { renderMedia, selectComposition } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const [propsPath, outputPath] = process.argv.slice(2);
if (!propsPath || !outputPath) {
  console.error('Uso: node scripts/render.mjs <props.json> <salida.mp4>');
  process.exit(1);
}

/**
 * Chrome del sistema si existe; si no, Remotion baja su propio headless shell.
 * Sin esta detección, el render lanzado desde la API no encontraba navegador.
 */
function findBrowser() {
  if (process.env.REMOTION_BROWSER && existsSync(process.env.REMOTION_BROWSER)) {
    return process.env.REMOTION_BROWSER;
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

const browserExecutable = findBrowser();
const props = JSON.parse(await readFile(propsPath, 'utf8'));
const entry = path.resolve(import.meta.dirname, '../src/index.ts');

if (browserExecutable) console.log(`navegador: ${browserExecutable}`);

const serveUrl = await bundle({ entryPoint: entry });
const composition = await selectComposition({
  serveUrl,
  id: 'Escenai',
  inputProps: props,
  browserExecutable,
});

const startedAt = Date.now();
await renderMedia({
  serveUrl,
  composition,
  codec: 'h264',
  outputLocation: outputPath,
  inputProps: props,
  // Un solo hilo: con dos, Chrome se queda sin memoria en videos largos.
  concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 1),
  browserExecutable,
  onProgress: ({ progress }) => {
    if (Math.round(progress * 100) % 20 === 0) {
      console.log(`render ${Math.round(progress * 100)}%`);
    }
  },
});

console.log(`listo en ${((Date.now() - startedAt) / 1000).toFixed(1)}s -> ${outputPath}`);
