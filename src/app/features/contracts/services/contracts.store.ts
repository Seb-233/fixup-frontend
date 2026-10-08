import { Injectable, computed, inject, signal } from '@angular/core';
import { ContractsService } from './contracts.service';
import { ContractResponse, ContractStatus } from '../models/contract.models';

interface ActiveFilters {
  status: ContractStatus | 'ALL';
  expiringDays: number | null;
  propertyId: string | null;
}

@Injectable({ providedIn: 'root' })
export class ContractsStore {
  private readonly service = inject(ContractsService);

  readonly contracts = signal<ContractResponse[]>([]);
  readonly loading = signal(false);
  readonly activeFilters = signal<ActiveFilters>({
    status: 'ALL',
    expiringDays: null,
    propertyId: null
  });

  readonly upcomingExpirations = computed<ContractResponse[]>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 30);

    return this.contracts()
      .filter((c) => {
        if (c.status !== 'ACTIVE' && c.status !== 'RENEWED') return false;
        const end = new Date(c.endDate);
        end.setHours(0, 0, 0, 0);
        return end.getTime() <= limit.getTime();
      })
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  });

  readonly filteredContracts = computed<ContractResponse[]>(() => {
    const filters = this.activeFilters();
    let result = [...this.contracts()];

    if (filters.status !== 'ALL') {
      result = result.filter((c) => c.status === filters.status);
    }
    if (filters.propertyId) {
      result = result.filter((c) => c.propertyId === filters.propertyId);
    }
    if (filters.expiringDays != null) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const limit = new Date(now);
      limit.setDate(limit.getDate() + filters.expiringDays);
      result = result.filter((c) => {
        const end = new Date(c.endDate);
        end.setHours(0, 0, 0, 0);
        return end.getTime() >= now.getTime() && end.getTime() <= limit.getTime();
      });
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => {
        this.contracts.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadWithFilters(params: Parameters<ContractsService['list']>[0]): void {
    this.loading.set(true);
    this.service.list(params).subscribe({
      next: (data) => {
        this.contracts.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getById(id: string): ContractResponse | undefined {
    return this.contracts().find((c) => c.id === id);
  }

  setFilters(filters: Partial<ActiveFilters>): void {
    this.activeFilters.update((current) => ({ ...current, ...filters }));
  }

  resetFilters(): void {
    this.activeFilters.set({ status: 'ALL', expiringDays: null, propertyId: null });
  }

  addContract(contract: ContractResponse): void {
    this.contracts.update((list) => [contract, ...list]);
  }

  updateContract(id: string, contract: ContractResponse): void {
    this.contracts.update((list) => list.map((c) => (c.id === id ? contract : c)));
  }

  removeContract(id: string): void {
    this.contracts.update((list) => list.filter((c) => c.id !== id));
  }
}
