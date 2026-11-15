import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Api } from './http';
import { AuditedResourceType, StatusChangeEntry } from './models';

// Administración de plataforma: pantallas de supervisión y consulta transversal.
@Injectable({ providedIn: 'root' })
export class AdministrationApi {
  private readonly api = inject(Api);

  statusChanges(resourceType?: AuditedResourceType, resourceId?: string, limit = 100): Observable<StatusChangeEntry[]> {
    return this.api.get('/administration/audit/status-changes', { resourceType, resourceId, limit });
  }
}
