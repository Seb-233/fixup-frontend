import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { PlaceholderComponent } from '../../../../shared/components/placeholder/placeholder.component';
import { SlaTimerComponent } from '../../../../shared/components/sla-timer/sla-timer.component';
import {
  AdministrationSlaStore,
  SlaBoardRow
} from '../../services/administration-sla.store';
import {
  RepairRequestStatusExt,
  STATUS_LABELS_EXT,
  UrgencyLevel,
  URGENCY_LABELS
} from '../../../requests/models/request-extensions';

type StatusFilter = 'ALL' | 'OPEN' | 'SLA_WARNING' | 'SLA_BREACHED' | 'ASSIGNED';

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: 'Todas',
  OPEN: 'Abiertas',
  SLA_WARNING: 'Warning',
  SLA_BREACHED: 'Vencidas',
  ASSIGNED: 'Asignadas'
};

@Component({
  selector: 'app-sla-board',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterLink,
    PlaceholderComponent,
    SlaTimerComponent
  ],
  templateUrl: './sla-board.component.html',
  styleUrls: ['./sla-board.component.scss']
})
export class SlaBoardComponent implements OnInit {
  private readonly store = inject(AdministrationSlaStore);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusFilter = signal<StatusFilter>('ALL');
  readonly actionFeedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  readonly statusFilters: readonly string[] = ['ALL', 'OPEN', 'SLA_WARNING', 'SLA_BREACHED', 'ASSIGNED'] as const;

  readonly storeRows = this.store.rows;
  readonly storeLoading = this.store.loading;
  readonly storeError = this.store.error;

  readonly filteredRows = computed(() => {
    const raw = this.storeRows();
    const query = this.searchControl.value.trim().toLowerCase();
    const status = this.statusFilter();
    return raw.filter((row) => {
      if (status !== 'ALL' && row.status !== status) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        row.title.toLowerCase().includes(query) ||
        row.city.toLowerCase().includes(query) ||
        row.propertyId.toLowerCase().includes(query) ||
        row.specialty.toLowerCase().includes(query) ||
        (row.assignedFixerUserId || '').toLowerCase().includes(query)
      );
    });
  });

  readonly totalCount = computed(() => this.storeRows().length);
  readonly breachedCount = this.store.breachedCount;
  readonly warningCount = this.store.warningCount;

  ngOnInit(): void {
    this.store.load();
  }

  statusChipColor(status: RepairRequestStatusExt): string {
    switch (status) {
      case 'SLA_BREACHED':
        return 'danger';
      case 'SLA_WARNING':
        return 'warning';
      case 'ASSIGNED':
        return 'tertiary';
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'medium';
      default:
        return 'primary';
    }
  }

  statusLabel(status: RepairRequestStatusExt): string {
    return STATUS_LABELS_EXT[status] ?? status;
  }

  urgencyLabel(level: UrgencyLevel): string {
    return URGENCY_LABELS[level] ?? level;
  }

  statusFilterLabel(filter: string): string {
    return STATUS_FILTER_LABELS[(filter as StatusFilter) ?? 'ALL'] ?? filter;
  }

  setStatusFilter(filter: string | undefined | null): void {
    const key = (filter ?? 'ALL') as StatusFilter;
    this.statusFilter.set(key);
  }

  setStatusFilterFromEvent(ev: Event): void {
    const target = ev.target as { value?: string | null };
    this.setStatusFilter(target?.value);
  }

  onReasignar(row: SlaBoardRow, fixerUserId?: string): void {
    if (!fixerUserId) {
      // PENDIENTE BACKEND: Selección de técnico requiere un mecanismo/modal con UUID real
      this.actionFeedback.set({
        type: 'error',
        message: 'Reasignación deshabilitada: se requiere un UUID válido de técnico.'
      });
      this.clearFeedbackAfterDelay();
      return;
    }
    this.store.reassign(row.requestId, fixerUserId).subscribe({
      next: () => {
        this.actionFeedback.set({
          type: 'success',
          message: `Solicitud "${row.title}" reasignada correctamente.`
        });
        this.clearFeedbackAfterDelay();
      },
      error: (err) => {
        this.actionFeedback.set({
          type: 'error',
          message: err?.message || 'Error al reasignar técnico.'
        });
        this.clearFeedbackAfterDelay();
      }
    });
  }

  onMarcarAtendido(row: SlaBoardRow): void {
    this.store.acknowledge(row.requestId).subscribe({
      next: () => {
        this.actionFeedback.set({
          type: 'success',
          message: `Solicitud "${row.title}" marcada como atendida.`
        });
        this.clearFeedbackAfterDelay();
      },
      error: (err) => {
        this.actionFeedback.set({
          type: 'error',
          message: err?.message || 'Error al marcar como atendida.'
        });
        this.clearFeedbackAfterDelay();
      }
    });
  }

  private clearFeedbackAfterDelay(): void {
    setTimeout(() => this.actionFeedback.set(null), 3200);
  }
}
