import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  RepairRequestControllerService,
  RequestDetailResponse,
  OpenRequest
} from '../../../api/generated';
import {
  OpenRequestExtended,
  toOpenRequestPayload
} from '../models/request-extensions';

/**
 * Adapter explícito que aísla las diferencias temporales entre el cliente OpenAPI generado
 * y las extensiones del backend (como urgencyLevel y slaDeadline) sin modificar generated.
 */
@Injectable({ providedIn: 'root' })
export class RequestsApiAdapterService {
  private readonly generatedApi = inject(RepairRequestControllerService);

  open(request: OpenRequestExtended): Observable<RequestDetailResponse> {
    const payload = toOpenRequestPayload(request);
    return this.generatedApi.open(payload as unknown as OpenRequest);
  }

  mine(): Observable<RequestDetailResponse[]> {
    return this.generatedApi.mine();
  }

  detail(requestId: string): Observable<RequestDetailResponse> {
    return this.generatedApi.detail(requestId);
  }
}
