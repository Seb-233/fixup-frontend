import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Api } from './http';
import {
  FixerProfile,
  OwnPortfolioResponse,
  PendingVerification,
  PieceResponse,
  PortfolioFeedResponse,
  ReviewResponse,
  SlaBoardItemResponse,
  Specialty,
  VerificationResponse
} from './models';

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

// Técnicos: directorio, perfil público, portafolio, verificación y revisión administrativa.
@Injectable({ providedIn: 'root' })
export class PeopleApi {
  private readonly api = inject(Api);

  directory(specialty?: string, city?: string): Observable<FixerProfile[]> {
    return this.api.get('/fixers/directory', { specialty, city });
  }

  profile(fixerUserId: string): Observable<FixerProfile> {
    return this.api.get(`/fixers/${fixerUserId}/profile`);
  }

  myProfile(): Observable<FixerProfile> {
    return this.api.get('/fixers/me/profile');
  }

  updateMyProfile(body: { city?: string; bio?: string; yearsExperience?: number | null }): Observable<FixerProfile> {
    return this.api.put('/fixers/me/profile', body);
  }

  portfolioOf(fixerUserId: string): Observable<PieceResponse[]> {
    return this.api.get(`/media/fixers/${fixerUserId}/portfolio`);
  }

  /** Ideas de remodelación: piezas públicas de todos los portafolios publicados, por páginas. */
  feed(page: number, size = 24, fixerUserIds?: readonly string[]): Observable<PortfolioFeedResponse> {
    return this.api.get('/media/portfolio/feed', { page, size, fixerUserIds: fixerUserIds?.join(',') });
  }

  myPortfolio(): Observable<OwnPortfolioResponse> {
    return this.api.get('/media/me/portfolio');
  }

  addPiece(mediaId: string, title: string, description?: string): Observable<PieceResponse> {
    return this.api.post('/media/me/portfolio/pieces', { mediaId, title, description });
  }

  removePiece(pieceId: string): Observable<void> {
    return this.api.delete(`/media/me/portfolio/pieces/${pieceId}`);
  }

  setPieceVisible(pieceId: string, visible: boolean): Observable<PieceResponse> {
    return this.api.post(`/media/me/portfolio/pieces/${pieceId}/${visible ? 'show' : 'hide'}`);
  }

  setPortfolioPublished(published: boolean): Observable<unknown> {
    return this.api.post(`/media/me/portfolio/${published ? 'publish' : 'unpublish'}`);
  }

  myVerification(): Observable<VerificationResponse> {
    return this.api.get('/fixers/me/verification');
  }

  submitDocuments(documents: { type: string; mediaId: string }[], consentVersion?: string): Observable<VerificationResponse> {
    return this.api.post('/fixers/me/verification/documents', { documents, consentVersion });
  }

  updateSpecialties(specialties: Specialty[]): Observable<VerificationResponse> {
    return this.api.post('/fixers/me/specialties', { specialties });
  }

  pendingVerifications(): Observable<PendingVerification[]> {
    return this.api.get('/fixers/verification/pending');
  }

  review(fixerUserId: string): Observable<ReviewResponse> {
    return this.api.get(`/fixers/${fixerUserId}/verification`);
  }

  approve(fixerUserId: string): Observable<unknown> {
    return this.api.post(`/fixers/${fixerUserId}/verification/approve`);
  }

  reject(fixerUserId: string, reason: string): Observable<unknown> {
    return this.api.post(`/fixers/${fixerUserId}/verification/reject`, { reason });
  }

  slaBoard(page = 0, size = 50): Observable<Page<SlaBoardItemResponse>> {
    return this.api.get('/administration/sla-board/requests', { page, size });
  }

  acknowledge(requestId: string): Observable<void> {
    return this.api.post(`/administration/sla-board/requests/${requestId}/acknowledge`);
  }

  reassign(requestId: string, fixerUserId: string): Observable<SlaBoardItemResponse> {
    return this.api.post(`/administration/sla-board/requests/${requestId}/reassign`, { fixerUserId });
  }
}
