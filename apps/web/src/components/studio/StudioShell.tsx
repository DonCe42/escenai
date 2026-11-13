'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  CAPTION_STYLES,
  LIMITS,
  MOTIONS,
  MAX_STYLE_REFERENCES,
  STYLE_KINDS,
  countWords,
  duplicateScene,
  estimateCost,
  moveScene,
  removeScene,
  totalDuration,
  validateVideoPlan,
  withTarget,
  type Motion,
  type PlanIssue,
  type Scene,
  type StyleKind,
  type VideoPlan,
} from '@escenai/core';
import { PRICES, PRICE_NOTES, PRICE_SNAPSHOT_LABEL, usd } from '@/lib/prices';
import { MUSIC_OPTIONS } from '@/lib/music';

// El Player toca window: solo en cliente y sin SSR.
const PreviewPlayer = dynamic(() => import('./PreviewPlayer').then((m) => m.PreviewPlayer), {
  ssr: false,
  loading: () => <div className="slate-preview-loading">Cargando preview…</div>,
});

interface StudioShellProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly assets: readonly StudioAsset[];
  readonly styleReferences: readonly StudioStyleReference[];
  readonly voiceMeta: Readonly<Record<string, VoiceMeta>>;
  readonly activeJob: ActiveJob | null;
  readonly initialRenderUrl: string | null;
  readonly plan: VideoPlan;
  readonly version: number;
  readonly versionCount: number;
  readonly updatedAt: string;
}

type SaveState =
  | { readonly kind: 'clean' }
  | { readonly kind: 'dirty' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly version: number }
  | { readonly kind: 'error'; readonly message: string };

export interface ActiveJob {
  readonly id: string;
  readonly progress: number;
}

export interface VoiceMeta {
  readonly durationMs: number;
  readonly words: readonly { readonly word: string; readonly startMs: number; readonly endMs: number }[];
}

export interface StudioAsset {
  readonly sceneId: string;
  readonly kind: 'image' | 'voice' | 'clip';
  readonly status: 'idle' | 'running' | 'ready' | 'error';
  readonly url: string | null;
  readonly errorCode: string | null;
}

/** Pieza del tablero de estilo, ya con URL firmada. */
export interface StudioStyleReference {
  readonly id: string;
  readonly kind: StyleKind;
  readonly label: string;
  readonly url: string;
}

const STYLE_KIND_LABELS: Record<StyleKind, string> = {
  producto: 'producto',
  personaje: 'personaje',
  logo: 'logo',
  estilo: 'estilo',
};

