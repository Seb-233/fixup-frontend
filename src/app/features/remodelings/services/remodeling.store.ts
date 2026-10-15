import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, tap, catchError, throwError } from 'rxjs';
import {
  CreateProjectRequest,
  ProjectResponse,
  ProjectSummaryResponse,
  RemodelingControllerService
} from '../../../api/generated';

@Injectable({
  providedIn: 'root'
})
export class RemodelingStore {
  private readonly remodelingApi = inject(RemodelingControllerService);

  readonly projects = signal<ProjectSummaryResponse[]>([]);
  readonly selectedProject = signal<ProjectResponse | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  loadProjects(): Observable<ProjectSummaryResponse[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.remodelingApi.mine1('body', false, { httpHeaderAccept: 'application/json' } as never).pipe(
      tap((items) => {
        this.projects.set(items);
        this.loading.set(false);
      }),
      catchError((err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.translateError(err, 'No pudimos cargar tus remodelaciones.'));
        return of([]);
      })
    );
  }

  loadDetail(projectId: string): Observable<ProjectResponse | null> {
    this.loading.set(true);
    this.error.set(null);

    return this.remodelingApi.detail1(projectId, 'body', false, { httpHeaderAccept: 'application/json' } as never).pipe(
      tap((detail) => {
        this.selectedProject.set(detail);
        this.loading.set(false);
      }),
      catchError((err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.translateError(err, 'No pudimos cargar el detalle de la remodelación.'));
        return of(null);
      })
    );
  }

  createProject(request: CreateProjectRequest): Observable<ProjectResponse> {
    this.loading.set(true);
    this.error.set(null);

    return this.remodelingApi.create(request, 'body', false, { httpHeaderAccept: 'application/json' } as never).pipe(
      tap({
        next: (created) => {
          this.loading.set(false);
          this.selectedProject.set(created);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.translateError(err, 'No pudimos registrar la remodelación.'));
        }
      }),
      catchError((err) => throwError(() => err))
    );
  }

  clearSelectedProject(): void {
    this.selectedProject.set(null);
  }

  getRequirementInfo(requestId: string): { projectTitle: string; position: number; projectId: string } | null {
    const selected = this.selectedProject();
    if (selected?.requirements) {
      const match = selected.requirements.find((r) => r.requestId === requestId);
      if (match) {
        return { projectTitle: selected.title, position: match.position + 1, projectId: selected.id };
      }
    }
    return null;
  }

  private translateError(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 400) return 'Los datos enviados son inválidos. Revisa el formulario.';
    if (err.status === 401) return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
    if (err.status === 403) return 'No tienes autorización para realizar esta operación.';
    if (err.status === 404) return 'El recurso solicitado no fue encontrado.';
    if (err.status === 409) return 'Existe un conflicto con el estado actual del proyecto.';
    return fallback;
  }
}
