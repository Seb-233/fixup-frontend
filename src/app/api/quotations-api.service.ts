import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Quotation, SubmitQuotationPayload } from '../shared/models/quotation.model';
import { API_ROUTES, apiUrl } from './api.routes';

// FR-UC-18: acceso a datos de cotizaciones.
// Los componentes nunca consumen HttpClient directamente; toda llamada pasa por aquí.
@Injectable({
  providedIn: 'root'
})
export class QuotationsApiService {
  private readonly http = inject(HttpClient);

  // Envía la oferta del Fixer. El backend exige que esté verificado.
  submit(payload: SubmitQuotationPayload): Observable<Quotation> {
    return this.http.post<Quotation>(apiUrl(API_ROUTES.quotations.base), payload);
  }

  // Cotizaciones enviadas por el Fixer actual y en qué quedaron
  listMine(): Observable<Quotation[]> {
    return this.http.get<Quotation[]>(apiUrl(API_ROUTES.quotations.mine));
  }

  // Tablero comparativo del propietario: ofertas recibidas, de la más barata a la más cara
  listForRequest(requestId: string): Observable<Quotation[]> {
    return this.http.get<Quotation[]>(apiUrl(API_ROUTES.quotations.forRequest(requestId)));
  }

  // Acepta una oferta. El backend rechaza las demás y asigna la solicitud en la misma transacción.
  accept(quotationId: string): Observable<Quotation> {
    return this.http.post<Quotation>(apiUrl(API_ROUTES.quotations.accept(quotationId)), {});
  }
}
