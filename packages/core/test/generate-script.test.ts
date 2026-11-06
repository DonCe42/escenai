import { describe, expect, it } from 'vitest';
import { generateScript } from '../src/application/use-cases/generate-script';
import type { TextModelPort } from '../src/application/ports/text-model.port';
import type { Brief, Project } from '../src/domain/project';

const brand: Project = {
  id: 'p1',
  nombre: 'Café Aurora',
  locale: 'es',
  styleToken: 'ilustración plana, paleta verde botella',
  colores: ['#0E3B2E', '#F2E8D5'],
};

const brief: Brief = {
  que: 'cold brew en lata sin azúcar',
  aQuien: 'oficinistas de 25 a 35 años',
  queDebeSentir: 'frescura',
  queDebeHacer: 'pedir en el link de la bio',
  duracionObjetivoS: 40,
};

const scene = (id: string, rol: string, texto: string, narracion: string) => ({
  id,
  rol,
  narracion,
  textoPantalla: [texto],
  promptImagen: 'escena ilustrada con lata de café sobre una mesa, luz cálida',
  movimiento: 'estatico',
  duracionEstimadaS: 8,
});

function validPlanJson(): unknown {
  return {
    version: 1,
    locale: 'es',
    titulo: 'Cold brew',
    duracionObjetivoS: 40,
    styleToken: 'lo que devuelva el modelo debe ser sobreescrito',
    escenas: [
      scene('s1', 'hook', 'TRES PM', 'Son las tres de la tarde y ya no puedes con la vida.'),
      scene('s2', 'problema', 'CANSADO', 'El café de la máquina te deja más cansado que antes de tomarlo.'),
      scene('s3', 'desarrollo', 'CERO AZÚCAR', 'Este cold brew tiene cero azúcar y el doble de cafeína que el normal.'),
      scene('s4', 'prueba', 'SIN BAJÓN', 'Se toma en dos minutos y te despierta sin ese bajón de las cuatro.'),
      scene('s5', 'cta', 'LINK BIO', 'Pide la tuya en el link de la bio y cuéntanos cómo te fue.'),
    ],
  };
}

class FakeTextModel implements TextModelPort {
  public calls = 0;
  constructor(private readonly responses: readonly unknown[]) {}
  async generateJson(): Promise<unknown> {
    const response = this.responses[Math.min(this.calls, this.responses.length - 1)];
    this.calls += 1;
    return response;
  }
}

describe('generateScript', () => {
  it('devuelve el plan validado y sobreescribe el styleToken del modelo', async () => {
    const model = new FakeTextModel([validPlanJson()]);
    const result = await generateScript({ text: model }, { brand, brief, locale: 'es' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.styleToken).toBe(brand.styleToken);
      expect(result.value.escenas).toHaveLength(5);
    }
    expect(model.calls).toBe(1);
  });

  it('reintenta con el feedback del validador y termina aceptando', async () => {
    const broken = validPlanJson() as { escenas: { rol: string }[] };
    broken.escenas[0]!.rol = 'problema';
    const model = new FakeTextModel([broken, validPlanJson()]);

    const result = await generateScript({ text: model }, { brand, brief, locale: 'es' });
    expect(result.ok).toBe(true);
    expect(model.calls).toBe(2);
  });

  it('se rinde tras 3 intentos y devuelve los problemas', async () => {
    const broken = validPlanJson() as { escenas: { rol: string }[] };
    broken.escenas[0]!.rol = 'problema';
    const model = new FakeTextModel([broken]);

    const result = await generateScript({ text: model }, { brand, brief, locale: 'es' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_plan');
      expect(result.error.attempts).toBe(3);
      if (result.error.kind === 'invalid_plan') {
        expect(result.error.issues.map((i) => i.code)).toContain('E_HOOK');
      }
    }
    expect(model.calls).toBe(3);
  });

  it('convierte un fallo del proveedor en model_error sin reintentar', async () => {
    const model: TextModelPort = {
      async generateJson() {
        throw new Error('429 rate limit');
      },
    };
    const result = await generateScript({ text: model }, { brand, brief, locale: 'es' });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'model_error') {
      expect(result.error.message).toContain('429');
      expect(result.error.attempts).toBe(1);
    }
  });
});
