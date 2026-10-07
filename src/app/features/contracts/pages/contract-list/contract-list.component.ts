import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';
import { ReactiveFormsModule, FormControl, FormBuilder, FormGroup } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ContractExpirationCardComponent } from '../../components/contract-expiration-card/contract-expiration-card.component';
import { PlaceholderComponent } from '../../../../shared/components/placeholder/placeholder.component';
import { ContractsStore } from '../../services/contracts.store';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import {
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  ContractStatus,
  formatCurrencyCOP,
  formatDate
} from '../../models/contract.models';
import { Role } from '../../../../core/auth/auth.types';

const CREATE_ROLES: readonly Role[] = ['OWNER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const;
const WIDGET_ROLES: readonly Role[] = ['OWNER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const;

@Component({
  selector: 'app-contract-list',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterLink,
    ContractExpirationCardComponent,
    PlaceholderComponent
  ],
  templateUrl: './contract-list.component.html',
  styleUrls: ['./contract-list.component.scss']
})
export class ContractListComponent {
  readonly store = inject(ContractsStore);
  private readonly userStore = inject(CurrentUserStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly canCreate = computed(() =>
    CREATE_ROLES.includes(this.userStore.activeRole() as typeof CREATE_ROLES[number])
  );

  readonly showWidget = computed(() =>
    WIDGET_ROLES.includes(this.userStore.activeRole() as typeof WIDGET_ROLES[number])
  );

  readonly statusFc = new FormControl<ContractStatus | 'ALL'>('ALL', { nonNullable: true });
  readonly searchFc = new FormControl<string>('', { nonNullable: true });
  readonly expiringDaysFc = new FormControl<number | null>(null, { nonNullable: false });

  readonly filterForm: FormGroup = this.fb.group({
    status: this.statusFc,
    search: this.searchFc,
    expiringDays: this.expiringDaysFc
  });

  readonly searchTerm = signal('');

  readonly filteredContracts = computed(() => {
    const base = this.store.filteredContracts();
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return base;
    return base.filter((c) => {
      const name = (c.propertyName ?? '').toLowerCase();
      const tenant = (c.tenantDisplayName ?? '').toLowerCase();
      return name.includes(term) || tenant.includes(term);
    });
  });

  readonly loading = this.store.loading;

  constructor() {
    effect(() => {
      const qp = this.route.snapshot.queryParamMap;
      const expQp = qp.get('expiringWithinDays');
      if (expQp) {
        const n = parseInt(expQp, 10);
        if (!Number.isNaN(n)) {
          this.expiringDaysFc.setValue(n);
          this.store.setFilters({ expiringDays: n });
        }
      }
    }, { allowSignalWrites: true });
  }

  applyFilters(): void {
    const status = this.statusFc.value as ContractStatus | 'ALL';
    const expDays = this.expiringDaysFc.value;
    this.searchTerm.set(this.searchFc.value);
    this.store.setFilters({
      status,
      expiringDays: expDays
    });
  }

  resetFilters(): void {
    this.statusFc.setValue('ALL');
    this.searchFc.setValue('');
    this.searchTerm.set('');
    this.expiringDaysFc.setValue(null);
    this.store.resetFilters();
  }

  readonly statusLabels = CONTRACT_STATUS_LABELS;
  readonly statusColors = CONTRACT_STATUS_COLORS;
  readonly formatCurrencyCOP = formatCurrencyCOP;
  readonly formatDate = formatDate;
}
