import { Capacitor } from '@capacitor/core';

// FR-UC-21: única fuente de verdad sobre si la aplicación corre dentro del contenedor nativo.
// Se aísla en una función para poder sustituirla en pruebas sin simular todo Capacitor.
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
