import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { PropertySearchResult } from '../../../../api/generated';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { LocationCoordinates, LocationFailureReason } from '../../models/location.models';
import {
  GeocodingCandidate
} from '../../models/geocoding.models';
import {
  LocationSource,
  LocationUiState,
  OWNERSHIP_OPTIONS,
  PropertySearchFormValue,
  PropertySearchParameters
} from '../../models/property-search.models';
import { PropertyMapComponent } from '../../components/property-map/property-map.component';
import { PropertyResultListComponent } from '../../components/property-result-list/property-result-list.component';
import { PropertySearchFiltersComponent } from '../../components/property-search-filters/property-search-filters.component';
import { LocationService } from '../../services/location.service';
import { PropertySearchStore } from '../../services/property-search.store';
import { GeocodingStore } from '../../services/geocoding.store';

const FAILURE_MESSAGES: Record<LocationFailureReason, string> = {
  permissionDenied:
    'No tenemos permiso para acceder a tu ubicación. Puedes habilitarlo en la configuración del dispositivo o escribir una dirección.',
  positionUnavailable: 'No pudimos determinar tu ubicación. Escribe una dirección.',
  timeout:
    'Obtener tu ubicación tomó demasiado tiempo. Intenta de nuevo o escribe una dirección.',
  unsupported:
    'Este dispositivo o navegador no ofrece geolocalización. Escribe una dirección.'
};

@Component({
  selector: 'app-property-search',
  standalone: true,
  imports: [
    PropertySearchFiltersComponent,
    PropertyMapComponent,
    PropertyResultListComponent
  ],
  template: `
    <section class="search-page">
      <header>
        <h1>Explorar inmuebles</h1>
        <p>Indica una dirección o usa tu ubicación y un radio para explorar inmuebles cercanos.</p>
      </header>

      <article class="block">
        <h2>Ubicación y radio</h2>
        <app-property-search-filters
          [coordinates]="coordinates()"
          [locating]="state() === 'locating'"
          [showOwnership]="isOwner()"
          [locationSource]="locationSource()"
          [geocoding]="geocodingStore.isGeocoding()"
          [geocodingState]="geocodingStore.state()"
          [geocodingError]="geocodingStore.errorMessage()"
          [geocodingErrorType]="geocodingStore.errorType()"
          [candidates]="geocodingStore.candidates()"
          [selectedCandidate]="geocodingStore.selectedCandidate()"
          [attribution]="geocodingStore.attribution()"
          (useLocation)="requestLocation()"
          (addressEdited)="onAddressEdited($event)"
          (resolveAddress)="onResolveAddress($event)"
          (candidateSelected)="onCandidateSelected($event)"
          (retryGeocoding)="onRetryGeocoding()"
          (searchRequested)="onSearch($event)"
        />

        <p
          id="location-status"
          class="status"
          [class.status-error]="state() === 'locationError'"
          role="status"
          aria-live="polite"
        >
          {{ statusMessage() }}
        </p>

        @if (locationRequired()) {
          <p id="search-hint" class="status status-error" role="alert">
            Selecciona una ubicación válida para continuar.
          </p>
        }

        @if (searchParameters(); as parameters) {
          <p id="search-parameters" class="parameters">
            Búsqueda lista: {{ sourceLabel() }}, radio {{ parameters.radiusKm }} km{{
              ownershipLabel()
            }}.
          </p>
        }

        @if (searchStore.isSearching()) {
          <p id="search-loading" class="loading-status" role="status">
            Buscando inmuebles cercanos…
          </p>
        }

        @if (searchStore.state() === 'apiError') {
          <div id="api-error" class="api-error-block" role="alert">
            <p class="api-error-message">{{ searchStore.error() }}</p>
            <button
              type="button"
              id="search-retry"
              class="retry-button"
              (click)="searchStore.retry()"
            >
              Reintentar búsqueda
            </button>
          </div>
        }

        @if (searchStore.state() === 'success' || searchStore.state() === 'empty') {
          <div class="search-results-layout" id="search-results-layout">
            <div class="map-column">
              <app-property-map
                [results]="searchStore.results()"
                [searchCenter]="coordinates()"
                [radiusKm]="searchParameters()?.radiusKm ?? 5"
                [selectedPropertyId]="searchStore.selectedPropertyId()"
                (propertySelected)="onPropertySelected($event)"
              />
            </div>

            <div class="list-column">
              <app-property-result-list
                [results]="searchStore.results()"
                [selectedPropertyId]="searchStore.selectedPropertyId()"
                (propertySelected)="onPropertySelected($event)"
              />
            </div>
          </div>
        }
      </article>
    </section>
  `,
  styleUrls: ['./property-search.component.scss']
})
export class PropertySearchComponent {
  private readonly locationService = inject(LocationService);
  private readonly userStore = inject(CurrentUserStore);
  readonly searchStore = inject(PropertySearchStore);
  readonly geocodingStore = inject(GeocodingStore);
  private locationSubscription?: Subscription;

