import { Composition } from 'remotion';
import {
  EscenaiVideo,
  MUSIC_BASE_VOLUME,
  formatSpec,
  normalizeVideoProps,
  type VideoProps,
} from '@escenai/composition';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

const defaultProps: VideoProps = {
  titulo: 'Escenai',
  formato: '9:16',
  colorFondo: '#0b0d10',
  colorTexto: '#f5f7fa',
  colorAcento: '#6ee7a8',
  scenes: [],
  // R4: defaults del diseño de sonido y del corte.
  transition: 'flash',
  soundDesign: true,
  // musicSrc queda sin definir a propósito: todavía no hay pista (TODO R6).
  musicVolume: MUSIC_BASE_VOLUME,
};

export function RemotionRoot() {
  return (
    <Composition
      id="Escenai"
      component={EscenaiVideo}
      durationInFrames={FPS * 10}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={defaultProps}
      // La duración real se calcula con los props en tiempo de render y sigue
      // siendo la suma de las escenas: las transiciones no tocan el timeline.
      calculateMetadata={({ props }) => {
        const typed = normalizeVideoProps(props as VideoProps);
        const scenes = typed.scenes ?? [];
        const totalMs = scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
        const spec = formatSpec(typed.formato ?? '9:16');
        return {
          durationInFrames: Math.max(1, Math.round((totalMs / 1000) * FPS)),
          width: spec.width,
          height: spec.height,
          props: typed,
        };
      }}
    />
  );
}
