import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';
import { ToastController, LoadingController } from '@ionic/angular';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, AsyncValidatorFn } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { debounceTime, of, switchMap, map, firstValueFrom, catchError } from 'rxjs';
import { ContractsService } from '../../services/contracts.service';
import { ContractsStore } from '../../services/contracts.store';
import { PropertyControllerService, PropertySummary } from '../../../../api/generated';
import { CreateContractRequest, UpdateContractRequest, ContractStatus, CONTRACT_STATUS_LABELS, TenantOption, formatCurrencyCOP } from '../../models/contract.models';

function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end = group.get('endDate')?.value;
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (s >= e) {
    return { invalidRange: true };
  }
  return null;
}

function createOverlapValidator(service: ContractsService, contractId: string | null): AsyncValidatorFn {
  return (control: AbstractControl) => {
    const form = control as FormGroup;
    const propertyId = form.get('propertyId')?.value;
    const startDate = form.get('startDate')?.value;
    const endDate = form.get('endDate')?.value;

    if (!propertyId || !startDate || !endDate) {
      return of(null);
    }
    if (new Date(startDate).getTime() >= new Date(endDate).getTime()) {
      return of(null);
    }

    return service.checkOverlap(propertyId, startDate, endDate, contractId ?? undefined).pipe(
      map((overlap) => (overlap ? { dateOverlap: true } : null)),
      catchError(() => of(null))
    );
  };
}