function useElapsed(active: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setValue(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return value;
}

const MOTION_LABELS: Record<Motion, string> = {
  'zoom-in-lento': 'Zoom in lento',
  'zoom-out-lento': 'Zoom out lento',
  'pan-derecha': 'Paneo a la derecha',
  'pan-izquierda': 'Paneo a la izquierda',
  estatico: 'Estático',
};

const ROLE_LABELS: Record<Scene['rol'], string> = {
  hook: 'hook',
  problema: 'problema',
  desarrollo: 'desarrollo',
  prueba: 'prueba',
  cta: 'cta',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function seconds(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function StudioShell({
  projectId,
  projectName,
  assets,
  styleReferences,
  voiceMeta,
  activeJob,
  initialRenderUrl,
  plan: initialPlan,
  version,
  versionCount,
  updatedAt,
}: StudioShellProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<VideoPlan>(initialPlan);
  const [selectedId, setSelectedId] = useState<string>(initialPlan.escenas[0]?.id ?? '');
  const [save, setSave] = useState<SaveState>({ kind: 'clean' });
  const [baseline, setBaseline] = useState<string>(JSON.stringify(initialPlan));
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingVoice, setPendingVoice] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(activeJob?.id ?? null);
  const [jobProgress, setJobProgress] = useState<number>(activeJob?.progress ?? 0);
  const [renderUrl, setRenderUrl] = useState<string | null>(initialRenderUrl);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(initialRenderUrl !== null);
  const [styleRefs, setStyleRefs] = useState<readonly StudioStyleReference[]>(styleReferences);
  const [styleKind, setStyleKind] = useState<StyleKind>('producto');
  const [styleBusy, setStyleBusy] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  const selectedIndex = Math.max(
    0,
    plan.escenas.findIndex((scene) => scene.id === selectedId),
  );
  const selected = plan.escenas[selectedIndex] ?? plan.escenas[0];
  const total = plan.escenas.reduce((sum, scene) => sum + scene.duracionEstimadaS, 0);
  const elapsed = plan.escenas
    .slice(0, selectedIndex)
    .reduce((sum, scene) => sum + scene.duracionEstimadaS, 0);

  const issues: readonly PlanIssue[] = useMemo(() => {
    const validation = validateVideoPlan(plan);
    return validation.ok ? [] : validation.issues;
  }, [plan]);

  const sceneIssues = issues.filter((issue) => issue.sceneId === selected?.id);
  const globalIssues = issues.filter((issue) => issue.sceneId === undefined);
  const narrationIssues = sceneIssues.filter((issue) => issue.code === 'E_NARRATION_LENGTH');
  const textIssues = sceneIssues.filter((issue) => issue.code === 'E_TEXT_LINES');
  const otherIssues = sceneIssues.filter(
    (issue) => issue.code !== 'E_NARRATION_LENGTH' && issue.code !== 'E_TEXT_LINES',
  );
  const isDirty = JSON.stringify(plan) !== baseline && save.kind !== 'saved';

  // Cerrar la pestaña con cambios sin guardar avisa: el trabajo de texto no se
  // autoguarda (a diferencia de mover/duplicar/borrar).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
  const canSave = isDirty && issues.length === 0 && save.kind !== 'saving';

  function commit(next: VideoPlan) {
    setPlan(next);
    if (save.kind !== 'saving') setSave({ kind: 'dirty' });
  }

  function patchScene(patch: Partial<Scene>) {
    if (selected === undefined) return;
    commit({
      ...plan,
      escenas: plan.escenas.map((scene) =>
        scene.id === selected.id ? { ...scene, ...patch } : scene,
      ),
    });
  }

  function setLine(index: number, value: string) {
    if (selected === undefined) return;
    const lines = selected.textoPantalla.map((line, i) => (i === index ? value : line));
    patchScene({ textoPantalla: lines });
  }

  function addLine() {
    if (selected === undefined || selected.textoPantalla.length >= LIMITS.maxLineas) return;
    patchScene({ textoPantalla: [...selected.textoPantalla, ''] });
  }

  function removeLine(index: number) {
    if (selected === undefined || selected.textoPantalla.length <= 1) return;
    patchScene({ textoPantalla: selected.textoPantalla.filter((_, i) => i !== index) });
  }

  async function saveVersion(nextPlan: VideoPlan = plan) {
    setSave({ kind: 'saving' });
    try {
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: nextPlan, source: 'edited' }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        project?: { versions?: readonly unknown[] };
        code?: string;
        detail?: { issues?: readonly string[] };
      };
      if (!response.ok) {
        setSave({
          kind: 'error',
          message: payload.detail?.issues?.join(' · ') ?? payload.code ?? 'No se pudo guardar',
        });
        return;
      }
      const nextVersion = payload.project?.versions?.length ?? versionCount + 1;
      setBaseline(JSON.stringify(nextPlan));
      setSave({ kind: 'saved', version: nextVersion });
      router.refresh();
    } catch {
      setSave({ kind: 'error', message: 'Sin conexión con el servidor' });
    }
  }

  const cost = estimateCost(plan, PRICES);
  const characters = plan.escenas.reduce((sum, scene) => sum + scene.narracion.length, 0);
  const sceneCharacters = selected === undefined ? 0 : selected.narracion.length;
  const sceneImageCost = PRICES.imagePerUnit;
  const sceneVoiceCost = (sceneCharacters / 1000) * PRICES.speechPer1kChars;

  const totalReal = totalDuration(plan);
  const durationIssue = globalIssues.find((issue) => issue.code === 'E_DURATION_SUM');

  /**
   * Mover, duplicar o borrar escenas cambia el plan de golpe: se guarda solo,
   * sin esperar al botón. Escribir texto sigue siendo explícito para no llenar
   * el historial de versiones por cada pausa al teclear.
   */
  function applyStructural(next: VideoPlan | null, imposible: string) {
    if (next === null) {
      setAssetError(imposible);
      return;
    }
    setAssetError(null);
    setPlan(next);
    const sigueExistiendo = next.escenas.some((scene) => scene.id === selectedId);
    if (!sigueExistiendo) setSelectedId(next.escenas[0]?.id ?? '');

    // Si la operación dejó el plan inválido (p. ej. duplicar descuadra la suma de
    // duraciones), no se guarda: el servidor lo rechazaría y el usuario vería un
    // error sin saber qué hacer. Se queda como cambio local, con el aviso y su botón.
    const validation = validateVideoPlan(next);
    if (!validation.ok) {
      setSave({ kind: 'dirty' });
      return;
    }
    void saveVersion(next);
  }

  function move(delta: number) {
    applyStructural(
      moveScene(plan, selectedIndex, selectedIndex + delta),
      'No se pudo mover la escena.',
    );
  }

  function duplicate() {
    if (selected === undefined) return;
    applyStructural(
      duplicateScene(plan, selected.id),
      `El plan ya tiene el máximo de ${LIMITS.maxEscenas} escenas.`,
    );
  }

  function remove() {
    if (selected === undefined) return;
    applyStructural(
      removeScene(plan, selected.id),
      `El plan necesita al menos ${LIMITS.minEscenas} escenas.`,
    );
  }

  const scenesMissingAssets = plan.escenas
    .filter((scene) => {
      const image = assets.find((a) => a.sceneId === scene.id && a.kind === 'image');
      const voice = assets.find((a) => a.sceneId === scene.id && a.kind === 'voice');
      return image?.status !== 'ready' || voice?.status !== 'ready';
    })
    .map((scene) => scene.id);
  const assetsReady = scenesMissingAssets.length === 0;
  const rendering = jobId !== null;
  const elapsedRender = useElapsed(rendering);

  async function renderVideo() {
    setRenderError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        jobId?: string;
        code?: string;
        message?: string;
        scenes?: readonly string[];
      };
      if (!response.ok || payload.jobId === undefined) {
        setRenderError(
          payload.code === 'ASSETS_MISSING'
            ? `Faltan imagen o voz en: ${(payload.scenes ?? []).join(', ')}.`
            : (payload.message ?? payload.code ?? 'No se pudo encolar el render'),
        );
        return;
      }
      setJobProgress(0);
      setJobId(payload.jobId);
    } catch {
      setRenderError('Sin conexión con el servidor');
    }
  }

  // Sondeo del trabajo: el render corre en su propio proceso, así que la página
  // puede cerrarse y volver a preguntar sin perder nada.
  useEffect(() => {
    if (jobId === null) return;
    let cancelled = false;

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) return;
        const job = (await response.json()) as {
          status: 'running' | 'done' | 'error';
          progress: number;
          url: string | null;
          message: string | null;
        };
        if (cancelled) return;
        setJobProgress(job.progress);
        if (job.status === 'done' && job.url !== null) {
          setRenderUrl(job.url);
          setShowVideo(true);
          setJobId(null);
        } else if (job.status === 'error') {
          setRenderError(job.message ?? 'El render falló');
          setJobId(null);
        }
      } catch {
        /* un fallo de red puntual no cancela el trabajo: se reintenta al siguiente tick */
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId]);

  function assetOf(sceneId: string | undefined, kind: StudioAsset['kind']): StudioAsset | undefined {
    if (sceneId === undefined) return undefined;
    return assets.find((asset) => asset.sceneId === sceneId && asset.kind === kind);
  }

  async function generate(kind: 'image' | 'voice'): Promise<void> {
    if (selected === undefined) return;
    setAssetError(null);
    if (kind === 'image') setPendingImage(selected.id);
    else setPendingVoice(selected.id);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/scenes/${selected.id}/${kind}`,
        { method: 'POST' },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        setAssetError(
          payload.code === 'KEY_REQUIRED'
            ? 'Falta la API key del proveedor. Se configura en Ajustes.'
            : (payload.message ?? payload.code ?? 'No se pudo generar el asset'),
        );
        return;
      }
      router.refresh();
    } catch {
      setAssetError('Sin conexión con el servidor');
    } finally {
      if (kind === 'image') setPendingImage(null);
      else setPendingVoice(null);
    }
  }

  /**
   * Tablero de estilo: se sube una pieza (producto, personaje, logo) y queda en el
   * proyecto. No cuesta nada: no llama a ningún proveedor, solo guarda el archivo.
   */
  async function addStylePiece(file: File): Promise<void> {
    setStyleBusy(true);
    setStyleError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', styleKind);
      body.append('label', file.name.replace(/\.[^.]+$/, ''));
      const response = await fetch(`/api/projects/${projectId}/style`, { method: 'POST', body });
      const payload = (await response.json().catch(() => ({}))) as {
        reference?: StudioStyleReference;
        code?: string;
      };
      if (!response.ok || payload.reference === undefined) {
        setStyleError(
          payload.code === 'STYLE_LIMIT'
            ? `El tablero admite ${MAX_STYLE_REFERENCES} referencias.`
            : payload.code === 'FILE_TOO_LARGE'
              ? 'La imagen pasa de 8 MB.'
              : payload.code === 'UNSUPPORTED_TYPE'
                ? 'Solo PNG, JPEG o WebP.'
                : 'No se pudo subir la referencia.',
        );
        return;
      }
      const added = payload.reference;
      setStyleRefs((current) => [...current, added]);
      router.refresh();
    } catch {
      setStyleError('Sin conexión con el servidor');
    } finally {
      setStyleBusy(false);
    }
  }

  async function removeStylePiece(referenceId: string): Promise<void> {
    setStyleBusy(true);
    setStyleError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/style/${referenceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setStyleError('No se pudo quitar la referencia.');
        return;
      }
      setStyleRefs((current) => current.filter((reference) => reference.id !== referenceId));
      router.refresh();
    } catch {
      setStyleError('Sin conexión con el servidor');
    } finally {
      setStyleBusy(false);
    }
  }

  const imageAsset = assetOf(selected?.id, 'image');
  const voiceAsset = assetOf(selected?.id, 'voice');
  const imageUrl = imageAsset?.status === 'ready' ? imageAsset.url : null;
  const voiceUrl = voiceAsset?.status === 'ready' ? voiceAsset.url : null;
  const elapsedImage = useElapsed(pendingImage !== null);
  const elapsedVoice = useElapsed(pendingVoice !== null);

  function assetStatusLabel(asset: StudioAsset | undefined, pending: boolean): string {
    if (pending) return 'generando';
    if (asset === undefined) return 'sin generar';
    if (asset.status === 'ready') return 'lista';
    if (asset.status === 'error') return 'error';
    if (asset.status === 'running') return 'en curso';
    return 'sin generar';
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target !== null &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (canSave) void saveVersion();
        return;
      }
      if (typing) return;

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = plan.escenas[Math.min(Math.max(selectedIndex + delta, 0), plan.escenas.length - 1)];
        if (next !== undefined) setSelectedId(next.id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSave, plan, selectedIndex]);

  const narrationWords = selected === undefined ? 0 : countWords(selected.narracion);
  const narrationBad = narrationWords < LIMITS.minPalabrasNarracion || narrationWords > LIMITS.maxPalabrasNarracion;

  return (
    <div className="studio">
      <header className="studio-top">
        <Link href="/projects" className="wordmark">
          ESCEN<b>A</b>I
        </Link>
        <span className="top-divider" />
        <div className="top-project">
          <span className="name">{plan.titulo}</span>
          <span className="meta">
            v{version} · {plan.escenas.length} escenas · {seconds(total)} s ·{' '}
            {new Date(updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
          </span>
        </div>
        <span className="top-spacer" />
        <span className="pill">
          <span className={`dot ${isDirty ? 'warn' : ''}`} />
          {save.kind === 'saving'
            ? 'Guardando…'
            : save.kind === 'error'
              ? 'Error al guardar'
              : isDirty
                ? 'Sin guardar'
                : 'Guardado'}
        </span>
        <details className="cost">
          <summary className="pill">
            <span>≈ {usd(cost.total)}</span>
          </summary>
          <div className="cost-panel">
            <div className="cost-row">
              <span>
                Imágenes · {plan.escenas.length} × {usd(PRICES.imagePerUnit)}
              </span>
              <b>{usd(cost.images)}</b>
            </div>
            <div className="cost-row">
              <span>Voz · {characters.toLocaleString('es-CO')} caracteres</span>
              <b>{usd(cost.speech)}</b>
            </div>
            <div className="cost-row">
              <span>Render</span>
              <b>{usd(cost.video + cost.music)}</b>
            </div>
            <div className="cost-row cost-total">
              <span>Video completo estimado</span>
              <b>{usd(cost.total)}</b>
            </div>
            <p className="cost-note">
              {PRICE_NOTES.join(' · ')} · {PRICE_SNAPSHOT_LABEL}
            </p>
          </div>
        </details>
        <span className="pill">
          {versionCount} {versionCount === 1 ? 'versión' : 'versiones'}
        </span>
        <Link href="/new" className="btn ghost small">
          + Nuevo video
        </Link>
        <Link href={`/projects/${projectId}`} className="btn ghost">
          Versiones
        </Link>
        {canSave && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => void saveVersion()}
            title="Guardar versión (⌘S)"
          >
            Guardar versión
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => void renderVideo()}
          disabled={!assetsReady || rendering}
          title={
            assetsReady
              ? 'Renderiza el MP4 con las imágenes y voces guardadas'
              : `Faltan imagen o voz en: ${scenesMissingAssets.join(', ')}`
          }
        >
          {rendering
            ? `Renderizando… ${Math.round(jobProgress * 100)} %`
            : renderUrl !== null
              ? 'Renderizar otra vez'
              : 'Renderizar video'}
        </button>
      </header>

      {/* Siempre presente: la rejilla del estudio tiene una fila para esta barra. */}
      <div className={`render-bar ${rendering ? 'on' : ''}`} aria-label="Progreso del render">
        <span style={{ width: `${Math.max(3, Math.round(jobProgress * 100))}%` }} />
        <em>
          {rendering
            ? `render ${Math.round(jobProgress * 100)} % · ${elapsedRender}s · puedes seguir editando`
            : ''}
        </em>
      </div>

      <div className="studio-body">
        <aside className="rail" aria-label="Escenas">
          <div className="rail-head">
            <span className="kicker">Escenas</span>
            <span className="count">
              01–{pad(plan.escenas.length)} · {seconds(total)} s
            </span>
          </div>
          <div className="rail-list">
            {plan.escenas.map((scene, index) => (
              <button
                key={scene.id}
                type="button"
                className="scene-item"
                aria-current={scene.id === selected?.id}
                onClick={() => setSelectedId(scene.id)}
              >
                {(() => {
                  const thumb = assets.find(
                    (asset) =>
                      asset.sceneId === scene.id && asset.kind === 'image' && asset.status === 'ready',
                  );
                  return thumb?.url ? (
                    <img className="scene-thumb" src={thumb.url} alt="" />
                  ) : (
                    <span className="scene-thumb empty">{pad(index + 1)}</span>
                  );
                })()}
                <span className="scene-copy">
                  <span className="scene-line">
                    <span className="scene-role">{ROLE_LABELS[scene.rol]}</span>
                  </span>
                  <span className="scene-text">{scene.narracion}</span>
                </span>
                <span className="scene-time">{seconds(scene.duracionEstimadaS)} s</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="stage">
          <div className="stage-head">
            <span className="stage-label">Vista previa · en vivo</span>
            <span className="stage-spec">9:16 · 1080×1920 · 30 fps</span>
          </div>

          {showVideo && renderUrl !== null ? (
            <div className="slate has-image">
              <video className="slate-media" src={renderUrl} controls playsInline />
              <span className="slate-badge ready">render</span>
            </div>
          ) : (
            <div className="slate has-image">
              <div className="slate-player">
                <PreviewPlayer
                  plan={plan}
                  assets={assets}
                  voiceMeta={voiceMeta}
                  /* +200 ms: caer en el primer frame del corte lo muestra desenfocado. */
                  seekMs={elapsed * 1000 + 200}
                  seekToken={selectedIndex}
                />
              </div>
              <span className={`slate-badge ${assetsReady ? 'ready' : ''}`}>
                {assetsReady ? 'preview' : 'preview · faltan assets'}
              </span>
            </div>
          )}

          <div className="transport">
            <button
              type="button"
              className="transport-btn"
              aria-label="Escena anterior"
              onClick={() => setSelectedId(plan.escenas[Math.max(0, selectedIndex - 1)]?.id ?? selectedId)}
              disabled={selectedIndex === 0}
            >
              ◀
            </button>
            <span className="timecode">
              <b>
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
                {String(Math.floor(elapsed % 60)).padStart(2, '0')}.
                {Math.floor((elapsed % 1) * 10)}
              </b>{' '}
              / {seconds(total)} s
            </span>
            <button
              type="button"
              className="transport-btn"
              aria-label="Escena siguiente"
              onClick={() =>
                setSelectedId(
                  plan.escenas[Math.min(plan.escenas.length - 1, selectedIndex + 1)]?.id ?? selectedId,
                )
              }
              disabled={selectedIndex === plan.escenas.length - 1}
            >
              ▶
            </button>
            <span className="stage-spec">
              {voiceUrl !== null ? 'voz de esta escena lista' : 'sin voz todavía'}
            </span>
            {renderUrl !== null && (
              <button
                type="button"
                className="asset-btn"
                onClick={() => setShowVideo((current) => !current)}
              >
                {showVideo ? 'Ver storyboard' : 'Ver video'}
              </button>
            )}
          </div>

          {renderError !== null && <p className="issue">{renderError}</p>}
        </main>

        <aside className="inspector" aria-label="Inspector de escena">
          <div className="inspector-head">
            <span className="idx">ESCENA {pad(selectedIndex + 1)}</span>
            {selected !== undefined && <span className="role-tag">{ROLE_LABELS[selected.rol]}</span>}
            <span className="dur">
              {selected === undefined ? '—' : `${seconds(selected.duracionEstimadaS)} s`}
            </span>
          </div>

          <div className="inspector-body">
            <div className="scene-actions">
              <button
                type="button"
                className="asset-btn"
                onClick={() => move(-1)}
                disabled={selectedIndex === 0}
              >
                ↑ Subir
              </button>
              <button
                type="button"
                className="asset-btn"
                onClick={() => move(1)}
                disabled={selectedIndex >= plan.escenas.length - 1}
              >
                ↓ Bajar
              </button>
              <button
                type="button"
                className="asset-btn"
                onClick={duplicate}
                disabled={plan.escenas.length >= LIMITS.maxEscenas}
              >
                Duplicar
              </button>
              <button
                type="button"
                className="asset-btn"
                onClick={remove}
                disabled={plan.escenas.length <= LIMITS.minEscenas}
              >
                Eliminar
              </button>
            </div>

            {durationIssue !== undefined && (
              <div>
                <p className="issue">{durationIssue.message}</p>
                <button
                  type="button"
                  className="asset-btn"
                  style={{ marginTop: 6 }}
                  onClick={() => {
                    const next = withTarget(plan, totalReal);
                    setPlan(next);
                    if (validateVideoPlan(next).ok) void saveVersion(next);
                    else setSave({ kind: 'dirty' });
                  }}
                >
                  Ajustar objetivo a {seconds(totalReal)} s
                </button>
              </div>
            )}

            <div className="field">
              <label htmlFor="narracion">
                Narración
                <span className={`hint ${narrationBad ? 'bad' : 'good'}`}>
                  {narrationWords} / {LIMITS.minPalabrasNarracion}–{LIMITS.maxPalabrasNarracion} palabras
                </span>
              </label>
              <textarea
                id="narracion"
                className={`textarea ${narrationBad ? 'bad' : ''}`}
                value={selected?.narracion ?? ''}
                rows={4}
                onChange={(event) => patchScene({ narracion: event.target.value })}
              />
              {narrationIssues.map((issue, index) => (
                <p className="issue" key={`${issue.code}-${index}`}>
                  {issue.message}
                </p>
              ))}
            </div>

            <div className="field">
              <span className="field-label">
                Texto en pantalla
                <span className="hint">
                  máx {LIMITS.maxLineas} líneas · {LIMITS.maxPalabrasPorLinea} palabras
                </span>
              </span>
              <div className="chips">
                {(selected?.textoPantalla ?? []).map((line, index) => (
                  <span key={index} style={{ display: 'inline-flex', gap: 4 }}>
                    <input
                      className="chip-input"
                      value={line}
                      onChange={(event) => setLine(index, event.target.value)}
                      aria-label={`Línea ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="chip-add"
                      onClick={() => removeLine(index)}
                      disabled={selected !== undefined && selected.textoPantalla.length <= 1}
                      aria-label={`Quitar línea ${index + 1}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="chip-add"
                  onClick={addLine}
                  disabled={selected !== undefined && selected.textoPantalla.length >= LIMITS.maxLineas}
                >
                  + línea
                </button>
              </div>
              {textIssues.map((issue, index) => (
                <p className="issue" key={`${issue.code}-${index}`}>
                  {issue.message}
                </p>
              ))}
            </div>

            <div className="field">
              <label htmlFor="movimiento">Movimiento</label>
              <select
                id="movimiento"
                className="select"
                value={selected?.movimiento ?? 'zoom-in-lento'}
                onChange={(event) => patchScene({ movimiento: event.target.value as Motion })}
              >
                {MOTIONS.map((motion) => (
                  <option key={motion} value={motion}>
                    {MOTION_LABELS[motion]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <span className="field-label">
                Imagen
                <span className={`hint ${imageAsset?.status === 'error' ? 'bad' : ''}`}>
                  {assetStatusLabel(imageAsset, pendingImage !== null)}
                </span>
              </span>
              <div className="asset-block">
                <span
                  className={`asset-dot ${
                    pendingImage !== null
                      ? 'running'
                      : imageAsset?.status === 'error'
                        ? 'error'
                        : imageAsset?.status === 'ready'
                          ? 'ready'
                          : ''
                  }`}
                />
                <div className="asset-copy">
                  <span className="asset-name">
                    {imageUrl !== null ? 'Lista' : 'Sin imagen'}
                    {imageUrl !== null && (
                      <a href={imageUrl} target="_blank" rel="noreferrer" className="asset-link">
                        abrir
                      </a>
                    )}
                  </span>
                  <span className={`asset-detail ${imageAsset?.status === 'error' ? 'error' : ''}`}>
                    {pendingImage !== null
                      ? `generando · ${elapsedImage}s`
                      : imageAsset?.status === 'error'
                        ? (imageAsset.errorCode ?? 'error del proveedor')
                        : `vertex nano-banana · 9:16 · ${usd(sceneImageCost)}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="asset-btn"
                  onClick={() => void generate('image')}
                  disabled={pendingImage !== null || pendingVoice !== null}
                >
                  {pendingImage !== null
                    ? 'Generando…'
                    : imageUrl !== null
                      ? 'Regenerar'
                      : 'Generar'}
                </button>
              </div>
            </div>

            <div className="field">
              <span className="field-label">
                Voz
                <span className={`hint ${voiceAsset?.status === 'error' ? 'bad' : ''}`}>
                  {assetStatusLabel(voiceAsset, pendingVoice !== null)}
                </span>
              </span>
              <div className="asset-block">
                <span
                  className={`asset-dot ${
                    pendingVoice !== null
                      ? 'running'
                      : voiceAsset?.status === 'error'
                        ? 'error'
                        : voiceAsset?.status === 'ready'
                          ? 'ready'
                          : ''
                  }`}
                />
                <div className="asset-copy">
                  <span className="asset-name">
                    {voiceUrl !== null ? 'Lista' : 'Sin voz'}
                  </span>
                  <span className={`asset-detail ${voiceAsset?.status === 'error' ? 'error' : ''}`}>
                    {pendingVoice !== null
                      ? `generando · ${elapsedVoice}s`
                      : voiceAsset?.status === 'error'
                        ? (voiceAsset.errorCode ?? 'error del proveedor')
                        : `minimax · ${sceneCharacters} caracteres · ${usd(sceneVoiceCost)}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="asset-btn"
                  onClick={() => void generate('voice')}
                  disabled={pendingImage !== null || pendingVoice !== null}
                >
                  {pendingVoice !== null ? 'Generando…' : voiceUrl !== null ? 'Regenerar' : 'Generar'}
                </button>
              </div>
              {voiceUrl !== null && <audio className="asset-audio" controls src={voiceUrl} />}
            </div>

            {assetError !== null && <p className="issue">{assetError}</p>}

            {otherIssues.length > 0 && (
              <div>
                {otherIssues.map((issue, index) => (
                  <p className="issue" key={`${issue.code}-${index}`}>
                    {issue.message}
                  </p>
                ))}
              </div>
            )}

            <div className="field">
              <span className="field-label">
                Referencias
                <span className="hint">
                  {styleRefs.length} / {MAX_STYLE_REFERENCES} · todas las escenas
                </span>
              </span>

              {styleRefs.length > 0 && (
                <div className="style-grid">
                  {styleRefs.map((reference) => (
                    <figure className="style-item" key={reference.id}>
                      <img className="style-thumb" src={reference.url} alt={reference.label} />
                      <figcaption className="style-caption">
                        <span className="style-kind">{STYLE_KIND_LABELS[reference.kind]}</span>
                        <span className="style-label" title={reference.label}>
                          {reference.label}
                        </span>
                      </figcaption>
                      <button
                        type="button"
                        className="style-remove"
                        onClick={() => void removeStylePiece(reference.id)}
                        disabled={styleBusy}
                        aria-label={`Quitar ${reference.label}`}
                      >
                        ×
                      </button>
                    </figure>
                  ))}
                </div>
              )}

              <div className="style-actions">
                <select
                  className="select"
                  value={styleKind}
                  onChange={(event) => setStyleKind(event.target.value as StyleKind)}
                  aria-label="Tipo de referencia"
                  disabled={styleBusy}
                >
                  {STYLE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {STYLE_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
                {styleBusy || styleRefs.length >= MAX_STYLE_REFERENCES ? (
                  <span className="asset-btn disabled">
                    {styleBusy ? 'Subiendo…' : 'Límite alcanzado'}
                  </span>
                ) : (
                  <>
                    <label htmlFor="style-file" className="asset-btn style-add">
                      + Añadir imagen
                    </label>
                    <input
                      id="style-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        // Se limpia para que volver a elegir el mismo archivo dispare el cambio.
                        event.target.value = '';
                        if (file !== undefined) void addStylePiece(file);
                      }}
                    />
                  </>
                )}
              </div>

              <p className="readonly-note style-note">
                Viajan como referencia en cada escena: el producto, el personaje o el logo no se
                rediseñan. La primera manda el estilo.
              </p>
              {styleError !== null && <p className="issue">{styleError}</p>}
            </div>

            <div className="field">
              <span className="field-label">
                Subtítulos
                <span className="hint">todo el video</span>
              </span>
              <div className="chips">
                {CAPTION_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`asset-btn ${(plan.captionStyle ?? 'caja') === style ? 'on' : ''}`}
                    aria-pressed={(plan.captionStyle ?? 'caja') === style}
                    onClick={() => commit({ ...plan, captionStyle: style })}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">
                Música
                <span className="hint">todo el video · CC0</span>
              </span>
              <div className="chips">
                {MUSIC_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`asset-btn ${(plan.musicTrack ?? 'ninguna') === option.id ? 'on' : ''}`}
                    aria-pressed={(plan.musicTrack ?? 'ninguna') === option.id}
                    title={option.hint}
                    onClick={() => commit({ ...plan, musicTrack: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Prompt de imagen</span>
              <details>
                <summary className="chip-add" style={{ display: 'inline-block' }}>
                  Ver prompt
                </summary>
                <p className="readonly-note" style={{ marginTop: 8 }}>
                  {selected?.promptImagen}
                </p>
              </details>
            </div>
          </div>

          <div className="inspector-foot">
            <span>
              {selectedIndex + 1} / {plan.escenas.length}
            </span>
            {save.kind === 'saved' ? (
              <span className="save-state saved">Versión {save.version} guardada</span>
            ) : save.kind === 'error' ? (
              <span className="save-state error">{save.message}</span>
            ) : isDirty ? (
              <span className="save-state dirty">Cambios sin guardar</span>
            ) : (
              <span className="save-state">Todo guardado</span>
            )}
          </div>
        </aside>
      </div>

      <section className="timeline" aria-label="Línea de tiempo">
        <div className="timeline-head">
          <span className="kicker">Timeline</span>
          <span className="stage-spec">
            duraciones estimadas · la duración real la fija la voz
          </span>
          <span className="spacer" />
          <span className="stage-spec">{projectName}</span>
        </div>

        <div className="track">
          <span className="track-label">Escenas</span>
          <div className="lane">
            {plan.escenas.map((scene, index) => (
              <button
                key={scene.id}
                type="button"
                className="tl-block"
                aria-current={scene.id === selected?.id}
                style={{ flex: scene.duracionEstimadaS }}
                onClick={() => setSelectedId(scene.id)}
                title={scene.narracion}
              >
                {pad(index + 1)} · {seconds(scene.duracionEstimadaS)}s
              </button>
            ))}
          </div>
        </div>

        <div className="track">
          <span className="track-label">Voz</span>
          <div className="lane">
            {plan.escenas.map((scene) => {
              const voice = assetOf(scene.id, 'voice');
              return voice?.status === 'ready' ? (
                <button
                  key={scene.id}
                  type="button"
                  className="tl-block voice"
                  style={{ flex: scene.duracionEstimadaS }}
                  onClick={() => setSelectedId(scene.id)}
                  title={scene.narracion}
                >
                  {pad(plan.escenas.indexOf(scene) + 1)} · voz
                </button>
              ) : (
                <div
                  key={scene.id}
                  className="tl-block empty"
                  style={{ flex: scene.duracionEstimadaS }}
                  title="Sin voz generada"
                >
                  {pad(plan.escenas.indexOf(scene) + 1)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="track">
          <span className="track-label">Música</span>
          <div className="lane">
            {plan.musicTrack === undefined || plan.musicTrack === 'ninguna' ? (
              <div className="tl-block empty" style={{ flex: 1 }}>
                sin música elegida
              </div>
            ) : (
              <div className="tl-block music" style={{ flex: 1 }}>
                {MUSIC_OPTIONS.find((option) => option.id === plan.musicTrack)?.label ??
                  plan.musicTrack}{' '}
                · CC0 · con ducking bajo la voz
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
