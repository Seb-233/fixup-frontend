import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BootstrapResponse,
  RoleRequest,
  RolesResponse,
  SelectableRole,
  UserResponse
} from '../core/auth/auth.types';
import { API_ROUTES, apiUrl } from './api.routes';

// Servicio cliente HTTP para las operaciones de autenticación con el backend
@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private readonly http = inject(HttpClient);

  // Inicializa la identidad autenticada enviando un cuerpo vacío {}
  bootstrap(): Observable<BootstrapResponse> {
    return this.http.post<BootstrapResponse>(apiUrl(API_ROUTES.auth.bootstrap), {});
  }

  // Consulta los datos del usuario actual y sus roles asignados
  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(apiUrl(API_ROUTES.auth.me));
  }

  // Solicita la asignación del rol inicial aceptando únicamente OWNER, TENANT o FIXER
  selectInitialRole(role: SelectableRole): Observable<RolesResponse> {
    const body: RoleRequest = { role };
    return this.http.post<RolesResponse>(apiUrl(API_ROUTES.auth.selectRole), body);
  }
}
