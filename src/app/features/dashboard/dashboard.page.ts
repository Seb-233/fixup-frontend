import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { PeopleApi } from '../../data/people.api';
import { ProjectsApi } from '../../data/projects.api';
import { PropertiesApi } from '../../data/properties.api';
import { RequestsApi } from '../../data/requests.api';
import { orNull } from '../../data/safe';
import { WorkApi } from '../../data/work.api';
import {
  BoardItem,
  ContractResponse,
  EarningsResponse,
  JobResponse,
  OpenRequestSummaryResponse,
  OwnerDebtDetail,
  PaymentDetail,
  PendingVerification,
  PropertySummary,
  RequestDetailResponse,
  SlaBoardItemResponse,
  VisitResponse
} from '../../data/models';
import { JOB_STATUS, REQUEST_STATUS, ROLE_NAME, SPECIALTY, VISIT_KIND, VISIT_STATUS, money } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { IdeasFeedComponent } from '../ideas/ideas-feed.component';
import { DayPipe, LabelPipe, MoneyPipe, WhenPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

interface DashboardData {
  properties: PropertySummary[] | null;
  requests: RequestDetailResponse[] | null;
  visits: VisitResponse[] | null;
  payments: PaymentDetail[] | null;
  debts: OwnerDebtDetail[] | null;
  contracts: ContractResponse[] | null;
  board: BoardItem[] | null;
  jobs: JobResponse[] | null;
  open: OpenRequestSummaryResponse[] | null;
  earnings: EarningsResponse | null;
  pending: PendingVerification[] | null;
  sla: { content: SlaBoardItemResponse[]; totalElements: number } | null;
}

type Sources = { [K in keyof DashboardData]: Observable<DashboardData[K]> };

interface Task {
  text: string;
  detail: string;
  link: string;
  tone: 'danger' | 'warning' | 'info' | 'accent';
}

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, IconComponent, IdeasFeedComponent, LoadingComponent, ErrorStateComponent, StatusComponent, MoneyPipe, WhenPipe, DayPipe, LabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPage {
  private readonly user = inject(CurrentUserStore);
  private readonly properties = inject(PropertiesApi);
  private readonly requests = inject(RequestsApi);
  private readonly work = inject(WorkApi);
  private readonly people = inject(PeopleApi);
  private readonly projects = inject(ProjectsApi);

  readonly role = this.user.activeRole;
  readonly roleNames = ROLE_NAME;
  readonly specialty = SPECIALTY;
  readonly visitKind = VISIT_KIND;
  readonly visitStatus = VISIT_STATUS;
  readonly requestStatus = REQUEST_STATUS;
  readonly jobStatus = JOB_STATUS;
  readonly firstName = computed(() => (this.user.user()?.displayName ?? '').split(' ')[0]);
  readonly today = new Date();
  /** Propietario y arrendatario: su inicio es un resumen corto y el feed de ideas de remodelación. */
  readonly isClient = computed(() => this.role() === 'OWNER' || this.role() === 'TENANT');

  readonly data = rxResource({
    params: () => ({ role: this.role(), userId: this.user.user()?.id }),
    stream: ({ params }): Observable<DashboardData> => {
      const sources: Sources = {
        properties: of(null),
        requests: of(null),
        visits: of(null),
        payments: of(null),
        debts: of(null),
        contracts: of(null),
        board: of(null),
        jobs: of(null),
        open: of(null),
        earnings: of(null),
        pending: of(null),
        sla: of(null)
      };
      // La inmobiliaria ve lo mismo que un propietario y además su tablero de mantenimiento.
      if (params.role === 'REAL_ESTATE_MANAGER') sources.board = orNull(this.requests.board());
      switch (params.role) {
        case 'REAL_ESTATE_MANAGER':
        case 'OWNER':
          sources.properties = orNull(this.properties.mine());
          sources.requests = orNull(this.requests.mine());
          sources.visits = orNull(this.work.myVisits());
          sources.payments = orNull(this.work.myPayments());
          sources.debts = orNull(this.work.myDebts());
          sources.contracts = orNull(this.projects.expiringContracts(45));
          break;
        case 'TENANT':
          sources.requests = orNull(this.requests.mine());
          sources.visits = orNull(this.work.myVisits());
          sources.contracts = orNull(this.projects.contracts());
          break;
        case 'FIXER':
          sources.visits = orNull(this.work.myVisits());
          sources.jobs = orNull(this.work.myJobs());
          sources.open = orNull(this.requests.open());
          sources.earnings = orNull(this.work.earnings());
          break;
        default:
          sources.pending = orNull(this.people.pendingVerifications());
          sources.sla = orNull(this.people.slaBoard(0, 100));
      }
      return forkJoin(sources) as Observable<DashboardData>;
    }
  });

  readonly upcoming = computed<VisitResponse[]>(() => {
    if (!this.data.hasValue()) return [];
    const now = Date.now();
    return (this.data.value().visits ?? [])
      .filter((visit) => (visit.status === 'PROPOSED' || visit.status === 'CONFIRMED') && new Date(visit.scheduledAt).getTime() > now)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 5);
  });

  readonly tasks = computed<Task[]>(() => {
    if (!this.data.hasValue()) return [];
    const d = this.data.value();
    const me = this.user.user()?.id;
    const tasks: Task[] = [];

    const toConfirm = (d.visits ?? []).filter((v) => v.status === 'PROPOSED' && v.proposedByUserId !== me);
    if (toConfirm.length) {
      tasks.push({
        text: toConfirm.length === 1 ? '1 visita por confirmar' : `${toConfirm.length} visitas por confirmar`,
        detail: 'La otra parte propuso fecha. Confírmala o propón otra hora.',
        link: '/visits',
        tone: 'warning'
      });
    }

    const debts = (d.debts ?? []).filter((debt) => debt.status === 'OUTSTANDING');
    if (debts.length) {
      tasks.push({
        text: debts.length === 1 ? '1 saldo pendiente' : `${debts.length} saldos pendientes`,
        detail: `${money(debts.reduce((sum, debt) => sum + (debt.amount ?? 0), 0))} de trabajos en efectivo. Págalo para abrir otra solicitud.`,
        link: '/payments',
        tone: 'danger'
      });
    }

    const pendingPayments = (d.payments ?? []).filter((p) => p.status !== 'APPROVED');
    if (pendingPayments.length) {
      const total = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
      tasks.push({
        text: pendingPayments.length === 1 ? '1 pago pendiente' : `${pendingPayments.length} pagos pendientes`,
        detail: `${money(total)} por transferencia. El técnico empieza cuando el pago queda aprobado.`,
        link: '/payments',
        tone: 'danger'
      });
    }

    const slaStates = d.board ? d.board.map((item) => item.slaState) : (d.requests ?? []).map((item) => item.slaState);
    const late = slaStates.filter((state) => state === 'BREACHED' || state === 'WARNING');
    if (late.length && this.role() !== 'TENANT') {
      tasks.push({
        text: late.length === 1 ? '1 solicitud con el plazo en riesgo' : `${late.length} solicitudes con el plazo en riesgo`,
        detail: 'Revisa cotizaciones o invita técnicos antes de que venza.',
        link: this.role() === 'REAL_ESTATE_MANAGER' ? '/management' : '/requests',
        tone: 'warning'
      });
    }

    const expiring = this.role() === 'TENANT' ? [] : d.contracts ?? [];
    if (expiring.length) {
      tasks.push({
        text: expiring.length === 1 ? '1 contrato vence pronto' : `${expiring.length} contratos vencen pronto`,
        detail: 'Vencen en los próximos 45 días. Renueva o termina a tiempo.',
        link: '/contracts',
        tone: 'info'
      });
    }

    const invited = (d.open ?? []).filter((r) => r.invited);
    if (invited.length) {
      tasks.push({
        text: invited.length === 1 ? '1 invitación a cotizar' : `${invited.length} invitaciones a cotizar`,
        detail: 'Una inmobiliaria te eligió para estas solicitudes.',
        link: '/requests/inbox',
        tone: 'accent'
      });
    }

    const toSchedule = (d.jobs ?? []).filter((j) => j.status === 'ASSIGNED');
    if (toSchedule.length) {
      tasks.push({
        text: toSchedule.length === 1 ? '1 trabajo por agendar' : `${toSchedule.length} trabajos por agendar`,
        detail: 'Acuerda la fecha con el cliente y regístrala.',
        link: '/jobs/me',
        tone: 'warning'
      });
    }

    if (d.pending?.length) {
      tasks.push({
        text: d.pending.length === 1 ? '1 técnico espera verificación' : `${d.pending.length} técnicos esperan verificación`,
        detail: 'Revisa sus documentos y aprueba o rechaza.',
        link: '/administration/fixer-review',
        tone: 'warning'
      });
    }

    const breached = (d.sla?.content ?? []).filter((item) => item.slaState === 'BREACHED');
    if (breached.length) {
      tasks.push({
        text: breached.length === 1 ? '1 solicitud con el plazo vencido' : `${breached.length} solicitudes con el plazo vencido`,
        detail: 'Reasigna el técnico o reconoce la escalada.',
        link: '/administration/sla-board',
        tone: 'danger'
      });
    }
    return tasks;
  });

  readonly figures = computed<{ label: string; value: string; link?: string }[]>(() => {
    if (!this.data.hasValue()) return [];
    const d = this.data.value();
    switch (this.role()) {
      case 'OWNER':
      case 'REAL_ESTATE_MANAGER': {
        const props = d.properties ?? [];
        const open = (d.requests ?? []).filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
        const paid = (d.payments ?? []).filter((p) => p.status === 'APPROVED');
        return [
          { label: 'Inmuebles publicados', value: `${props.filter((p) => p.status === 'PUBLISHED').length} de ${props.length}`, link: '/properties' },
          { label: 'Solicitudes abiertas', value: String(open.length), link: '/requests' },
          { label: 'Pagado por transferencia', value: money(paid.reduce((sum, p) => sum + p.amount, 0)), link: '/expenses' }
        ];
      }
      case 'TENANT': {
        const open = (d.requests ?? []).filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
        return [
          { label: 'Solicitudes en curso', value: String(open.length), link: '/requests' },
          { label: 'Visitas próximas', value: String(this.upcoming().length), link: '/visits' }
        ];
      }
      case 'FIXER': {
        const active = (d.jobs ?? []).filter((j) => j.status !== 'COMPLETED');
        return [
          { label: 'Saldo disponible', value: money(d.earnings?.availableBalance ?? 0), link: '/payments/earnings' },
          { label: 'Trabajos activos', value: String(active.length), link: '/jobs/me' },
          { label: 'Solicitudes para cotizar', value: String((d.open ?? []).length), link: '/requests/inbox' }
        ];
      }
      default: {
        const items = d.sla?.content ?? [];
        return [
          { label: 'Plazos vencidos', value: String(items.filter((i) => i.slaState === 'BREACHED').length), link: '/administration/sla-board' },
          { label: 'Por vencer', value: String(items.filter((i) => i.slaState === 'WARNING').length) },
          { label: 'Verificaciones pendientes', value: String(d.pending?.length ?? 0), link: '/administration/fixer-review' }
        ];
      }
    }
  });

  readonly activeContract = computed(() => {
    if (!this.data.hasValue() || this.role() !== 'TENANT') return null;
    return (this.data.value().contracts ?? []).find((c) => c.status === 'ACTIVE' || c.status === 'RENEWED') ?? null;
  });

  readonly recentRequests = computed(() => {
    if (!this.data.hasValue()) return [];
    return [...(this.data.value().requests ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  });

  readonly activeJobs = computed(() => {
    if (!this.data.hasValue()) return [];
    return (this.data.value().jobs ?? []).filter((j) => j.status !== 'COMPLETED').slice(0, 5);
  });
}
