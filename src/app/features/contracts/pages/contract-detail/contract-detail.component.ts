import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';
import { AlertController, ToastController } from '@ionic/angular';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ContractsStore } from '../../services/contracts.store';
import { ContractsService } from '../../services/contracts.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { ContractResponse, ContractStatus, CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS, formatCurrencyCOP, formatDate } from '../../models/contract.models';
import { Role } from '../../../../core/auth/auth.types';

const ACTION_ROLES: readonly Role[] = ['OWNER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const;

@Component({
  selector: 'app-contract-detail',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterLink],
  templateUrl: './contract-detail.component.html',
  styleUrls: ['./contract-detail.component.scss']
})
export class ContractDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(ContractsStore);
  private readonly service = inject(ContractsService);
  private readonly userStore = inject(CurrentUserStore);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  readonly contractId = signal<string | null>(null);
  readonly contract = signal<ContractResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly processing = signal(false);

  readonly canEdit = computed(() =>
    ACTION_ROLES.includes(this.userStore.activeRole() as typeof ACTION_ROLES[number])
  );

  readonly statusLabels = CONTRACT_STATUS_LABELS;
  readonly statusColors = CONTRACT_STATUS_COLORS;
  readonly formatCurrencyCOP = formatCurrencyCOP;
  readonly formatDate = formatDate;

  constructor() {
    effect(() => {
      const id = this.route.snapshot.paramMap.get('contractId');
      this.contractId.set(id);
      if (id) {
        this.load(id);
      }
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);

    const fromStore = this.store.getById(id);
    if (fromStore) {
      this.contract.set(fromStore);
      this.loading.set(false);
    }

    this.service.get(id).subscribe({
      next: (data) => {
        if (data) {
          this.contract.set(data);
          this.store.updateContract(data.id, data);
        } else {
          this.error.set('Contrato no encontrado.');
        }
        this.loading.set(false);
      },
      error: () => {
        if (!this.contract()) {
          this.error.set('No pudimos cargar el contrato. Intenta nuevamente.');
        }
        this.loading.set(false);
      }
    });
  }

  async openRenew(): Promise<void> {
    const c = this.contract();
    if (!c) return;

    const defaultEnd = new Date(c.endDate);
    defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
    const defaultIso = defaultEnd.toISOString().split('T')[0];

    const alert = await this.alertCtrl.create({
      header: 'Renovar contrato',
      message: 'Ingresa la nueva fecha de finalización.',
      inputs: [
        {
          name: 'newEndDate',
          type: 'date',
          value: defaultIso,
          min: new Date(c.endDate).toISOString().split('T')[0]
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Renovar',
          handler: (data) => {
            if (!data?.newEndDate) return false;
            this.renew(c.id, String(data.newEndDate));
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private renew(id: string, newEndDate: string): void {
    this.processing.set(true);
    this.service.renew(id, newEndDate).subscribe({
      next: (updated) => {
        this.contract.set(updated);
        this.store.updateContract(id, updated);
        this.processing.set(false);
        this.toastCtrl.create({
          message: 'Contrato renovado correctamente.',
          duration: 2500,
          color: 'success'
        }).then((t) => t.present());
      },
      error: () => {
        this.processing.set(false);
        this.toastCtrl.create({
          message: 'No pudimos renovar el contrato. Intenta nuevamente.',
          duration: 2500,
          color: 'danger'
        }).then((t) => t.present());
      }
    });
  }

  async openTerminate(): Promise<void> {
    const c = this.contract();
    if (!c) return;

    const alert = await this.alertCtrl.create({
      header: 'Terminar contrato',
      message: 'Esta acción marcará el contrato como finalizado. Ingresa el motivo.',
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Motivo de terminación',
          attributes: { rows: 4 }
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Terminar',
          role: 'destructive',
          handler: (data) => {
            const reason = (data?.reason as string)?.trim();
            if (!reason) return false;
            this.terminate(c.id, reason);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private terminate(id: string, reason: string): void {
    this.processing.set(true);
    this.service.terminate(id, reason).subscribe({
      next: (updated) => {
        this.contract.set(updated);
        this.store.updateContract(id, updated);
        this.processing.set(false);
        this.toastCtrl.create({
          message: 'Contrato terminado correctamente.',
          duration: 2500,
          color: 'success'
        }).then((t) => t.present());
      },
      error: () => {
        this.processing.set(false);
        this.toastCtrl.create({
          message: 'No pudimos terminar el contrato. Intenta nuevamente.',
          duration: 2500,
          color: 'danger'
        }).then((t) => t.present());
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/contracts']);
  }
}
