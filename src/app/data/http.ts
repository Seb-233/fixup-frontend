import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../api/api.routes';

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?: Query;
  idempotencyKey?: string;
  responseType?: 'json' | 'text';
}

function params(query?: Query): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== '') result = result.set(key, String(value));
  }
  return result;
}

function buildHeaders(
  headers?: HttpHeaders | Record<string, string | string[]>,
  idempotencyKey?: string
): HttpHeaders {
  let result = headers instanceof HttpHeaders ? headers : new HttpHeaders(headers ?? {});
  if (idempotencyKey) {
    result = result.set('Idempotency-Key', idempotencyKey);
  }
  return result;
}

// Envoltura mínima de HttpClient contra el backend de Fix&Rent. Los servicios de cada dominio la
// usan en lugar del cliente generado porque este nombra varias operaciones con sufijos numéricos
// (submit1, get2) que no dicen qué hacen; los tipos sí salen del cliente generado.
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string, query?: Query, options?: { headers?: HttpHeaders | Record<string, string | string[]> }): Observable<T> {
    return this.http.get<T>(apiUrl(path), {
      params: params(query),
      headers: buildHeaders(options?.headers)
    });
  }

  getText(path: string, query?: Query, options?: { headers?: HttpHeaders | Record<string, string | string[]> }): Observable<string> {
    return this.http.get(apiUrl(path), {
      params: params(query),
      headers: buildHeaders(options?.headers),
      responseType: 'text'
    });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Observable<T> {
    const headers = buildHeaders(options?.headers, options?.idempotencyKey);
    const payload = body === undefined ? null : body;
    if (options?.responseType === 'text') {
      return this.http.post(apiUrl(path), payload, {
        headers,
        params: params(options?.params),
        responseType: 'text'
      }) as unknown as Observable<T>;
    }
    return this.http.post<T>(apiUrl(path), payload, {
      headers,
      params: params(options?.params)
    });
  }

  postText(path: string, body?: unknown, options?: RequestOptions): Observable<string> {
    return this.post<string>(path, body, { ...options, responseType: 'text' });
  }

  put<T>(path: string, body: unknown, options?: RequestOptions): Observable<T> {
    const headers = buildHeaders(options?.headers, options?.idempotencyKey);
    return this.http.put<T>(apiUrl(path), body, {
      headers,
      params: params(options?.params)
    });
  }

  patch<T>(path: string, body: unknown = {}, options?: RequestOptions): Observable<T> {
    const headers = buildHeaders(options?.headers, options?.idempotencyKey);
    return this.http.patch<T>(apiUrl(path), body, {
      headers,
      params: params(options?.params)
    });
  }

  delete<T>(path: string, options?: RequestOptions): Observable<T> {
    const headers = buildHeaders(options?.headers, options?.idempotencyKey);
    return this.http.delete<T>(apiUrl(path), {
      headers,
      params: params(options?.params)
    });
  }
}

