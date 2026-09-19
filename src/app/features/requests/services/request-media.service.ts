import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ConfirmResponseDto,
  MediaPurpose,
  MediaUploadsControllerService,
  UploadTicketDto
} from '../../../api/generated';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  AllowedPhotoMimeType,
  MAX_FILE_SIZE_BYTES
} from '../utils/request-ui.helpers';

@Injectable({
  providedIn: 'root'
})
export class RequestMediaService {
  private readonly mediaUploadsApi = inject(MediaUploadsControllerService);
  private readonly httpClient = inject(HttpClient);

  validateFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'Debes seleccionar un archivo.' };
    }
    if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type as AllowedPhotoMimeType)) {
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

  requestUploadTicket(file: File): Observable<UploadTicketDto> {
    return this.mediaUploadsApi.requestUpload({
      purpose: MediaPurpose.RepairRequest,
      contentType: file.type,
      sizeBytes: file.size
    });
  }

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

    return this.httpClient.request(ticket.method || 'PUT', ticket.uploadUrl, {
      body: file,
      headers,
      observe: 'response',
      responseType: 'text'
    });
  }

  confirmUpload(mediaId: string): Observable<ConfirmResponseDto> {
    return this.mediaUploadsApi.confirmUpload(mediaId);
  }
}