@Component({
  selector: 'app-contract-edit',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterLink],
  templateUrl: './contract-edit.component.html',
  styleUrls: ['./contract-edit.component.scss']
})
export class ContractEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly contractsService = inject(ContractsService);
  private readonly contractsStore = inject(ContractsStore);
  private readonly propertyApi = inject(PropertyControllerService);
  private readonly toastCtrl = inject(ToastController);
  private readonly loadingCtrl = inject(LoadingController);

  readonly editingId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingId() != null);
  readonly pageTitle = computed(() => (this.isEditMode() ? 'Editar contrato' : 'Nuevo contrato'));
  readonly submitLabel = computed(() => (this.isEditMode() ? 'Guardar cambios' : 'Crear contrato'));

  readonly statusLabels = CONTRACT_STATUS_LABELS;
  readonly formatCurrencyCOP = formatCurrencyCOP;

  readonly properties = signal<PropertySummary[]>([]);
  readonly propertiesLoading = signal(true);
  readonly tenants = signal<TenantOption[]>([]);
  readonly tenantSearchTerm = signal('');
  readonly tenantListVisible = signal(false);

  readonly filteredTenants = computed(() => {
    const term = this.tenantSearchTerm().trim().toLowerCase();
    const list = this.tenants();
    if (!term) return list;
    return list.filter(
      (t) => t.displayName.toLowerCase().includes(term) || (t.email ?? '').toLowerCase().includes(term)
    );
  });

  readonly selectedTenant = computed(() => {
    const id = this.form.get('tenantUserId')?.value;
    if (!id) return null;
    return this.tenants().find((t) => t.id === id) ?? null;
  });

  readonly form: FormGroup = this.fb.group(
    {
      propertyId: ['', Validators.required],
      tenantUserId: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      monthlyRentAmount: [500000, [Validators.required, Validators.min(1)]],
      depositAmount: [0, [Validators.required, Validators.min(0)]],
      paymentDayOfMonth: [1, [Validators.required, Validators.min(1), Validators.max(28)]],
      renewalNoticeDays: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
      notes: [''],
      status: ['ACTIVE' as ContractStatus, Validators.required]
    },
    {
      validators: [dateRangeValidator],
      asyncValidators: []
    }
  );

  readonly submitting = signal(false);

  constructor() {
    effect(() => {
      const id = this.route.snapshot.paramMap.get('contractId');
      if (id) {
        this.editingId.set(id);
        this.loadExisting(id);
        this.form.addAsyncValidators(createOverlapValidator(this.contractsService, id));
      } else {
        this.form.addAsyncValidators(createOverlapValidator(this.contractsService, null));
      }
    });

    this.loadProperties();
    this.loadTenants();
  }

  private loadProperties(): void {
    this.propertiesLoading.set(true);
    this.propertyApi.listOwn('body', false, { httpHeaderAccept: 'application/json' } as never).subscribe({
      next: (props) => {
        this.properties.set(Array.isArray(props) ? props : []);
        this.propertiesLoading.set(false);
      },
      error: () => {
        this.properties.set([
          { id: 'p1', name: 'Apartamento 301 - Chapinero' },
          { id: 'p2', name: 'Casa Suba Pinar' },
          { id: 'p3', name: 'Local Comercial Zona Rosa' },
          { id: 'p4', name: 'Apartamento Cedritos' },
          { id: 'p5', name: 'Apartamento Usaquén' },
          { id: 'p6', name: 'Apartamento Kennedy' },
          { id: 'p7', name: 'Casa Barrio La Floresta' }
        ]);
        this.propertiesLoading.set(false);
      }
    });
  }

  private loadTenants(): void {
    this.contractsService.listTenants().subscribe({
      next: (data) => this.tenants.set(data)
    });
  }

  private async loadExisting(id: string): Promise<void> {
    const loading = await this.loadingCtrl.create({
      message: 'Cargando contrato…',
      spinner: 'crescent'
    });
    await loading.present();

    this.contractsService.get(id).subscribe({
      next: (c) => {
        loading.dismiss();
        if (!c) {
          this.toastCtrl.create({
            message: 'Contrato no encontrado.',
            color: 'danger',
            duration: 2500
          }).then((t) => t.present());
          this.router.navigate(['/contracts']);
          return;
        }
        this.form.patchValue({
          propertyId: c.propertyId,
          tenantUserId: c.tenantUserId,
          startDate: c.startDate,
          endDate: c.endDate,
          monthlyRentAmount: c.monthlyRentAmount,
          depositAmount: c.depositAmount,
          paymentDayOfMonth: c.paymentDayOfMonth,
          renewalNoticeDays: c.renewalNoticeDays,
          notes: c.notes ?? '',
          status: c.status
        });
      },
      error: () => {
        loading.dismiss();
        this.toastCtrl.create({
          message: 'No pudimos cargar el contrato.',
          color: 'danger',
          duration: 2500
        }).then((t) => t.present());
      }
    });
  }

  selectTenant(tenant: TenantOption): void {
    this.form.get('tenantUserId')?.setValue(tenant.id);
    this.tenantSearchTerm.set(tenant.displayName);
    this.tenantListVisible.set(false);
  }

  onTenantSearchFocus(): void {
    this.tenantListVisible.set(true);
  }

  onTenantIonChange(event: Event): void {
    const el = event.target as HTMLIonSearchbarElement;
    const value = (el?.value as string) ?? '';
    this.tenantSearchTerm.set(value);
    const match = this.filteredTenants().find(
      (t) => t.displayName.toLowerCase() === value.toLowerCase() || (t.email ?? '').toLowerCase() === value.toLowerCase()
    );
    if (match) {
      this.form.get('tenantUserId')?.setValue(match.id);
    } else {
      const exactById = this.tenants().find((t) => t.id === this.form.get('tenantUserId')?.value);
      if (!exactById || exactById.displayName !== value) {
        // don't clear if user is typing
      }
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const loading = await this.loadingCtrl.create({
      message: this.isEditMode() ? 'Guardando cambios…' : 'Creando contrato…',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const raw = this.form.getRawValue();
      let result;
      if (this.isEditMode()) {
        const body: UpdateContractRequest = {
          propertyId: raw.propertyId,
          tenantUserId: raw.tenantUserId,
          startDate: raw.startDate,
          endDate: raw.endDate,
          monthlyRentAmount: Number(raw.monthlyRentAmount),
          depositAmount: Number(raw.depositAmount),
          paymentDayOfMonth: Number(raw.paymentDayOfMonth),
          renewalNoticeDays: Number(raw.renewalNoticeDays),
          notes: raw.notes || undefined,
          status: raw.status
        };
        result = await firstValueFrom(this.contractsService.update(this.editingId()!, body));
        this.contractsStore.updateContract(result.id, result);
      } else {
        const body: CreateContractRequest = {
          propertyId: raw.propertyId,
          tenantUserId: raw.tenantUserId,
          startDate: raw.startDate,
          endDate: raw.endDate,
          monthlyRentAmount: Number(raw.monthlyRentAmount),
          depositAmount: Number(raw.depositAmount),
          paymentDayOfMonth: Number(raw.paymentDayOfMonth),
          renewalNoticeDays: Number(raw.renewalNoticeDays),
          notes: raw.notes || undefined,
          status: raw.status
        };
        result = await firstValueFrom(this.contractsService.create(body));
        this.contractsStore.addContract(result);
      }

      loading.dismiss();
      const toast = await this.toastCtrl.create({
        message: this.isEditMode() ? 'Contrato actualizado correctamente.' : 'Contrato creado correctamente.',
        color: 'success',
        duration: 2500
      });
      await toast.present();
      await this.router.navigate(['/contracts', result.id]);
    } catch {
      loading.dismiss();
      this.submitting.set(false);
      const toast = await this.toastCtrl.create({
        message: this.isEditMode() ? 'No pudimos actualizar el contrato.' : 'No pudimos crear el contrato.',
        color: 'danger',
        duration: 2500
      });
      await toast.present();
    }
  }

  cancel(): void {
    if (this.isEditMode()) {
      this.router.navigate(['/contracts', this.editingId()]);
    } else {
      this.router.navigate(['/contracts']);
    }
  }

  touchedInvalid(controlName: string): boolean {
    const c = this.form.get(controlName);
    return !!c && c.touched && c.invalid;
  }

  fc(controlName: string): AbstractControl | null {
    return this.form.get(controlName);
  }

  delayHideTenantList(ms: number = 200): void {
    setTimeout(() => this.tenantListVisible.set(false), ms);
  }

  get monthlyRentPreview(): string {
    const v = this.form.get('monthlyRentAmount')?.value;
    if (!v || Number(v) <= 0) return '';
    return formatCurrencyCOP(Number(v));
  }

  get depositPreview(): string {
    const v = this.form.get('depositAmount')?.value;
    if (!v || Number(v) < 0) return '';
    return formatCurrencyCOP(Number(v));
  }
}
