import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { apiUrl } from '../../api/api.routes';

export type ConnectionState = 'online' | 'offline';

// Estados que significan "no llegué al backend" y no "el backend dijo que no": sin red, túnel o
// VPN caídos (0) y un intermediario que no encuentra la API (502, 503, 504).
const UNREACHABLE = new Set([0, 502, 503, 504]);

export function isConnectionError(error: unknown): boolean {
  if (error instanceof HttpErrorResponse) return UNREACHABLE.has(error.status);
  // El SDK de Auth0 falla con su propio error al renovar el token sin red.
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// Disponibilidad: cuando una llamada al backend no llega, se marca la conexión como caída y se
// sondea /actuator/health con espera creciente (1, 2, 4… hasta 10 s) hasta que vuelve. Al volver,
// `reconnections` sube y las pantallas que quedaron en error se recargan solas (ver app-error).
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<ConnectionState>('online');
  /** Cuántas veces se recuperó la conexión desde que abrió la app. */
  readonly reconnections = signal(0);

  private probeTimer: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    const offline = () => this.reportFailure();
    const online = () => this.probeNow();
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      clearTimeout(this.probeTimer);
    });
  }

  reportFailure(): void {
    if (this.state() === 'offline') return;
    this.state.set('offline');
    this.attempt = 0;
    this.scheduleProbe();
  }

  reportSuccess(): void {
    if (this.state() === 'online') return;
    clearTimeout(this.probeTimer);
    this.probeTimer = undefined;
    this.state.set('online');
    this.reconnections.update((n) => n + 1);
  }

  /** Botón "Reintentar ahora" del aviso y evento `online` del navegador. */
  probeNow(): void {
    if (this.state() === 'online') return;
    clearTimeout(this.probeTimer);
    this.attempt = 0;
    void this.probe();
  }

  private scheduleProbe(): void {
    const delay = Math.min(1000 * 2 ** this.attempt, 10000);
    this.attempt++;
    this.probeTimer = setTimeout(() => void this.probe(), delay);
  }

  // fetch directo: no pasa por los interceptores, así no pide token ni cuenta como llamada de la app.
  private async probe(): Promise<void> {
    try {
      const response = await fetch(apiUrl('/actuator/health'), { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        this.reportSuccess();
        return;
      }
    } catch {
      // Sigue caída.
    }
    if (this.state() === 'offline') this.scheduleProbe();
  }
}
