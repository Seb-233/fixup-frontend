import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BoardItem } from '../../data/models';
import { RequestsApi } from '../../data/requests.api';
import { REQUEST_STATUS, SLA_STATE, SPECIALTY, URGENCY, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { AgoPipe, LabelPipe, WhenPipe } from '../../shared/ui/pipes';
import { StarsComponent } from '../../shared/ui/stars.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

type Filter = 'UNASSIGNED' | 'IN_PROGRESS' | 'CLOSED';
const SLA_ORDER: Record<string, number> = { BREACHED: 0, WARNING: 1, ON_TRACK: 2, NONE: 3 };

@Component({
  selector: 'app-management-page',
  imports: [FormsModule, RouterLink, IconComponent, StatusComponent, StarsComponent, LabelPipe, WhenPipe, AgoPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './management.page.html',
  styles: `
    .board { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-3); }
    .item-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--s-3); }
    .grow { flex: 1; min-width: 0; }
    .badges { display: flex; flex-wrap: wrap; gap: var(--s-1); align-items: center; }
    .candidates { list-style: none; margin: 0; padding: 0; }
    .candidate { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) 0; }
    .candidate input { width: 20px; height: 20px; accent-color: var(--primary); }
    .late { color: var(--danger); font-weight: 600; }
  `
})
export class ManagementPage {
  private readonly api = inject(RequestsApi);
  readonly board = rxResource({ stream: () => this.api.board() });
  readonly filter = signal<Filter>('UNASSIGNED');
  readonly status = REQUEST_STATUS;
  readonly sla = SLA_STATE;
  readonly urgency = URGENCY;
  readonly specialty = SPECIALTY;
  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'UNASSIGNED', label: 'Sin técnico' },
    { key: 'IN_PROGRESS', label: 'En curso' },
    { key: 'CLOSED', label: 'Cerradas' }
  ];

  readonly expanded = signal<string | null>(null);
  readonly candidates = rxResource({
    params: () => this.expanded() ?? undefined,
    stream: ({ params }) => this.api.candidates(params)
  });
  selected: Record<string, boolean> = {};
  note = '';
  readonly inviting = signal(false);
  readonly inviteMessage = signal<string | null>(null);
  readonly inviteError = signal<string | null>(null);

  readonly visible = computed(() => {
    if (!this.board.hasValue()) return [];
    return this.board
      .value()
      .filter((item) => this.bucket(item) === this.filter())
      .sort((a, b) => (SLA_ORDER[a.slaState] ?? 9) - (SLA_ORDER[b.slaState] ?? 9) || (a.slaDeadline ?? '').localeCompare(b.slaDeadline ?? ''));
  });

  readonly selectedCount = computed(() => Object.values(this.selectedState()).filter(Boolean).length);
  private readonly selectedState = signal<Record<string, boolean>>({});

  count(filter: Filter): number {
    return this.board.hasValue() ? this.board.value().filter((item) => this.bucket(item) === filter).length : 0;
  }

  toggle(requestId: string): void {
    this.inviteMessage.set(null);
    this.inviteError.set(null);
    this.selected = {};
    this.selectedState.set({});
    this.note = '';
    this.expanded.set(this.expanded() === requestId ? null : requestId);
  }

  pick(fixerId: string, value: boolean): void {
    this.selected[fixerId] = value;
    this.selectedState.set({ ...this.selected });
  }

  invite(requestId: string): void {
    const ids = Object.entries(this.selected).filter(([, v]) => v).map(([id]) => id);
    if (!ids.length) return;
    if (ids.length > 5) {
      this.inviteError.set('Invita como máximo a cinco técnicos por solicitud.');
      return;
    }
    this.inviting.set(true);
    this.inviteError.set(null);
    this.api.invite(requestId, ids, this.note.trim() || undefined).subscribe({
      next: (result) => {
        this.inviting.set(false);
        this.inviteMessage.set(`Invitaste a ${result.invitedFixerUserIds.length} ${result.invitedFixerUserIds.length === 1 ? 'técnico' : 'técnicos'}. Les llegó una notificación.`);
        this.selected = {};
        this.selectedState.set({});
        this.candidates.reload();
      },
      error: (failure) => {
        this.inviting.set(false);
        this.inviteError.set(errorMessage(failure, 'No pudimos enviar las invitaciones.'));
      }
    });
  }

  private bucket(item: BoardItem): Filter {
    if (item.status === 'COMPLETED' || item.status === 'CANCELLED') return 'CLOSED';
    return item.assignedFixerUserId ? 'IN_PROGRESS' : 'UNASSIGNED';
  }
}
