import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ConfirmResponseDto,
  MediaPurpose,
  MediaUploadsControllerService,
  OwnPortfolioResponse,
  PieceResponse,
  PortfolioControllerService,
  PortfolioStatusResponse,
  UploadTicketDto
} from '../../../../api/generated';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private readonly mediaUploadsApi = inject(MediaUploadsControllerService);
  private readonly portfolioApi = inject(PortfolioControllerService);
  private readonly httpClient = inject(HttpClient);

  // Consulta el portafolio propio del técnico autenticado
  myPortfolio(): Observable<OwnPortfolioResponse> {
    return this.portfolioApi.myPortfolio();
  }

  // Consulta el portafolio público de cualquier técnico
  portfolioOf(fixerUserId: string): Observable<PieceResponse[]> {
    return this.portfolioApi.portfolioOf(fixerUserId);
  }

  // Valida el archivo local antes de iniciar cualquier petición al backend
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'Debes seleccionar un archivo.' };
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
      return {
        valid: false,
        error: 'Formato no permitido. Solo se admiten imágenes JPEG, PNG y WebP.'
      };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: 'El archivo excede el tamaño máximo permitido de 10 MB.'
      };
    }
    return { valid: true };
  }

  // Paso 1: Solicitar ticket de carga firmada al backend
  requestUploadTicket(file: File): Observable<UploadTicketDto> {
    return this.mediaUploadsApi.requestUpload({
      purpose: MediaPurpose.FixerPortfolio,
      contentType: file.type,
      sizeBytes: file.size
    });
  }

  // Paso 2: PUT binario directo al almacenamiento externo (MinIO/S3)
  // No se envía Authorization ni JSON; se respetan el method y headers del ticket
  uploadBinary(ticket: UploadTicketDto, file: File): Observable<HttpResponse<unknown>> {
    let headers = new HttpHeaders();
    if (ticket.headers) {
      Object.entries(ticket.headers).forEach(([k, v]) => {
        headers = headers.set(k, v);
      });
    }
    if (!headers.has('Content-Type')) {
      headers = headers.set('Content-Type', file.type);
    }

    return this.httpClient.request(ticket.method, ticket.uploadUrl, {
      body: file,
      headers,
      observe: 'response',
      responseType: 'text'
    });
  }

  // Paso 3: Confirmar la carga con el backend mediante mediaId
  confirmUpload(mediaId: string): Observable<ConfirmResponseDto> {
    return this.mediaUploadsApi.confirmUpload(mediaId);
  }

  // Paso 4: Registrar la nueva pieza en el portafolio usando mediaId
  addPiece(mediaId: string, title: string, description?: string): Observable<PieceResponse> {
    return this.portfolioApi.publish({
      mediaId,
      title,
      description: description ? description.trim() : undefined
    });
  }

  // Eliminar una pieza del portafolio
  deletePiece(pieceId: string): Observable<unknown> {
    return this.portfolioApi.deletePiece(pieceId);
  }

  // Ocultar una pieza visible
  hidePiece(pieceId: string): Observable<PieceResponse> {
    return this.portfolioApi.hide(pieceId);
  }

  // Mostrar una pieza oculta
  showPiece(pieceId: string): Observable<PieceResponse> {
    return this.portfolioApi.show(pieceId);
  }

  // Publicar portafolio completo (requiere mín. 3 piezas visibles)
  publishPortfolio(): Observable<PortfolioStatusResponse> {
    return this.portfolioApi.publishPortfolio();
  }

  // Despublicar portafolio completo
  unpublishPortfolio(): Observable<PortfolioStatusResponse> {
    return this.portfolioApi.unpublishPortfolio();
  }
}
