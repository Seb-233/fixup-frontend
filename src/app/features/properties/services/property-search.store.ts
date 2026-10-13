import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { PropertyControllerService, PropertySearchResult } from '../../../api/generated';
import { OwnershipScope, PropertySearchUiState } from '../models/property-search.models';

export interface PropertySearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  ownershipScope?: OwnershipScope;
  /** Alias de conveniencia para la UI */
  ownership?: OwnershipScope;
}

@Injectable({
  providedIn: 'root'
})
export class PropertySearchStore {
  private readonly propertyControllerService = inject(PropertyControllerService);
  private searchSubscription?: Subscription;

  private readonly stateSignal = signal<PropertySearchUiState>('idle');
  private readonly resultsSignal = signal<PropertySearchResult[]>([]);
  private readonly errorSignal = signal<string | null>(null);
  private readonly lastParamsSignal = signal<PropertySearchParams | null>(null);
  private readonly selectedPropertyIdSignal = signal<string | null>(null);

  readonly state = this.stateSignal.asReadonly();
  readonly results = this.resultsSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly lastParams = this.lastParamsSignal.asReadonly();
  readonly selectedPropertyId = this.selectedPropertyIdSignal.asReadonly();

  readonly selectedProperty = computed(() => {
    const id = this.selectedPropertyIdSignal();
    if (!id) return null;
    return this.resultsSignal().find((p) => p.id === id) ?? null;
  });

  readonly isSearching = computed(() => this.stateSignal() === 'searching');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.searchSubscription?.unsubscribe();
    });
  }

  search(params: PropertySearchParams): void {
    const scope = params.ownershipScope ?? params.ownership;
    const normalizedParams: PropertySearchParams = {
      latitude: params.latitude,
      longitude: params.longitude,
      radiusKm: params.radiusKm,
      ...(scope ? { ownershipScope: scope } : {})
    };

    this.lastParamsSignal.set(normalizedParams);
    this.stateSignal.set('searching');
    this.errorSignal.set(null);

    this.searchSubscription?.unsubscribe();
    this.searchSubscription = this.propertyControllerService
      .search(
        String(normalizedParams.latitude),
        String(normalizedParams.longitude),
        String(normalizedParams.radiusKm),
        normalizedParams.ownershipScope
      )
      .subscribe({
        next: (results) => {
          const list = results ?? [];
          this.resultsSignal.set(list);
          this.stateSignal.set(list.length === 0 ? 'empty' : 'success');
        },
        error: (err) => {
          const message =
            err?.error?.message ?? err?.message ?? 'No pudimos consultar las propiedades cercanas.';
          this.errorSignal.set(message);
          this.stateSignal.set('apiError');
        }
      });
  }

  retry(): void {
    const last = this.lastParamsSignal();
    if (last) {
      this.search(last);
    }
  }

  selectProperty(id: string | null): void {
    this.selectedPropertyIdSignal.set(id);
  }

  reset(): void {
    this.searchSubscription?.unsubscribe();
    this.stateSignal.set('idle');
    this.resultsSignal.set([]);
    this.errorSignal.set(null);
    this.lastParamsSignal.set(null);
    this.selectedPropertyIdSignal.set(null);
  }
}
