import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';

import { CatalogQuery, PropertiesApi } from '../../data/properties.api';
import { CatalogItem, PropertySearchResult } from '../../data/models';
import { CITIES, PROPERTY_TYPE, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { MapComponent, MapPoint } from '../../shared/ui/map.component';
import { MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { PropertyCardComponent } from './property-card.component';

const PAGE_SIZE = 12;
const MAP_SIZE = 48;

interface Filters {
  q: string;
  city: string;
  listingType: string;
  propertyType: string;
  maxPrice: string;
  minBedrooms: string;
  sealOnly: boolean;
  sort: string;
}

function filtersFrom(params: Params): Filters {
  return {
    q: params['q'] ?? '',
    city: params['city'] ?? '',
    listingType: params['listingType'] ?? '',
    propertyType: params['propertyType'] ?? '',
    maxPrice: params['maxPrice'] ?? '',
    minBedrooms: params['minBedrooms'] ?? '',
    sealOnly: params['sealOnly'] === 'true',
    sort: params['sort'] ?? 'NEWEST'
  };
}

@Component({
  selector: 'app-catalog-page',
  imports: [FormsModule, RouterLink, IconComponent, MapComponent, MoneyPipe, PropertyCardComponent, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.page.html',
  styleUrl: './catalog.page.scss'
})
export class CatalogPage {
  private readonly api = inject(PropertiesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly cities = CITIES;
  readonly propertyTypes = Object.entries(PROPERTY_TYPE);
  private readonly query = toSignal(this.route.queryParams, { initialValue: {} as Params });

  readonly view = computed(() => (this.query()['view'] === 'map' ? 'map' : 'list'));
  readonly page = computed(() => Math.max(0, Number(this.query()['page'] ?? 0) || 0));
  readonly applied = computed(() => filtersFrom(this.query()));
  /** Borrador del formulario: se aplica al enviar, no con cada tecla. */
  form: Filters = filtersFrom(this.route.snapshot.queryParams);

  readonly results = rxResource({
    params: () => ({ filters: this.applied(), page: this.page(), view: this.view() }),
    stream: ({ params }) => {
      const f = params.filters;
      const query: CatalogQuery = {
        q: f.q || undefined,
        city: f.city || undefined,
        listingType: f.listingType || undefined,
        propertyType: f.propertyType || undefined,
        maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
        minBedrooms: f.minBedrooms ? Number(f.minBedrooms) : undefined,
        sealOnly: f.sealOnly,
        sort: f.sort,
        page: params.view === 'map' ? 0 : params.page,
        size: params.view === 'map' ? MAP_SIZE : PAGE_SIZE
      };
      return this.api.catalog(query);
    }
  });

  readonly points = computed<MapPoint[]>(() => {
    const near = this.nearby();
    if (near) return near.map((item) => this.point(item));
    if (!this.results.hasValue()) return [];
    return this.results.value().items.filter((item) => item.latitude != null && item.longitude != null).map((item) => this.point(item));
  });

  // Búsqueda por cercanía (FR-UC-06): ubicación del navegador y radio en kilómetros.
  readonly radiusKm = signal(3);
  readonly nearby = signal<PropertySearchResult[] | null>(null);
  readonly nearbyCenter = signal<[number, number] | null>(null);
  readonly locating = signal(false);
  readonly nearbyError = signal<string | null>(null);

  apply(): void {
    this.navigate({ ...this.form, page: null });
  }

  reset(): void {
    this.form = filtersFrom({});
    this.navigate({ ...this.form, page: null });
  }

  setView(view: 'list' | 'map'): void {
    this.router.navigate([], { queryParams: { view: view === 'map' ? 'map' : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  goToPage(page: number): void {
    this.router.navigate([], { queryParams: { page: page || null }, queryParamsHandling: 'merge' });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  openListing(id: string): void {
    this.router.navigate(['/catalog', id]);
  }

  searchNearMe(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.nearbyError.set('Este navegador no comparte la ubicación.');
      return;
    }
    this.locating.set(true);
    this.nearbyError.set(null);
    navigator.geolocation.getCurrentPosition(
      (position) => this.searchAround(position.coords.latitude, position.coords.longitude),
      () => {
        this.locating.set(false);
        this.nearbyError.set('No pudimos leer tu ubicación. Revisa el permiso del navegador o busca por ciudad.');
      },
      { timeout: 10000 }
    );
  }

  searchAround(latitude: number, longitude: number): void {
    this.locating.set(true);
    this.api.search(latitude, longitude, this.radiusKm()).subscribe({
      next: (found) => {
        this.locating.set(false);
        this.nearby.set(found);
        this.nearbyCenter.set([latitude, longitude]);
      },
      error: (failure) => {
        this.locating.set(false);
        this.nearbyError.set(errorMessage(failure, 'No pudimos buscar alrededor de ese punto.'));
      }
    });
  }

  clearNearby(): void {
    this.nearby.set(null);
    this.nearbyCenter.set(null);
  }

  private navigate(filters: Filters & { page: number | null }): void {
    const queryParams: Params = {};
    for (const [key, value] of Object.entries(filters)) {
      queryParams[key] = value === '' || value === false || (key === 'sort' && value === 'NEWEST') ? null : value;
    }
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
  }

  private point(item: CatalogItem | PropertySearchResult): MapPoint {
    return {
      id: item.id,
      lat: Number(item.latitude),
      lng: Number(item.longitude),
      title: item.name,
      detail: item.price ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(item.price) : undefined,
      highlight: item.seal
    };
  }
}

