import { Injectable, signal, computed } from '@angular/core';
import type {
  UrgencyLevel,
  RepairRequestStatusExt
} from '../../requests/models/request-extensions';

export interface SlaBoardRow {
  id: string;
  requestId: string;
  propertyName: string;
  city: string;
  slaDeadline: string;
  urgencyLevel: UrgencyLevel;
  status: RepairRequestStatusExt;
  assignedFixerName: string | null;
  assignedFixerId: string | null;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class AdministrationSlaStore {
  private readonly rowsState = signal<SlaBoardRow[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly rows = this.rowsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly totalCount = computed(() => this.rowsState().length);
  readonly breachedCount = computed(() => this.rowsState().filter((r) => r.status === 'SLA_BREACHED').length);
  readonly warningCount = computed(() => this.rowsState().filter((r) => r.status === 'SLA_WARNING').length);

  setRows(rows: SlaBoardRow[]): void {
    this.rowsState.set(rows);
  }

  setLoading(loading: boolean): void {
    this.loadingState.set(loading);
  }

  setError(error: string | null): void {
    this.errorState.set(error);
  }

  markAttended(requestId: string): void {
    this.rowsState.update((curr) =>
      curr.map((r) =>
        r.requestId === requestId ? { ...r, status: 'ASSIGNED' as RepairRequestStatusExt } : r
      )
    );
  }

  reassign(requestId: string, fixerId: string | null, fixerName: string | null): void {
    this.rowsState.update((curr) =>
      curr.map((r) =>
        r.requestId === requestId
          ? { ...r, assignedFixerId: fixerId, assignedFixerName: fixerName }
          : r
      )
    );
  }
}
