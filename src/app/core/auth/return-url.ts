/**
 * Ruta interna a la que se vuelve después de ingresar. Solo se acepta una ruta de esta aplicación:
 * empieza por "/" y no puede convertirse en otro origen ("//evil.example", "/\\evil.example"), no lleva
 * espacios ni caracteres de control, no es una pantalla de ingreso (evita bucles) y tiene un largo
 * razonable. Lo demás vuelve como null y quien llama usa su destino por omisión.
 *
 * El query se conserva tal cual (por ejemplo, el ?id= con que Wompi devuelve al pagador); quien lo usa
 * lo valida por su cuenta.
 */
const MAX_LENGTH = 2048;

export function safeReturnUrl(candidate: string | null | undefined): string | null {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > MAX_LENGTH) return null;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (candidate.includes('\\') || /\s/.test(candidate) || hasControlCharacter(candidate)) return null;
  const path = candidate.split(/[?#]/, 1)[0];
  if (path === '/' || path === '/auth' || path.startsWith('/auth/')) return null;
  // Un segmento codificado no puede esconder "//" ni "\\" que el router luego decodifique.
  if (/%2f%2f|%5c/i.test(path)) return null;
  return candidate;
}

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
