import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PropertyType =
  | 'APARTMENT'
  | 'HOUSE'
  | 'STORE'
  | 'OFFICE'
  | 'STUDIO'
  | 'GARAGE'
  | 'LAND';

export type PropertyStatus = 'DRAFT' | 'PUBLISHED' | 'UNLISTED' | 'DELETED';

export interface PhotoResponse {
  mediaId: string;
  readUrl: string;
  readUrlExpiresAt: string;
}

export interface Property {
  id: string;
  type: PropertyType;
  status: PropertyStatus;
  title: string;
  description: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressFloor: string | null;
  addressApartment: string | null;
  city: string;
  zone: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  surfaceM2: number | null;
  coveredSurfaceM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  coveredParkingSpots: number | null;
  hasBalcony: boolean | null;
  hasTerrace: boolean | null;
  hasGarden: boolean | null;
  hasElevator: boolean | null;
  hasPool: boolean | null;
  hasSecurity: boolean | null;
  petsAllowed: boolean | null;
  furnished: boolean | null;
  amenities: string[];
  monthlyRentSuggestion: number | null;
  monthlyCondoFee: number | null;
  photos: PhotoResponse[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  unlistedAt: string | null;
}

export interface BatchResult {
  created: Property[];
  publishedCount: number;
}

export interface PropertyPayload {
  type: PropertyType;
  title: string;
  description?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressFloor?: string;
  addressApartment?: string;
  city: string;
  zone: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  surfaceM2?: number;
  coveredSurfaceM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  coveredParkingSpots?: number;
  hasBalcony?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  hasElevator?: boolean;
  hasPool?: boolean;
  hasSecurity?: boolean;
  petsAllowed?: boolean;
  furnished?: boolean;
  amenities?: string[];
  monthlyRentSuggestion?: number;
  monthlyCondoFee?: number;
  mediaIds?: string[];
  managerUserId?: string;
}

@Injectable({ providedIn: 'root' })
export class PropertiesService {
  private readonly http = inject(HttpClient);
  private readonly apiOrigin = environment.apiOrigin;

  listMine(params?: {
    role?: 'OWNER' | 'MANAGER';
    status?: PropertyStatus;
    manager?: string;
    limit?: number;
  }): Observable<Property[]> {
    let p = new HttpParams();
    if (params?.role) p = p.set('role', params.role);
    if (params?.status) p = p.set('status', params.status);
    if (params?.manager) p = p.set('manager', params.manager);
    if (params?.limit) p = p.set('limit', String(params.limit));
    return this.http.get<Property[]>(`${this.apiOrigin}/properties/me`, { params: p });
  }

  search(params?: {
    type?: PropertyType;
    city?: string;
    zone?: string;
    minRent?: number;
    maxRent?: number;
    minBedrooms?: number;
    minBathrooms?: number;
    minSurface?: number;
    page?: number;
    size?: number;
  }): Observable<Property[]> {
    let p = new HttpParams();
    if (params?.type) p = p.set('type', params.type);
    if (params?.city) p = p.set('city', params.city);
    if (params?.zone) p = p.set('zone', params.zone);
    if (params?.minRent != null) p = p.set('minRent', String(params.minRent));
    if (params?.maxRent != null) p = p.set('maxRent', String(params.maxRent));
    if (params?.minBedrooms != null) p = p.set('minBedrooms', String(params.minBedrooms));
    if (params?.minBathrooms != null) p = p.set('minBathrooms', String(params.minBathrooms));
    if (params?.minSurface != null) p = p.set('minSurface', String(params.minSurface));
    if (params?.page) p = p.set('page', String(params.page));
    if (params?.size) p = p.set('size', String(params.size));
    return this.http.get<Property[]>(`${this.apiOrigin}/properties`, { params: p });
  }

  getById(id: string): Observable<Property> {
    return this.http.get<Property>(`${this.apiOrigin}/properties/${id}`);
  }

  publishOne(payload: PropertyPayload, opts?: { status?: PropertyStatus }): Observable<Property> {
    let p = new HttpParams();
    if (opts?.status) p = p.set('status', opts.status);
    return this.http.post<Property>(`${this.apiOrigin}/properties`, payload, { params: p });
  }

  publishBatch(items: PropertyPayload[], opts?: { status?: PropertyStatus }): Observable<BatchResult> {
    let p = new HttpParams();
    if (opts?.status) p = p.set('status', opts.status);
    return this.http.post<BatchResult>(`${this.apiOrigin}/properties/batch`, { properties: items }, { params: p });
  }

  update(id: string, payload: PropertyPayload): Observable<Property> {
    return this.http.put<Property>(`${this.apiOrigin}/properties/${id}`, payload);
  }

  unlist(id: string): Observable<Property> {
    return this.http.patch<Property>(`${this.apiOrigin}/properties/${id}/unlist`, {});
  }

  relist(id: string): Observable<Property> {
    return this.http.patch<Property>(`${this.apiOrigin}/properties/${id}/relist`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiOrigin}/properties/${id}`);
  }
}
