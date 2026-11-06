import { describe, expect, it } from 'vitest';
import { compactScript } from '../src/application/use-cases/compact-script';
import type { TextModelPort } from '../src/application/ports/text-model.port';
import type { VideoPlan } from '../src/domain/video-plan';

const plan: VideoPlan = {
  version: 1,
  locale: 'es',
  titulo: 'Cold brew',
  duracionObjetivoS: 40,
  styleToken: 'ilustración plana',
  escenas: [
    { id: 's1', rol: 'hook', narracion: 'Son las tres de la tarde y ya no puedes con la vida en la oficina.', textoPantalla: ['TRES PM'], promptImagen: 'oficina por la tarde con luz cálida y una lata', movimiento: 'zoom-in-lento', duracionEstimadaS: 8 },
    { id: 's2', rol: 'problema', narracion: 'El café de la máquina te deja más cansado que antes de tomarlo.', textoPantalla: ['CANSADO'], promptImagen: 'máquina expendedora en un pasillo con vaso humeando', movimiento: 'pan-derecha', duracionEstimadaS: 8 },
    { id: 's3', rol: 'desarrollo', narracion: 'Este cold brew tiene cero azúcar y el doble de cafeína que el normal.', textoPantalla: ['CERO AZÚCAR'], promptImagen: 'lata fría sobre mármol con gotas de condensación', movimiento: 'zoom-out-lento', duracionEstimadaS: 8 },
    { id: 's4', rol: 'prueba', narracion: 'Se toma en dos minutos y te despierta sin ese bajón de las cuatro.', textoPantalla: ['SIN BAJÓN'], promptImagen: 'persona caminando con la lata en la mano al atardecer', movimiento: 'pan-izquierda', duracionEstimadaS: 8 },
    { id: 's5', rol: 'cta', narracion: 'Pide la tuya en el link de la bio y cuéntanos cómo te fue hoy.', textoPantalla: ['LINK BIO'], promptImagen: 'lata sobre fondo crema con sombra suave y centrada', movimiento: 'estatico', duracionEstimadaS: 8 },
  ],
};

function shortened(): unknown {
  const copy = JSON.parse(JSON.stringify(plan));
  copy.escenas.forEach((e: { narracion: string; textoPantalla: string[] }) => {
    e.narracion = e.narracion.split(' ').slice(0, 9).join(' ') + ' completa aqui.';
    e.textoPantalla = ['CORTO'];
  });
  copy.escenas.forEach((e: { duracionEstimadaS: number }) => { e.duracionEstimadaS = 8; });
  return copy;
}

describe('compactScript', () => {
  it('devuelve un plan válido y conserva ids, roles y prompts', async () => {
    const model: TextModelPort = { async generateJson() { return shortened(); } };
    const result = await compactScript({ text: model }, { plan, duracionObjetivoS: 40 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.escenas.map((e) => e.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
      expect(result.value.escenas[0]!.promptImagen).toBe(plan.escenas[0]!.promptImagen);
      expect(result.value.escenas[0]!.rol).toBe('hook');
    }
  });

  it('falla claro si el modelo devuelve algo inválido', async () => {
    const model: TextModelPort = { async generateJson() { return { escenas: [] }; } };
    const result = await compactScript({ text: model }, { plan, duracionObjetivoS: 40 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid_plan');
  });
});
