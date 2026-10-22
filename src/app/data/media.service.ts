import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, from, map, switchMap, toArray } from 'rxjs';
import { Api } from './http';
import { MediaPurpose, UploadTicketDto } from './models';

export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Razón legible por la que un archivo no se puede subir, o null si es válido. */
export function rejectFile(file: File): string | null {
  if (!ACCEPTED_IMAGES.split(',').includes(file.type)) {
    return `${file.name}: solo se admiten fotos JPG, PNG o WebP.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}: pesa más de 10 MB.`;
  }
  return null;
}

// Sube fotos sin que el binario pase por el backend: 1) pide un ticket firmado, 2) hace PUT directo
// al almacenamiento de objetos y 3) confirma, momento en el que el backend revisa tamaño, tipo y
// firma del archivo. Devuelve el mediaId ya confirmado, listo para adjuntar.
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly api = inject(Api);
  // Sin interceptores: la URL firmada no es del backend y no debe llevar el token de la sesión.
  private readonly bare = new HttpClient(inject(HttpBackend));

  upload(file: File, purpose: MediaPurpose): Observable<string> {
    return this.api
      .post<UploadTicketDto>('/media/uploads', { purpose, contentType: file.type, sizeBytes: file.size })
      .pipe(
        switchMap((ticket) => this.put(ticket, file).pipe(map(() => ticket.mediaId))),
        switchMap((mediaId) =>
          this.api.post<{ mediaId: string }>(`/media/uploads/${mediaId}/confirm`).pipe(map((confirmed) => confirmed.mediaId))
        )
      );
  }

  /** Sube varias fotos en orden y devuelve sus mediaId en el mismo orden. */
  uploadAll(files: File[], purpose: MediaPurpose): Observable<string[]> {
    return from(files).pipe(
      concatMap((file) => this.upload(file, purpose)),
      toArray()
    );
  }

  private put(ticket: UploadTicketDto, file: File): Observable<unknown> {
    let headers = new HttpHeaders();
    for (const [key, value] of Object.entries(ticket.headers ?? {})) headers = headers.set(key, value);
    if (!headers.has('Content-Type')) headers = headers.set('Content-Type', file.type);
    return this.bare.request(ticket.method || 'PUT', ticket.uploadUrl, { body: file, headers, responseType: 'text' });
  }
}
