import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Api } from './http';
import type { BulkImportResult, BulkValidationResult } from '../api/generated';
import {
  CatalogPage,
  GeocodingCandidate,
  ManagerOption,
  NewProperty,
  PropertyChanges,
  PropertySearchResult,
  PropertySummary,
  PublicListingView
} from './models';

export interface CatalogQuery {
  city?: string;
  listingType?: string;
  propertyType?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  minBedrooms?: number | null;
  stratum?: number | null;
  sealOnly?: boolean;
  q?: string;
  sort?: string;
  page?: number;
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class PropertiesApi {
  private readonly api = inject(Api);

  catalog(query: CatalogQuery): Observable<CatalogPage> {
    return this.api.get('/properties/catalog', { ...query, sealOnly: query.sealOnly || undefined });
  }

  listing(propertyId: string): Observable<PublicListingView> {
    return this.api.get(`/properties/${propertyId}/listing`);
  }

  mine(): Observable<PropertySummary[]> {
    return this.api.get('/properties/me');
  }

  get(propertyId: string): Observable<PropertySummary> {
    return this.api.get(`/properties/${propertyId}`);
  }

  create(body: NewProperty): Observable<PropertySummary> {
    return this.api.post('/properties', body);
  }

  update(propertyId: string, body: PropertyChanges): Observable<PropertySummary> {
    return this.api.put(`/properties/${propertyId}`, body);
  }

  publish(propertyId: string): Observable<PropertySummary> {
    return this.api.post(`/properties/${propertyId}/publish`);
  }

  unpublish(propertyId: string): Observable<PropertySummary> {
    return this.api.post(`/properties/${propertyId}/unpublish`);
  }

  managers(): Observable<ManagerOption[]> {
    return this.api.get('/properties/managers');
  }

  assignManager(propertyId: string, managerUserId: string | null): Observable<PropertySummary> {
    return this.api.put(`/properties/${propertyId}/manager`, { managerUserId });
  }

  search(latitude: number, longitude: number, radiusKm: number): Observable<PropertySearchResult[]> {
    return this.api.get('/properties/search', { latitude, longitude, radiusKm });
  }

  validateBulk(file: File): Observable<BulkValidationResult> {
    return this.api.post('/properties/bulk/validate', this.form(file));
  }

  importBulk(file: File): Observable<BulkImportResult> {
    return this.api.post('/properties/bulk/import', this.form(file));
  }

  private form(file: File): FormData {
    const data = new FormData();
    data.append('file', file, file.name);
    return data;
  }

  geocode(query: string): Observable<GeocodingCandidate[]> {
    return this.api.get('/locations/geocode', { query });
  }
}
