import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AdministrationSlaApiService, SlaBoardRequestItem } from './administration-sla-api.service';
import type {
  UrgencyLevel,
  RepairRequestStatusExt
} from '../../requests/models/request-extensions';

export interface SlaBoardRow {
  id: string;
  requestId: string;
  propertyId: string;
  city: string;
  specialty: string;
  title: string;
  slaDeadline: string;
  urgencyLevel: UrgencyLevel;
  status: RepairRequestStatusExt;
  slaState: string;
  remainingMinutes: number;
  assignedFixerUserId: string | null;
  lastEscalationNotifiedAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdministrationSlaStore {
  private readonly api = inject(AdministrationSlaApiService);

  private readonly rowsState = signal<SlaBoardRow[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly rows = this.rowsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly totalCount = computed(() => this.rowsState().length);
  readonly breachedCount = computed(() => this.rowsState().filter((r) => r.status === 'SLA_BREACHED').length);
  readonly warningCount = computed(() => this.rowsState().filter((r) => r.status === 'SLA_WARNING').length);

  load(): void {
    this.loadingState.set(true);
    this.errorState.set(null);
    this.api.getRequests().subscribe({
      next: (items: SlaBoardRequestItem[]) => {
        const rows: SlaBoardRow[] = items.map((item) => ({
          id: item.requestId,
          requestId: item.requestId,
          propertyId: item.propertyId,
          city: item.propertyCity || 'N/A',
          specialty: item.specialty,
          title: item.title,
          slaDeadline: item.slaDeadline,
          urgencyLevel: item.urgencyLevel,
          status: item.status,
          slaState: item.slaState,
          remainingMinutes: item.remainingMinutes,
          assignedFixerUserId: item.assignedFixerUserId ?? null,
          lastEscalationNotifiedAt: item.lastEscalationNotifiedAt ?? null,
          createdAt: item.createdAt
        }));
        this.rowsState.set(rows);
        this.loadingState.set(false);
      },
      error: (err) => {
        this.loadingState.set(false);
        this.errorState.set(err?.message || 'Error al cargar las solicitudes SLA');
      }
    });
  }

  setRows(rows: SlaBoardRow[]): void {
    this.rowsState.set(rows);
  }

  setLoading(loading: boolean): void {
    this.loadingState.set(loading);
  }

  setError(error: string | null): void {
    this.errorState.set(error);
  }

  acknowledge(requestId: string): Observable<void> {
    return this.api.acknowledge(requestId).pipe(
      tap(() => {
        this.rowsState.update((curr) =>
          curr.map((r) =>
            r.requestId === requestId ? { ...r, status: 'ASSIGNED' as RepairRequestStatusExt } : r
          )
        );
      })
    );
  }

  reassign(requestId: string, fixerUserId: string): Observable<void> {
    return this.api.reassign(requestId, fixerUserId).pipe(
      tap(() => {
        this.rowsState.update((curr) =>
          curr.map((r) =>
            r.requestId === requestId ? { ...r, assignedFixerUserId: fixerUserId } : r
          )
        );
      })
    );
  }
}
