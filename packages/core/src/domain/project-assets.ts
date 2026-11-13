/**
 * Assets por escena.
 *
 * Hasta ahora las imágenes, la voz y los clips vivían en el estado de React: un F5
 * borraba trabajo ya pagado. Estos tipos los cuelgan del proyecto, con estado por
 * asset, para que la interfaz pueda cerrarse y retomarse.
 */

export type AssetKind = 'image' | 'voice' | 'clip';

export type AssetStatus = 'idle' | 'running' | 'ready' | 'error';

export interface SceneAsset {
  readonly sceneId: string;
  readonly kind: AssetKind;
  readonly status: AssetStatus;
  /** Clave en el almacenamiento. Solo los assets `ready` la tienen. */
  readonly ref: string | null;
  readonly mimeType: string | null;
  readonly errorCode: string | null;
  readonly updatedAt: string;
}

export const ASSET_KINDS: readonly AssetKind[] = ['image', 'voice', 'clip'];

export function sceneAssets(assets: readonly SceneAsset[] | undefined): readonly SceneAsset[] {
  return assets ?? [];
}

export function findSceneAsset(
  assets: readonly SceneAsset[] | undefined,
  sceneId: string,
  kind: AssetKind,
): SceneAsset | undefined {
  return sceneAssets(assets).find((asset) => asset.sceneId === sceneId && asset.kind === kind);
}

/**
 * Un asset `ready` sin clave es un bug de programación, no un estado válido:
 * la interfaz lo mostraría como listo y el render no tendría nada que leer.
 */
export function isAssetConsistent(asset: SceneAsset): boolean {
  if (asset.status !== 'ready') return true;
  return asset.ref !== null && asset.ref.trim().length > 0;
}

export function upsertSceneAsset(
  assets: readonly SceneAsset[] | undefined,
  next: SceneAsset,
): readonly SceneAsset[] {
  const list = sceneAssets(assets);
  const index = list.findIndex(
    (asset) => asset.sceneId === next.sceneId && asset.kind === next.kind,
  );
  if (index === -1) return [...list, next];
  return list.map((asset, i) => (i === index ? next : asset));
}

export function assetKey(sceneId: string, kind: AssetKind): string {
  return `${kind}:${sceneId}`;
}
