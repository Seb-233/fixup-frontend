import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { MediaService } from '../../data/media.service';
import { GeocodingCandidate, ListingType, PropertySummary, PropertyType } from '../../data/models';
import { PropertiesApi } from '../../data/properties.api';
import { CITIES, PROPERTY_TYPE, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { MapComponent, MapPoint } from '../../shared/ui/map.component';
import { PhotoPickerComponent } from '../../shared/ui/photo-picker.component';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

interface Model {
  name: string;
  address: string;
  city: string;
  neighborhood: string;
  areaM2: number | null;
  listingType: ListingType;
  propertyType: PropertyType;
  price: number | null;
  adminFee: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  stratum: number | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
}

const MAX_PHOTOS = 12;

@Component({
  selector: 'app-property-form-page',
  imports: [FormsModule, RouterLink, IconComponent, MapComponent, PhotoPickerComponent, PhotoComponent, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './property-form.page.html',
  styles: `
    .location-row { display: flex; flex-wrap: wrap; gap: var(--s-2); align-items: flex-end; }
    .candidates { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-1); }
    .candidates button { width: 100%; text-align: left; min-height: var(--tap); padding: var(--s-2) var(--s-3); border: 1px solid var(--border); border-radius: var(--r-sm); background: var(--surface); cursor: pointer; }
    .candidates button:hover { border-color: var(--border-control); }
    .existing { list-style: none; margin: 0; padding: 0; }
    .existing li { position: relative; }
    .existing button { position: absolute; top: 6px; right: 6px; min-height: 32px; width: 32px; background: var(--surface); }
  `
})
export class PropertyFormPage implements OnInit {
  private readonly api = inject(PropertiesApi);
  private readonly media = inject(MediaService);
  private readonly router = inject(Router);
  private readonly user = inject(CurrentUserStore);

  readonly propertyId = input<string>();
  readonly editing = computed(() => !!this.propertyId());
  readonly cities = CITIES;
  readonly propertyTypes = Object.entries(PROPERTY_TYPE);
  readonly maxPhotos = MAX_PHOTOS;
  private readonly picker = viewChild(PhotoPickerComponent);

  model: Model = {
    name: '',
    address: '',
    city: '',
    neighborhood: '',
    areaM2: null,
    listingType: 'RENT',
    propertyType: 'APARTMENT',
    price: null,
    adminFee: null,
    bedrooms: null,
    bathrooms: null,
    parkingSpots: null,
    stratum: null,
    description: '',
    latitude: null,
    longitude: null
  };
  publishNow = true;

  readonly loaded = signal<PropertySummary | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly existingPhotos = signal<{ mediaId: string; url: string | null }[]>([]);
  readonly newFiles = signal<File[]>([]);
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly saveStep = signal('');
  readonly error = signal<string | null>(null);
  readonly location = signal<[number, number] | null>(null);
  readonly candidates = signal<GeocodingCandidate[]>([]);
  readonly geocoding = signal(false);
  readonly geocodeError = signal<string | null>(null);

  // Delegación en una inmobiliaria (solo el propietario)
  readonly canDelegate = computed(() => this.editing() && this.user.activeRole() === 'OWNER' && this.loaded()?.ownerUserId === this.user.user()?.id);
  readonly managers = rxResource({
    params: () => (this.canDelegate() ? true : undefined),
    stream: () => this.api.managers()
  });
  managerId = '';
  readonly delegating = signal(false);
  readonly delegateMessage = signal<string | null>(null);

  readonly pin = computed<MapPoint[]>(() => {
    const loc = this.location();
    return loc ? [{ id: 'pin', lat: loc[0], lng: loc[1], title: this.model.name || 'Ubicación', highlight: true }] : [];
  });
  readonly photoSlots = computed(() => MAX_PHOTOS - this.existingPhotos().length);

  ngOnInit(): void {
    const id = this.propertyId();
    if (!id) return;
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (p) => {
        this.loaded.set(p);
        this.model = {
          name: p.name,
          address: p.address,
          city: p.city,
          neighborhood: p.neighborhood ?? '',
          areaM2: p.areaM2,
          listingType: p.listingType ?? 'RENT',
          propertyType: p.propertyType ?? 'APARTMENT',
          price: p.price ?? null,
          adminFee: p.adminFee ?? null,
          bedrooms: p.bedrooms ?? null,
          bathrooms: p.bathrooms ?? null,
          parkingSpots: p.parkingSpots ?? null,
          stratum: p.stratum ?? null,
          description: p.description ?? '',
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null
        };
        this.managerId = p.managerUserId ?? '';
        if (p.latitude != null && p.longitude != null) this.location.set([Number(p.latitude), Number(p.longitude)]);
        this.existingPhotos.set(p.photoMediaIds.map((mediaId) => ({ mediaId, url: null })));
        // Las URLs firmadas de las fotos salen del aviso; si no se puede leer, quedan como marcadores.
        this.api.listing(id).pipe(catchError(() => of(null))).subscribe((listing) => {
          if (listing) this.existingPhotos.set(listing.photos.map((photo) => ({ mediaId: photo.mediaId, url: photo.url })));
          this.loading.set(false);
        });
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      }
    });
  }

  geocode(): void {
    const query = [this.model.address, this.model.neighborhood, this.model.city].filter(Boolean).join(', ');
    if (!this.model.address || !this.model.city) {
      this.geocodeError.set('Escribe la dirección y la ciudad para ubicarla.');
      return;
    }
    this.geocoding.set(true);
    this.geocodeError.set(null);
    this.api.geocode(query).subscribe({
      next: (found) => {
        this.geocoding.set(false);
        this.candidates.set(found.slice(0, 5));
        if (!found.length) this.geocodeError.set('No encontramos esa dirección. Marca el punto haciendo clic en el mapa.');
        else if (found.length === 1) this.choose(found[0]);
      },
      error: (failure) => {
        this.geocoding.set(false);
        this.geocodeError.set(
          failure?.status === 429 || failure?.status === 503
            ? 'El servicio de mapas está ocupado. Marca el punto haciendo clic en el mapa.'
            : errorMessage(failure, 'No pudimos ubicar la dirección. Marca el punto en el mapa.')
        );
      }
    });
  }

  choose(candidate: GeocodingCandidate): void {
    this.setLocation([candidate.latitude, candidate.longitude]);
    this.candidates.set([]);
  }

  setLocation(point: [number, number]): void {
    this.location.set(point);
    this.model.latitude = Number(point[0].toFixed(6));
    this.model.longitude = Number(point[1].toFixed(6));
  }

  removeExisting(mediaId: string): void {
    this.existingPhotos.update((photos) => photos.filter((photo) => photo.mediaId !== mediaId));
  }

  save(valid: boolean): void {
    this.submitted.set(true);
    this.error.set(null);
    if (!valid) {
      this.error.set('Revisa los campos marcados.');
      return;
    }
    if (this.model.latitude == null || this.model.longitude == null) {
      this.error.set('Ubica el inmueble en el mapa antes de guardar.');
      return;
    }
    this.saving.set(true);
    const files = this.newFiles();
    this.saveStep.set(files.length ? `Subiendo ${files.length} ${files.length === 1 ? 'foto' : 'fotos'}…` : 'Guardando…');
    const uploads: Observable<string[]> = files.length ? this.media.uploadAll(files, 'PROPERTY_PHOTO') : of([]);
    uploads
      .pipe(
        switchMap((uploaded) => {
          this.saveStep.set('Guardando…');
          const photoMediaIds = [...this.existingPhotos().map((photo) => photo.mediaId), ...uploaded];
          const body = { ...this.cleanModel(), photoMediaIds };
          const id = this.propertyId();
          return id
            ? this.api.update(id, { ...body, name: this.model.name, address: this.model.address, city: this.model.city, areaM2: Number(this.model.areaM2) })
            : this.api.create({ ...body, latitude: this.model.latitude!, longitude: this.model.longitude!, publish: this.publishNow });
        })
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.picker()?.clear();
          this.router.navigate(['/properties']);
        },
        error: (failure) => {
          this.saving.set(false);
          this.error.set(errorMessage(failure, 'No pudimos guardar el inmueble. Revisa los datos e inténtalo de nuevo.'));
        }
      });
  }

  delegate(): void {
    const id = this.propertyId();
    if (!id) return;
    this.delegating.set(true);
    this.delegateMessage.set(null);
    this.api.assignManager(id, this.managerId || null).subscribe({
      next: (updated) => {
        this.delegating.set(false);
        this.loaded.set(updated);
        this.delegateMessage.set(updated.managerUserId ? 'La inmobiliaria ya puede administrar este inmueble.' : 'Quitaste la delegación.');
      },
      error: (failure) => {
        this.delegating.set(false);
        this.delegateMessage.set(errorMessage(failure, 'No pudimos cambiar la delegación.'));
      }
    });
  }

  private cleanModel() {
    const m = this.model;
    const num = (value: number | null) => (value === null || value === undefined || (value as unknown) === '' ? undefined : Number(value));
    return {
      name: m.name.trim(),
      address: m.address.trim(),
      city: m.city.trim(),
      neighborhood: m.neighborhood.trim() || undefined,
      areaM2: Number(m.areaM2),
      listingType: m.listingType,
      propertyType: m.propertyType,
      price: num(m.price),
      adminFee: num(m.adminFee),
      bedrooms: num(m.bedrooms),
      bathrooms: num(m.bathrooms),
      parkingSpots: num(m.parkingSpots),
      stratum: num(m.stratum),
      description: m.description.trim() || undefined,
      latitude: m.latitude ?? undefined,
      longitude: m.longitude ?? undefined
    };
  }
}
