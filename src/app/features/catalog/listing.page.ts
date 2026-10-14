import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PropertiesApi } from '../../data/properties.api';
import { LISTING_TYPE, PROPERTY_TYPE, SPECIALTY } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { MapComponent, MapPoint } from '../../shared/ui/map.component';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { DayPipe, LabelPipe, MoneyPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StarsComponent } from '../../shared/ui/stars.component';

@Component({
  selector: 'app-listing-page',
  imports: [RouterLink, IconComponent, MapComponent, PhotoComponent, StarsComponent, MoneyPipe, DayPipe, LabelPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listing.page.html',
  styleUrl: './listing.page.scss'
})
export class ListingPage {
  private readonly api = inject(PropertiesApi);
  readonly propertyId = input.required<string>();

  readonly listing = rxResource({
    params: () => this.propertyId(),
    stream: ({ params }) => this.api.listing(params)
  });

  readonly selected = signal(0);
  readonly propertyType = PROPERTY_TYPE;
  readonly listingType = LISTING_TYPE;
  readonly specialty = SPECIALTY;

  readonly photo = computed(() => {
    if (!this.listing.hasValue()) return null;
    const photos = this.listing.value().photos;
    return photos[Math.min(this.selected(), photos.length - 1)] ?? null;
  });

  readonly point = computed<MapPoint[]>(() => {
    if (!this.listing.hasValue()) return [];
    const l = this.listing.value();
    return l.latitude != null && l.longitude != null
      ? [{ id: l.id, lat: Number(l.latitude), lng: Number(l.longitude), title: l.name, highlight: l.seal.granted }]
      : [];
  });
}