  readonly state = signal<LocationUiState>('idle');
  readonly failureReason = signal<LocationFailureReason | null>(null);
  readonly locationSource = signal<LocationSource>('address');
  /** Coordenadas internas de la ubicación de referencia; no se muestran al usuario. */
  readonly coordinates = signal<LocationCoordinates | null>(null);
  /** Último parámetro de búsqueda registrado en la página. */
  readonly searchParameters = signal<PropertySearchParameters | null>(null);
  /** El usuario pulsó buscar sin tener una ubicación utilizable. */
  readonly locationRequired = signal(false);

  readonly isOwner = computed(() => this.userStore.activeRole() === 'OWNER');

  readonly statusMessage = computed(() => {
    switch (this.state()) {
      case 'locating':
        return 'Obteniendo tu ubicación…';
      case 'locationReady':
        return this.locationSource() === 'gps'
          ? 'Usando tu ubicación actual.'
          : 'Usando la dirección seleccionada.';
      case 'addressPending':
        return 'Dirección escrita. Aún no se ha convertido en una ubicación válida.';
      case 'locationError': {
        const reason = this.failureReason();
        return reason ? FAILURE_MESSAGES[reason] : FAILURE_MESSAGES.positionUnavailable;
      }
      default:
        return 'Escribe una dirección o usa tu ubicación actual.';
    }
  });

  readonly sourceLabel = computed(() =>
    this.locationSource() === 'gps' ? 'ubicación actual' : 'dirección indicada'
  );

  readonly ownershipLabel = computed(() => {
    const ownership = this.searchParameters()?.ownership;
    const option = OWNERSHIP_OPTIONS.find((o) => o.value === ownership);
    return option ? `, mostrar: ${option.label}` : '';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.locationSubscription?.unsubscribe());
  }

  requestLocation(): void {
    this.locationSubscription?.unsubscribe();
    this.geocodingStore.reset();
    this.state.set('locating');
    this.failureReason.set(null);
    this.locationRequired.set(false);
    this.searchParameters.set(null);

    this.locationSubscription = this.locationService.getCurrentLocation().subscribe((result) => {
      if (result.status === 'success') {
        this.coordinates.set({ ...result.coordinates });
        this.locationSource.set('gps');
        this.state.set('locationReady');
      } else {
        this.failureReason.set(result.reason);
        this.state.set('locationError');
      }
    });
  }

  onAddressEdited(text: string): void {
    this.locationSubscription?.unsubscribe();
    this.coordinates.set(null);
    this.locationSource.set('address');
    this.failureReason.set(null);
    this.locationRequired.set(false);
    this.searchParameters.set(null);
    this.geocodingStore.reset();
    this.state.set(text.trim() ? 'addressPending' : 'idle');
    this.searchStore.reset();
  }

  onResolveAddress(query: string): void {
    this.locationSubscription?.unsubscribe();
    this.coordinates.set(null);
    this.failureReason.set(null);
    this.locationRequired.set(false);
    this.searchParameters.set(null);
    this.geocodingStore.geocode(query);
  }

  onCandidateSelected(candidate: GeocodingCandidate): void {
    this.geocodingStore.selectCandidate(candidate);
    this.coordinates.set({
      latitude: candidate.latitude,
      longitude: candidate.longitude
    });
    this.locationSource.set('address');
    this.state.set('locationReady');
    this.locationRequired.set(false);
  }

  onRetryGeocoding(): void {
    this.geocodingStore.retry();
  }

  onSearch(value: PropertySearchFormValue): void {
    const coordinates = this.coordinates();
    if (!coordinates) {
      this.searchParameters.set(null);
      this.locationRequired.set(true);
      return;
    }

    this.locationRequired.set(false);
    const ownership = this.isOwner() ? value.ownership : undefined;
    this.searchParameters.set({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      radiusKm: value.radiusKm,
      ...(ownership ? { ownership } : {})
    });

    this.searchStore.search({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      radiusKm: value.radiusKm,
      ownershipScope: this.isOwner() ? value.ownership : 'ALL'
    });
  }

  onPropertySelected(property: PropertySearchResult): void {
    this.searchStore.selectProperty(property.id);
  }
}
