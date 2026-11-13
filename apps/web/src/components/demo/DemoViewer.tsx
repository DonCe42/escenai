'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { CostBreakdown } from '@escenai/core';
import { LocaleSwitch } from '@/components/LocaleSwitch';
import type { DemoCopy, DemoPayload } from '@/lib/demo';
import { usd } from '@/lib/prices';

/** El render añade 400 ms de colchón por escena: el video real los lleva dentro. */
const PADDING_MS = 400;

function seconds(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/**
 * Vista del ejemplo en modo lectura.
 *
 * No hay edición ni llamadas al servidor: es el proyecto tal como salió, con el
 * MP4 real y el rail de escenas. Clic en una escena salta a su tramo del video.
 */
export function DemoViewer({
  payload,
  copy,
  cost,
  locale,
}: {
  readonly payload: DemoPayload;
  readonly copy: DemoCopy;
  readonly cost: CostBreakdown;
  readonly locale: 'es' | 'en';
}) {
  const [selectedId, setSelectedId] = useState<string>(payload.scenes[0]?.id ?? '');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const starts: Record<string, number> = {};
  let cursor = 0;
  for (const scene of payload.scenes) {
    starts[scene.id] = cursor;
    cursor += scene.durationMs + PADDING_MS;
  }
  const totalMs = cursor;

  const index = Math.max(
    0,
    payload.plan.escenas.findIndex((scene) => scene.id === selectedId),
  );
  const selected = payload.plan.escenas[index];
  const selectedDuration = payload.scenes[index]?.durationMs ?? 0;

  function seekTo(sceneId: string): void {
    setSelectedId(sceneId);
    const video = videoRef.current;
    const start = starts[sceneId];
    if (video === null || start === undefined) return;
    // +200 ms: caer justo en el corte muestra el primer frame desenfocado.
    video.currentTime = start / 1000 + 0.2;
    void video.play().catch(() => undefined);
  }

  return (
    <div className="demo">
      <header className="studio-top demo-top">
        <Link href="/" className="wordmark">
          ESCEN<b>A</b>I
        </Link>
        <span className="top-divider" />
        <div className="top-project">
          <span className="name">{payload.plan.titulo}</span>
          <span className="meta">
            {copy.kicker} · {payload.plan.escenas.length} escenas · {seconds(totalMs / 1000)} s
          </span>
        </div>
        <span className="top-spacer" />
        <LocaleSwitch locale={locale} />
        <Link href="/new" className="btn">
          {copy.cta}
        </Link>
      </header>

      <div className="studio-body demo-body">
        <aside className="rail demo-rail" aria-label={copy.rail}>
          <div className="rail-head">
            <span className="kicker">{copy.rail}</span>
            <span className="count">01–0{payload.scenes.length}</span>
          </div>
          <div className="rail-list">
            {payload.plan.escenas.map((scene, sceneIndex) => (
              <button
                key={scene.id}
                type="button"
                className="scene-item"
                aria-current={scene.id === selectedId}
                onClick={() => seekTo(scene.id)}
              >
                <img className="scene-thumb" src={payload.scenes[sceneIndex]?.image} alt="" />
                <span className="scene-copy">
                  <span className="scene-line">
                    <span className="scene-role">{scene.rol}</span>
                  </span>
                  <span className="scene-text">{scene.narracion}</span>
                </span>
                <span className="scene-time">
                  {seconds((payload.scenes[sceneIndex]?.durationMs ?? 0) / 1000)} s
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="stage demo-stage">
          <div className="stage-head">
            <span className="stage-label">{copy.title}</span>
            <span className="stage-spec">9:16 · 540×960 · 30 fps</span>
          </div>
          <div className="slate has-image demo-slate">
            <video
              ref={videoRef}
              className="slate-media"
              src={payload.videoUrl}
              poster={payload.poster}
              controls
              playsInline
              preload="metadata"
            />
          </div>
          <p className="demo-intro">{copy.intro}</p>
        </main>

        <aside className="inspector demo-side" aria-label={copy.inspector}>
          <div className="inspector-head">
            <span className="idx">ESCENA 0{index + 1}</span>
            <span className="role-tag">{selected?.rol ?? ''}</span>
            <span className="dur">{seconds(selectedDuration / 1000)} s</span>
          </div>
          <div className="inspector-body">
            <div className="field">
              <span className="field-label">{copy.labels.narracion}</span>
              <p className="readonly-note">{selected?.narracion ?? ''}</p>
            </div>
            <div className="field">
              <span className="field-label">{copy.labels.texto}</span>
              <div className="chips">
                {(selected?.textoPantalla ?? []).map((line) => (
                  <span key={line} className="demo-chip">
                    {line}
                  </span>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label">{copy.labels.movimiento}</span>
              <p className="readonly-note">{selected?.movimiento ?? ''}</p>
            </div>
            <div className="field">
              <span className="field-label">
                {copy.labels.coste}
                <span className="hint">
                  {usd(cost.images / payload.plan.escenas.length)} + voz
                </span>
              </span>
              <p className="readonly-note">
                {copy.facts.cost}: {usd(cost.total)} · {copy.labels.real}
              </p>
            </div>
            <div className="field">
              <span className="field-label">{copy.inspector}</span>
              <ul className="demo-list">
                {copy.editable.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="inspector-foot">
            <span>0{index + 1} / 0{payload.plan.escenas.length}</span>
            <span className="save-state">{copy.kicker}</span>
          </div>
        </aside>
      </div>

      <section className="demo-facts">
        <div>
          <b>{seconds(totalMs / 1000)} s</b>
          <span>{copy.facts.duration}</span>
        </div>
        <div>
          <b>{payload.plan.escenas.length}</b>
          <span>{copy.facts.scenes}</span>
        </div>
        <div>
          <b>{usd(cost.total)}</b>
          <span>{copy.facts.cost}</span>
        </div>
        <div>
          <b>0</b>
          <span>{copy.facts.keys}</span>
        </div>
        <Link href="/new" className="btn demo-cta">
          {copy.cta}
        </Link>
      </section>
    </div>
  );
}
