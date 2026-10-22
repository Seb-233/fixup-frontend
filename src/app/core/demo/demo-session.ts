import { HttpBackend, HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role } from '../auth/auth.types';

export interface DemoAccount {
  role: Role;
  subject: string;
  name: string;
  /** Qué ve esta cuenta al entrar, en una línea. */
  summary: string;
}

// Las cinco cuentas protagonistas de los datos de demostración (DemoDataSeedRunner del backend).
// El subject debe coincidir con el que el backend usa para sembrar sus datos.
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    role: 'OWNER',
    subject: 'auth0|demo-owner',
    name: 'Carolina Restrepo Arango',
    summary: 'Propietaria con apartamentos en Medellín y Bogotá, solicitudes y pagos.'
  },
  {
    role: 'TENANT',
    subject: 'auth0|demo-tenant',
    name: 'Andrés Moreno Rincón',
    summary: 'Arrendatario con contrato vigente que reporta daños de su apartamento.'
  },
  {
    role: 'FIXER',
    subject: 'auth0|demo-fixer',
    name: 'Jhon Fredy Cárdenas Ospina',
    summary: 'Técnico verificado con cotizaciones, trabajos, agenda e ingresos.'
  },
  {
    role: 'REAL_ESTATE_MANAGER',
    subject: 'auth0|demo-real_estate_manager',
    name: 'Inmobiliaria Cordillera',
    summary: 'Administra inmuebles delegados y el tablero de mantenimiento.'
  },
  {
    role: 'PLATFORM_ADMIN',
    subject: 'auth0|demo-platform_admin',
    name: 'Soporte Fix&Rent',
    summary: 'Revisa técnicos, vigila el plazo de las solicitudes y carga inmuebles.'
  }
];

export interface DemoSessionState {
  token: string;
  subject: string;
  name: string;
  role: Role;
  expiresAt: number;
}

const STORAGE_KEY = 'fixrent.demo-session';

function read(): DemoSessionState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as DemoSessionState;
    return state.expiresAt > Date.now() ? state : null;
  } catch {
    return null;
  }
}

/**
 * Sesión de demostración contra un backend local con el perfil `demo`. Reemplaza a Auth0 solo cuando
 * environment.demoLogin está activo: pide un token firmado por el propio backend (GET /demo/token) y
 * lo guarda en sessionStorage, así que se pierde al cerrar la pestaña. En producción esta clase
 * nunca se activa porque el endpoint no existe fuera del perfil demo.
 */
@Injectable({ providedIn: 'root' })
export class DemoSession {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly state = signal<DemoSessionState | null>(environment.demoLogin ? read() : null);

  readonly current = this.state.asReadonly();
  readonly enabled = environment.demoLogin;

  get token(): string | null {
    const state = this.state();
    if (state && state.expiresAt <= Date.now()) {
      this.end();
      return null;
    }
    return state?.token ?? null;
  }

  start(account: DemoAccount): Observable<DemoSessionState> {
    const params = new HttpParams()
      .set('sub', account.subject)
      .set('name', account.name)
      .set('role', account.role)
      .set('ttlSeconds', '28800');
    return this.http
      .get<{ accessToken: string; ttlSeconds: number }>(`${environment.apiOrigin}/demo/token`, { params })
      .pipe(
        map((response) => ({
          token: response.accessToken,
          subject: account.subject,
          name: account.name,
          role: account.role,
          expiresAt: Date.now() + response.ttlSeconds * 1000
        })),
        tap((state) => {
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          } catch {
            // Sin almacenamiento (ventana privada estricta) la sesión dura hasta recargar.
          }
          this.state.set(state);
        })
      );
  }

  end(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nada que limpiar.
    }
    this.state.set(null);
  }
}
