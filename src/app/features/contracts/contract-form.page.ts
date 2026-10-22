import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ContractResponse } from '../../data/models';
import { ProjectsApi } from '../../data/projects.api';
import { PropertiesApi } from '../../data/properties.api';
import { errorMessage, isoDate } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

@Component({
  selector: 'app-contract-form-page',
  imports: [FormsModule, RouterLink, IconComponent, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <a [routerLink]="contractId() ? ['/contracts', contractId()] : ['/contracts']" class="back-link"><app-icon name="chevron-left" [size]="16" />{{ contractId() ? 'Contrato' : 'Contratos' }}</a>
      <header class="page-header">
        <div>
          <h1>{{ contractId() ? 'Editar contrato' : 'Nuevo contrato' }}</h1>
          <p class="lede">El arrendatario debe tener cuenta de arrendatario en Fix&amp;Rent. Con el contrato vigente podrá reportar daños del inmueble.</p>
        </div>
      </header>

      @if (loading()) {
        <app-loading text="Cargando el contrato…" />
      } @else if (loadError()) {
        <app-error title="No pudimos abrir el contrato" [retryable]="false" />
      } @else {
        <form #f="ngForm" class="panel stack" (ngSubmit)="save(f.valid ?? false)" novalidate>
          <div class="field">
            <label for="property">Inmueble *</label>
            @if (contractId()) {
              <input id="property" class="input" [value]="loaded()?.propertyName" disabled />
            } @else {
              <select id="property" class="select" name="property" required [(ngModel)]="propertyId" #property="ngModel" [attr.aria-invalid]="submitted() && property.invalid">
                <option value="" disabled>Elige el inmueble</option>
                @if (properties.hasValue()) {
                  @for (p of properties.value(); track p.id) { <option [value]="p.id">{{ p.name }} · {{ p.address }}, {{ p.city }}</option> }
                }
              </select>
              @if (submitted() && property.invalid) { <span class="error">Elige el inmueble.</span> }
            }
          </div>

          <div class="field">
            <label for="tenant-email">Arrendatario *</label>
            @if (contractId()) {
              <input id="tenant-email" class="input" [value]="loaded()?.tenantName" disabled />
            } @else if (tenant(); as t) {
              <div class="spread tenant-found">
                <span><app-icon name="user" /> <strong>{{ t.displayName }}</strong></span>
                <button type="button" class="btn btn-ghost" (click)="tenant.set(null)">Cambiar</button>
              </div>
            } @else {
              <div class="lookup">
                <input id="tenant-email" class="input" type="email" name="tenantEmail" [(ngModel)]="tenantEmail" placeholder="correo@ejemplo.com" autocomplete="off" />
                <button type="button" class="btn btn-secondary" (click)="findTenant()" [disabled]="looking() || !tenantEmail.trim()">{{ looking() ? 'Buscando…' : 'Buscar' }}</button>
              </div>
              <span class="hint">Escribe el correo con el que el arrendatario creó su cuenta.</span>
              @if (lookupError()) { <span class="error">{{ lookupError() }}</span> }
            }
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="start">Inicio *</label>
              <input id="start" type="date" class="input" name="start" required [(ngModel)]="startDate" />
            </div>
            <div class="field">
              <label for="end">Fin *</label>
              <input id="end" type="date" class="input" name="end" required [(ngModel)]="endDate" [min]="startDate" />
            </div>
            <div class="field">
              <label for="rent">Canon mensual (COP) *</label>
              <input id="rent" type="number" class="input" name="rent" min="1" step="1000" inputmode="numeric" required [(ngModel)]="monthlyRentAmount" />
            </div>
            <div class="field">
              <label for="deposit">Depósito (COP)</label>
              <input id="deposit" type="number" class="input" name="deposit" min="0" step="1000" inputmode="numeric" [(ngModel)]="depositAmount" />
            </div>
            <div class="field">
              <label for="payday">Día de pago</label>
              <input id="payday" type="number" class="input" name="payday" min="1" max="28" [(ngModel)]="paymentDayOfMonth" />
            </div>
            @if (contractId()) {
              <div class="field">
                <label for="notice">Aviso de renovación (días)</label>
                <input id="notice" type="number" class="input" name="notice" min="1" max="180" [(ngModel)]="renewalNoticeDays" />
              </div>
            }
            <div class="field span-all">
              <label for="notes">Notas</label>
              <textarea id="notes" class="textarea" rows="3" name="notes" maxlength="1000" [(ngModel)]="notes" placeholder="Incluye parqueadero; mascotas permitidas."></textarea>
            </div>
          </div>

          @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
          <div class="form-actions">
            <a [routerLink]="contractId() ? ['/contracts', contractId()] : ['/contracts']" class="btn btn-ghost">Cancelar</a>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Guardar contrato' }}</button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .lookup { display: flex; gap: var(--s-2); }
    .lookup .input { flex: 1; }
    .tenant-found { padding: var(--s-2) var(--s-3); border: 1px solid var(--border-control); border-radius: var(--r-sm); }
    .tenant-found span { display: inline-flex; align-items: center; gap: var(--s-2); }
  `
})
export class ContractFormPage implements OnInit {
  private readonly api = inject(ProjectsApi);
  private readonly propertiesApi = inject(PropertiesApi);
  private readonly router = inject(Router);

  readonly contractId = input<string>();
  readonly properties = rxResource({
    params: () => (this.contractId() ? undefined : true),
    stream: () => this.propertiesApi.mine()
  });
  readonly loaded = signal<ContractResponse | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  propertyId = '';
  tenantEmail = '';
  readonly tenant = signal<{ id: string; displayName: string } | null>(null);
  readonly looking = signal(false);
  readonly lookupError = signal<string | null>(null);
  startDate = isoDate(new Date());
  endDate = isoDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)));
  monthlyRentAmount: number | null = null;
  depositAmount: number | null = null;
  paymentDayOfMonth: number | null = 5;
  renewalNoticeDays: number | null = null;
  notes = '';
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = computed(() => !!this.contractId());

  ngOnInit(): void {
    const id = this.contractId();
    if (!id) return;
    this.loading.set(true);
    this.api.contract(id).subscribe({
      next: (c) => {
        this.loading.set(false);
        this.loaded.set(c);
        this.startDate = c.startDate ?? '';
        this.endDate = c.endDate ?? '';
        this.monthlyRentAmount = c.monthlyRentAmount ?? null;
        this.depositAmount = c.depositAmount ?? null;
        this.paymentDayOfMonth = c.paymentDayOfMonth ?? null;
        this.renewalNoticeDays = c.renewalNoticeDays ?? null;
        this.notes = c.notes ?? '';
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      }
    });
  }

  findTenant(): void {
    this.looking.set(true);
    this.lookupError.set(null);
    this.api.findTenant(this.tenantEmail.trim()).subscribe({
      next: (tenant) => {
        this.looking.set(false);
        this.tenant.set(tenant);
      },
      error: (failure) => {
        this.looking.set(false);
        this.lookupError.set(
          failure?.status === 404
            ? 'No hay una cuenta de arrendatario activa con ese correo. Pídele que se registre como arrendatario.'
            : errorMessage(failure, 'No pudimos buscar al arrendatario.')
        );
      }
    });
  }

  save(valid: boolean): void {
    this.submitted.set(true);
    this.error.set(null);
    if (!valid || !this.monthlyRentAmount) {
      this.error.set('Revisa los campos obligatorios.');
      return;
    }
    if (this.endDate <= this.startDate) {
      this.error.set('La fecha de fin debe ser posterior a la de inicio.');
      return;
    }
    const id = this.contractId();
    if (!id && !this.tenant()) {
      this.error.set('Busca y confirma al arrendatario por su correo.');
      return;
    }
    const body = {
      startDate: this.startDate,
      endDate: this.endDate,
      monthlyRentAmount: Number(this.monthlyRentAmount),
      depositAmount: this.depositAmount ? Number(this.depositAmount) : undefined,
      paymentDayOfMonth: this.paymentDayOfMonth ? Number(this.paymentDayOfMonth) : undefined,
      notes: this.notes.trim() || undefined
    };
    this.saving.set(true);
    const call = id
      ? this.api.updateContract(id, { ...body, renewalNoticeDays: this.renewalNoticeDays ? Number(this.renewalNoticeDays) : undefined })
      : this.api.createContract({ ...body, propertyId: this.propertyId, tenantUserId: this.tenant()!.id });
    call.subscribe({
      next: (contract) => {
        this.saving.set(false);
        this.router.navigate(['/contracts', contract.id]);
      },
      error: (failure) => {
        this.saving.set(false);
        this.error.set(
          failure?.status === 409
            ? 'Ya hay un contrato vigente para ese inmueble en esas fechas.'
            : errorMessage(failure, 'No pudimos guardar el contrato.')
        );
      }
    });
  }
}
