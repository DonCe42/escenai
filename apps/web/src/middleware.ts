import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Puerta de entrada para una demo pública.
 *
 * Sin login todavía, cualquiera que entre podría generar imágenes con las keys
 * guardadas en el servidor y consumir cuota ajena. Con DEMO_PASSWORD definida,
 * todo exige usuario y contraseña; sin ella, la app queda abierta (uso local).
 */
export function middleware(request: NextRequest) {
  const password = process.env.DEMO_PASSWORD;
  if (password === undefined || password.length === 0) return NextResponse.next();

  const header = request.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');
    const provided = separator >= 0 ? decoded.slice(separator + 1) : '';

    // Comparación en tiempo constante: la longitud se filtra, el contenido no.
    if (provided.length === password.length) {
      let diff = 0;
      for (let index = 0; index < password.length; index += 1) {
        diff |= password.charCodeAt(index) ^ provided.charCodeAt(index);
      }
      if (diff === 0) return NextResponse.next();
    }
  }

  return new NextResponse('Autenticación requerida', {
    status: 401,
    headers: { 'www-authenticate': 'Basic realm="Escenai", charset="UTF-8"' },
  });
}

export const config = {
  // La salud del contenedor no puede pedir contraseña.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
