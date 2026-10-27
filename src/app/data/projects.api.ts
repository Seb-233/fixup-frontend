import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Api } from './http';
import {
  ContractResponse,
  CreateContractRequest,
  CreateProjectRequest,
  IndicatorsResponse,
  ProjectResponse,
  ProjectSummaryResponse,
  UpdateContractRequest
} from './models';

// Contratos de arriendo, remodelaciones e indicadores de mercado.
@Injectable({ providedIn: 'root' })
export class ProjectsApi {
  private readonly api = inject(Api);

  contracts(): Observable<ContractResponse[]> {
    return this.api.get('/contracts/me');
  }

  expiringContracts(days = 60): Observable<ContractResponse[]> {
    return this.api.get('/contracts/expiring', { days });
  }

  contract(contractId: string): Observable<ContractResponse> {
    return this.api.get(`/contracts/${contractId}`);
  }

  createContract(body: CreateContractRequest): Observable<ContractResponse> {
    return this.api.post('/contracts', body);
  }

  updateContract(contractId: string, body: UpdateContractRequest): Observable<ContractResponse> {
    return this.api.put(`/contracts/${contractId}`, body);
  }

  renewContract(contractId: string, newEndDate: string): Observable<ContractResponse> {
    return this.api.post(`/contracts/${contractId}/renew`, { newEndDate });
  }

  findTenant(email: string): Observable<{ id: string; displayName: string }> {
    return this.api.get('/contracts/tenant-lookup', { email });
  }

  terminateContract(contractId: string, reason: string): Observable<ContractResponse> {
    return this.api.post(`/contracts/${contractId}/terminate`, { reason });
  }

  remodelings(): Observable<ProjectSummaryResponse[]> {
    return this.api.get('/remodelings/me');
  }

  remodeling(projectId: string): Observable<ProjectResponse> {
    return this.api.get(`/remodelings/${projectId}`);
  }

  createRemodeling(body: CreateProjectRequest): Observable<ProjectResponse> {
    return this.api.post('/remodelings', body);
  }

  publishRemodelingListing(projectId: string): Observable<ProjectResponse> {
    return this.api.post(`/remodelings/${projectId}/publish-listing`);
  }

  marketIndicators(zone: string): Observable<IndicatorsResponse> {
    return this.api.get(`/analytics/zones/${encodeURIComponent(zone)}/market-indicators`);
  }
}
