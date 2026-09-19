import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  OpenRepairRequestPayload,
  RepairRequest,
  Specialty
} from '../shared/models/repair-request.model';
import { API_ROUTES, apiUrl } from './api.routes';

// FR-UC-18: acceso a datos de solicitudes de reparación.
// Los componentes nunca consumen HttpClient directamente; toda llamada pasa por aquí.
@Injectable({
  providedIn: 'root'
})
export class RequestsApiService {
  private readonly http = inject(HttpClient);

  // Abre una solicitud. photoKeys son storage keys ya subidas por el cliente.
  open(payload: OpenRepairRequestPayload): Observable<RepairRequest> {
    return this.http.post<RepairRequest>(apiUrl(API_ROUTES.requests.base), payload);
  }

  // Solicitudes creadas por el usuario actual, de la más reciente a la más antigua
  listMine(): Observable<RepairRequest[]> {
    return this.http.get<RepairRequest[]>(apiUrl(API_ROUTES.requests.mine));
  }

  // Bandeja del Fixer: solicitudes abiertas, opcionalmente filtradas por especialidad
  listOpen(specialty?: Specialty): Observable<RepairRequest[]> {
    const params = specialty ? new HttpParams().set('specialty', specialty) : undefined;
    return this.http.get<RepairRequest[]>(apiUrl(API_ROUTES.requests.open), { params });
  }

  // Detalle con descripción y fotos. El backend decide si el usuario puede verlo.
  getById(requestId: string): Observable<RepairRequest> {
    return this.http.get<RepairRequest>(apiUrl(API_ROUTES.requests.detail(requestId)));
  }
}
