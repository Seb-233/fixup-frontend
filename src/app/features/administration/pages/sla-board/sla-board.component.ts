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

function buildMockRows(): SlaBoardRow[] {
  const now = Date.now();
  const h = (ms: number) => now + ms * 60 * 60 * 1000;
  return [
    {
      id: '1',
      requestId: 'a1b2c3d4-0001-0000-0000-000000000001',
      propertyName: 'Apartamento 402 – Torre Norte',
      city: 'Bogotá',
      title: 'Fuga de agua en baño principal',
      slaDeadline: new Date(h(-2)).toISOString(),
      urgencyLevel: 'URGENT',
      status: 'SLA_BREACHED',
      assignedFixerId: null,
      assignedFixerName: null
    },
    {
      id: '2',
      requestId: 'a1b2c3d4-0002-0000-0000-000000000002',
      propertyName: 'Casa Campestre El Pino',
      city: 'Medellín',
      title: 'Cambio de tomacorrientes en cocina',
      slaDeadline: new Date(h(6)).toISOString(),
      urgencyLevel: 'HIGH',
      status: 'SLA_WARNING',
      assignedFixerId: 'fixer-001',
      assignedFixerName: 'Carlos Ramírez'
    },
    {
      id: '3',
      requestId: 'a1b2c3d4-0003-0000-0000-000000000003',
      propertyName: 'Oficina Piso 8',
      city: 'Cali',
      title: 'Pintura de sala de reuniones',
      slaDeadline: new Date(h(36)).toISOString(),
      urgencyLevel: 'MEDIUM',
      status: 'OPEN',
      assignedFixerId: null,
      assignedFixerName: null
    },
    {
      id: '4',
      requestId: 'a1b2c3d4-0004-0000-0000-000000000004',
      propertyName: 'Local Comercial Centro',
      city: 'Barranquilla',
      title: 'Reparación de puerta de vidrio',
      slaDeadline: new Date(h(2)).toISOString(),
      urgencyLevel: 'HIGH',
      status: 'SLA_WARNING',
      assignedFixerId: null,
      assignedFixerName: null
    },
    {
      id: '5',
      requestId: 'a1b2c3d4-0005-0000-0000-000000000005',
      propertyName: 'Edificio Las Palmas Apto 101',
      city: 'Bucaramanga',
      title: 'Instalación de estante flotante',
      slaDeadline: new Date(h(120)).toISOString(),
      urgencyLevel: 'LOW',
      status: 'ASSIGNED',
      assignedFixerId: 'fixer-002',
      assignedFixerName: 'María González'
    },
    {
      id: '6',
      requestId: 'a1b2c3d4-0006-0000-0000-000000000006',
      propertyName: 'Chalet Santa Ana',
      city: 'Cartagena',
      title: 'Revisión general de instalación eléctrica',
      slaDeadline: new Date(h(-5)).toISOString(),
      urgencyLevel: 'URGENT',
      status: 'SLA_BREACHED',
      assignedFixerId: 'fixer-003',
      assignedFixerName: 'Jorge Patiño'
    }
  ];
}

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
        row.propertyName.toLowerCase().includes(query) ||
        row.city.toLowerCase().includes(query) ||
        row.title.toLowerCase().includes(query) ||
        (row.assignedFixerName || '').toLowerCase().includes(query)
      );
    });
  });

  readonly totalCount = computed(() => this.storeRows().length);
  readonly breachedCount = this.store.breachedCount;
  readonly warningCount = this.store.warningCount;

  ngOnInit(): void {
    this.store.setLoading(true);
    this.store.setError(null);
    setTimeout(() => {
      this.store.setRows(buildMockRows());
      this.store.setLoading(false);
    }, 350);
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

  onReasignar(row: SlaBoardRow): void {
    this.store.reassign(
      row.requestId,
      row.assignedFixerId ?? `pending-${row.requestId.slice(0, 8)}`,
      row.assignedFixerName ?? `(En selección)`
    );
    this.actionFeedback.set({
      type: 'success',
      message: `Se inició la reasignación para "${row.title}".`
    });
    this.clearFeedbackAfterDelay();
  }

  onMarcarAtendido(row: SlaBoardRow): void {
    this.store.markAttended(row.requestId);
    this.actionFeedback.set({
      type: 'success',
      message: `Solicitud "${row.title}" marcada como atendida.`
    });
    this.clearFeedbackAfterDelay();
  }

  private clearFeedbackAfterDelay(): void {
    setTimeout(() => this.actionFeedback.set(null), 3200);
  }
}
