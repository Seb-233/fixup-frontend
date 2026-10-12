import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { LocationControllerService } from '../../../api/generated';
import {
  GeocodingCandidate,
  GeocodingError,
  GeocodingErrorType,
  GeocodingState
} from '../models/geocoding.models';

const DEFAULT_ATTRIBUTION = '© OpenStreetMap contributors';

@Injectable({
  providedIn: 'root'
})
export class GeocodingStore {
  private readonly locationControllerService = inject(LocationControllerService);
  private geocodeSubscription?: Subscription;

  private readonly stateSignal = signal<GeocodingState>('idle');
  private readonly candidatesSignal = signal<GeocodingCandidate[]>([]);
  private readonly selectedCandidateSignal = signal<GeocodingCandidate | null>(null);
  private readonly errorSignal = signal<GeocodingError | null>(null);
  private readonly attributionSignal = signal<string | null>(null);
  private readonly lastQuerySignal = signal<string | null>(null);

  readonly state = this.stateSignal.asReadonly();
  readonly candidates = this.candidatesSignal.asReadonly();
  readonly selectedCandidate = this.selectedCandidateSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly attribution = this.attributionSignal.asReadonly();
  readonly lastQuery = this.lastQuerySignal.asReadonly();

  readonly isGeocoding = computed(() => this.stateSignal() === 'geocoding');
  readonly errorMessage = computed(() => this.errorSignal()?.message ?? null);
  readonly errorType = computed(() => this.errorSignal()?.type ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.geocodeSubscription?.unsubscribe();
    });
  }

  geocode(rawQuery: string): void {
    const query = rawQuery?.trim();
    if (!query) {
      this.reset();
      return;
    }

    this.lastQuerySignal.set(query);
    this.stateSignal.set('geocoding');
    this.errorSignal.set(null);
    this.selectedCandidateSignal.set(null);

    this.geocodeSubscription?.unsubscribe();
    this.geocodeSubscription = this.locationControllerService
      .geocode(query, 'response')
      .subscribe({
        next: (response: HttpResponse<GeocodingCandidate[]>) => {
          const body = response.body ?? [];
          const attribution =
            response.headers?.get('X-Data-Attribution') ||
            response.headers?.get('x-data-attribution') ||
            DEFAULT_ATTRIBUTION;

          this.attributionSignal.set(attribution);

          if (body.length === 0) {
            this.candidatesSignal.set([]);
            this.stateSignal.set('empty');
          } else {
            this.candidatesSignal.set(body);
            this.stateSignal.set('candidates');
          }
        },
        error: (err: unknown) => {
          this.candidatesSignal.set([]);
          const httpError = err instanceof HttpErrorResponse ? err : null;
          const status = httpError?.status ?? (err as { status?: number })?.status;

          let type: GeocodingErrorType = 'unknown';
          let message = 'Ocurrió un error al buscar la dirección.';

          if (status === 400) {
            type = 'invalid_query';
            message = 'La dirección ingresada no es válida. Revisa el texto e intenta de nuevo.';
          } else if (status === 429) {
            type = 'rate_limit';
            message =
              'Temporalmente no se pueden realizar nuevas búsquedas de dirección. Por favor, intenta más tarde.';
          } else if (status === 503) {
            type = 'service_unavailable';
            message = 'El servicio de ubicación por dirección está temporalmente no disponible.';
          } else if (httpError?.error?.message) {
            message = httpError.error.message;
          } else if (err instanceof Error) {
            message = err.message;
          }

          this.errorSignal.set({ type, message });
          this.stateSignal.set('error');
        }
      });
  }

  selectCandidate(candidate: GeocodingCandidate): void {
    this.selectedCandidateSignal.set(candidate);
  }

  clearSelection(): void {
    this.selectedCandidateSignal.set(null);
  }

  retry(): void {
    const last = this.lastQuerySignal();
    if (last) {
      this.geocode(last);
    }
  }

  reset(): void {
    this.geocodeSubscription?.unsubscribe();
    this.stateSignal.set('idle');
    this.candidatesSignal.set([]);
    this.selectedCandidateSignal.set(null);
    this.errorSignal.set(null);
    this.attributionSignal.set(null);
    this.lastQuerySignal.set(null);
  }
}
