import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../api/api.routes';

type Query = Record<string, string | number | boolean | null | undefined>;

function params(query?: Query): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== '') result = result.set(key, String(value));
  }
  return result;
}

// Envoltura mínima de HttpClient contra el backend de Fix&Rent. Los servicios de cada dominio la
// usan en lugar del cliente generado porque este nombra varias operaciones con sufijos numéricos
// (submit1, get2) que no dicen qué hacen; los tipos sí salen del cliente generado.
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string, query?: Query): Observable<T> {
    return this.http.get<T>(apiUrl(path), { params: params(query) });
  }

  getText(path: string, query?: Query): Observable<string> {
    return this.http.get(apiUrl(path), { params: params(query), responseType: 'text' });
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(apiUrl(path), body);
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(apiUrl(path), body);
  }

  patch<T>(path: string, body: unknown = {}): Observable<T> {
    return this.http.patch<T>(apiUrl(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(apiUrl(path));
  }
}
