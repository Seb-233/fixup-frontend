import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ContractResponse,
  CreateContractRequest,
  UpdateContractRequest,
  ListContractsParams,
  TenantOption
} from '../models/contract.models';

const API_BASE = `${environment.apiOrigin}/contracts`;

function mockNowIso(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

const MOCK_CONTRACTS: ContractResponse[] = [
  {
    id: 'c1',
    propertyId: 'p1',
    propertyName: 'Apartamento 301 - Chapinero',
    ownerUserId: 'owner1',
    tenantUserId: 't1',
    tenantDisplayName: 'Carlos Ramírez',
    startDate: mockNowIso(-365),
    endDate: mockNowIso(15),
    monthlyRentAmount: 1800000,
    depositAmount: 3600000,
    paymentDayOfMonth: 5,
    status: 'ACTIVE',
    renewalNoticeDays: 30,
    createdAt: mockNowIso(-365),
    updatedAt: mockNowIso(-1)
  },
  {
    id: 'c2',
    propertyId: 'p2',
    propertyName: 'Casa Suba Pinar',
    ownerUserId: 'owner1',
    tenantUserId: 't2',
    tenantDisplayName: 'María Fernanda López',
    startDate: mockNowIso(-200),
    endDate: mockNowIso(60),
    monthlyRentAmount: 2500000,
    depositAmount: 5000000,
    paymentDayOfMonth: 1,
    status: 'ACTIVE',
    renewalNoticeDays: 30,
    createdAt: mockNowIso(-200),
    updatedAt: mockNowIso(-3)
  },
  {
    id: 'c3',
    propertyId: 'p3',
    propertyName: 'Local Comercial Zona Rosa',
    ownerUserId: 'owner1',
    tenantUserId: 't3',
    tenantDisplayName: 'Andrés Gutiérrez',
    startDate: mockNowIso(-700),
    endDate: mockNowIso(-10),
    monthlyRentAmount: 4200000,
    depositAmount: 8400000,
    paymentDayOfMonth: 15,
    status: 'EXPIRED',
    renewalNoticeDays: 45,
    createdAt: mockNowIso(-700),
    updatedAt: mockNowIso(-10)
  },
  {
    id: 'c4',
    propertyId: 'p1',
    propertyName: 'Apartamento 301 - Chapinero',
    ownerUserId: 'owner1',
    tenantUserId: 't4',
    tenantDisplayName: 'Laura Martínez',
    startDate: mockNowIso(-30),
    endDate: mockNowIso(-5),
    monthlyRentAmount: 1600000,
    depositAmount: 3200000,
    paymentDayOfMonth: 10,
    status: 'TERMINATED',
    renewalNoticeDays: 30,
    notes: 'Terminación anticipada por acuerdo mutuo.',
    createdAt: mockNowIso(-30),
    updatedAt: mockNowIso(-5)
  },
  {
    id: 'c5',
    propertyId: 'p4',
    propertyName: 'Apartamento Cedritos',
    ownerUserId: 'owner1',
    tenantUserId: 't5',
    tenantDisplayName: 'Jorge Mendoza',
    startDate: mockNowIso(-10),
    endDate: mockNowIso(355),
    monthlyRentAmount: 2000000,
    depositAmount: 4000000,
    paymentDayOfMonth: 1,
    status: 'ACTIVE',
    renewalNoticeDays: 30,
    createdAt: mockNowIso(-10),
    updatedAt: mockNowIso(-10)
  },
  {
    id: 'c6',
    propertyId: 'p5',
    propertyName: 'Apartamento Usaquén',
    ownerUserId: 'owner1',
    tenantUserId: 't6',
    tenantDisplayName: 'Sofía Arango',
    startDate: mockNowIso(-5),
    endDate: mockNowIso(5),
    monthlyRentAmount: 2100000,
    depositAmount: 4200000,
    paymentDayOfMonth: 5,
    status: 'ACTIVE',
    renewalNoticeDays: 30,
    createdAt: mockNowIso(-5),
    updatedAt: mockNowIso(-5)
  },
  {
    id: 'c7',
    propertyId: 'p6',
    propertyName: 'Apartamento Kennedy',
    ownerUserId: 'owner1',
    tenantUserId: 't7',
    tenantDisplayName: 'Ricardo Cárdenas',
    startDate: mockNowIso(-100),
    endDate: mockNowIso(3),
    monthlyRentAmount: 1400000,
    depositAmount: 2800000,
    paymentDayOfMonth: 15,
    status: 'ACTIVE',
    renewalNoticeDays: 30,
    createdAt: mockNowIso(-100),
    updatedAt: mockNowIso(-50)
  },
  {
    id: 'c8',
    propertyId: 'p7',
    propertyName: 'Casa Barrio La Floresta',
    ownerUserId: 'owner1',
    tenantUserId: 't8',
    tenantDisplayName: 'Diana Torres',
    startDate: mockNowIso(-1),
    endDate: mockNowIso(364),
    monthlyRentAmount: 2800000,
    depositAmount: 5600000,
    paymentDayOfMonth: 1,
    status: 'DRAFT',
    renewalNoticeDays: 30,
    createdAt: mockNowIso(-1),
    updatedAt: mockNowIso(-1)
  }
];

const MOCK_TENANTS: TenantOption[] = [
  { id: 't1', displayName: 'Carlos Ramírez', email: 'carlos@example.com' },
  { id: 't2', displayName: 'María Fernanda López', email: 'maria@example.com' },
  { id: 't3', displayName: 'Andrés Gutiérrez', email: 'andres@example.com' },
  { id: 't4', displayName: 'Laura Martínez', email: 'laura@example.com' },
  { id: 't5', displayName: 'Jorge Mendoza', email: 'jorge@example.com' },
  { id: 't6', displayName: 'Sofía Arango', email: 'sofia@example.com' },
  { id: 't7', displayName: 'Ricardo Cárdenas', email: 'ricardo@example.com' },
  { id: 't8', displayName: 'Diana Torres', email: 'diana@example.com' }
];

const MOCK_DELAY = 350;

@Injectable({ providedIn: 'root' })
export class ContractsService {
  private readonly http = inject(HttpClient);
  private memoryStore = [...MOCK_CONTRACTS];

  list(params?: ListContractsParams): Observable<ContractResponse[]> {
    let result = [...this.memoryStore];

    if (params?.status) {
      result = result.filter((c) => c.status === params.status);
    }
    if (params?.propertyId) {
      result = result.filter((c) => c.propertyId === params.propertyId);
    }
    if (params?.tenantUserId) {
      result = result.filter((c) => c.tenantUserId === params.tenantUserId);
    }
    if (params?.expiringWithinDays != null) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const limit = new Date(now);
      limit.setDate(limit.getDate() + params.expiringWithinDays);
      result = result.filter((c) => {
        const end = new Date(c.endDate);
        end.setHours(0, 0, 0, 0);
        return c.status === 'ACTIVE' && end.getTime() >= now.getTime() && end.getTime() <= limit.getTime();
      });
    }

    return of(result).pipe(delay(MOCK_DELAY));
  }

  get(id: string): Observable<ContractResponse> {
    const found = this.memoryStore.find((c) => c.id === id);
    return of(found as ContractResponse).pipe(delay(MOCK_DELAY));
  }

  create(body: CreateContractRequest): Observable<ContractResponse> {
    const now = new Date().toISOString();
    const newContract: ContractResponse = {
      id: `c${Date.now()}`,
      propertyId: body.propertyId,
      propertyName: body.propertyId,
      ownerUserId: 'owner1',
      tenantUserId: body.tenantUserId,
      tenantDisplayName: MOCK_TENANTS.find((t) => t.id === body.tenantUserId)?.displayName ?? 'Inquilino',
      startDate: body.startDate,
      endDate: body.endDate,
      monthlyRentAmount: body.monthlyRentAmount,
      depositAmount: body.depositAmount,
      paymentDayOfMonth: body.paymentDayOfMonth,
      status: body.status ?? 'ACTIVE',
      renewalNoticeDays: body.renewalNoticeDays ?? 30,
      notes: body.notes,
      createdAt: now,
      updatedAt: now
    };
    this.memoryStore = [newContract, ...this.memoryStore];
    return of(newContract).pipe(delay(MOCK_DELAY));
  }

  update(id: string, body: UpdateContractRequest): Observable<ContractResponse> {
    const idx = this.memoryStore.findIndex((c) => c.id === id);
    if (idx >= 0) {
      const updated: ContractResponse = {
        ...this.memoryStore[idx],
        ...body,
        updatedAt: new Date().toISOString()
      };
      this.memoryStore[idx] = updated;
      return of(updated).pipe(delay(MOCK_DELAY));
    }
    return of(this.memoryStore[0]).pipe(delay(MOCK_DELAY));
  }

  renew(id: string, newEndDate: string): Observable<ContractResponse> {
    const idx = this.memoryStore.findIndex((c) => c.id === id);
    if (idx >= 0) {
      const now = new Date().toISOString();
      const renewed: ContractResponse = {
        ...this.memoryStore[idx],
        status: 'RENEWED',
        endDate: newEndDate,
        updatedAt: now
      };
      this.memoryStore[idx] = renewed;
      return of(renewed).pipe(delay(MOCK_DELAY));
    }
    return of(this.memoryStore[0]).pipe(delay(MOCK_DELAY));
  }

  terminate(id: string, reason: string): Observable<ContractResponse> {
    const idx = this.memoryStore.findIndex((c) => c.id === id);
    if (idx >= 0) {
      const now = new Date().toISOString();
      const terminated: ContractResponse = {
        ...this.memoryStore[idx],
        status: 'TERMINATED',
        notes: this.memoryStore[idx].notes ? `${this.memoryStore[idx].notes}\n${reason}` : reason,
        updatedAt: now
      };
      this.memoryStore[idx] = terminated;
      return of(terminated).pipe(delay(MOCK_DELAY));
    }
    return of(this.memoryStore[0]).pipe(delay(MOCK_DELAY));
  }

  expiring(days: number): Observable<ContractResponse[]> {
    return this.list({ expiringWithinDays: days });
  }

  listTenants(): Observable<TenantOption[]> {
    return of(MOCK_TENANTS).pipe(delay(MOCK_DELAY));
  }

  checkOverlap(propertyId: string, startDate: string, endDate: string, excludeContractId?: string): Observable<boolean> {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const hasOverlap = this.memoryStore.some((c) => {
      if (excludeContractId && c.id === excludeContractId) return false;
      if (c.propertyId !== propertyId) return false;
      if (c.status === 'TERMINATED') return false;
      const cStart = new Date(c.startDate).getTime();
      const cEnd = new Date(c.endDate).getTime();
      return start <= cEnd && end >= cStart;
    });
    return of(hasOverlap).pipe(delay(MOCK_DELAY));
  }
}
