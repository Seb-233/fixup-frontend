import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { Role } from '../../../../core/auth/auth.types';

/**
 * Pantalla enriquecida del perfil del usuario con estética PropTech, formulario editable y
 * gestión de roles.
 *
 * Selector de rol activo (líneas del `roles-list-interactive` más abajo, ver {@link switchRole}):
 * esta pantalla es, hoy, el único lugar de toda la aplicación donde una cuenta con más de un rol
 * puede cambiar cuál tiene activo. El mecanismo en sí — `AuthService.selectRole(role)` — ya
 * existía antes de este cambio y funciona sin llamar al backend (fija el rol activo en
 * `CurrentUserStore` y navega a `/dashboard`; no hace falta reconfirmar contra `/auth/me` porque
 * esa llamada ya trajo la lista completa de roles autorizados), pero no estaba conectado a
 * ningún control de la interfaz: `CurrentUserStore.setProfile()` siempre fija el rol activo por
 * defecto en `roles[0]` (el primero que devuelve el backend) y no había forma de elegir otro.
 * Eso dejaba varado, por ejemplo, a un PLATFORM_ADMIN que también tuviera OWNER u otro rol
 * asignado: nunca podía activar PLATFORM_ADMIN sin manipular el estado a mano desde la consola.
 * Las filas de esta lista cierran ese vacío conectando el clic del usuario con el método que ya
 * existía, en vez de construir un mecanismo nuevo.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-container">
      @if (saveMessage()) {
        <div class="save-toast" role="status">
          <svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>{{ saveMessage() }}</span>
        </div>
      }

      @if (userStore.user(); as user) {
        <!-- 1. Hero Card del Perfil con Banner y Avatar -->
        <div class="profile-hero-card">
          <div class="hero-cover-pattern" aria-hidden="true">
            <div class="cover-gradient"></div>
            <div class="cover-grid"></div>
          </div>

          <div class="hero-body">
            <div class="avatar-wrapper">
              <div class="avatar-circle">
                {{ userInitials() }}
              </div>
              <button type="button" class="btn-avatar-edit" title="Simular actualización de fotografía" aria-label="Cambiar foto de perfil">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>

            <div class="user-meta">
              <div class="name-status-row">
                <h1 class="user-full-name">{{ formDisplayName() || user.displayName || 'Usuario FixUp' }}</h1>
                <span class="status-pill" [class.active]="user.status === 'ACTIVE'">
                  <span class="status-dot"></span>
                  {{ user.status }}
                </span>
              </div>
              <p class="user-email-label">{{ user.email || 'Correo no disponible' }}</p>

              <div class="meta-badges">
                @if (userStore.activeRole(); as activeRole) {
                  <span class="role-highlight-badge">
                    <svg class="badge-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 2a1 1 0 01.894.553l2.991 5.982 6.602.959a1 1 0 01.554 1.706l-4.777 4.656 1.127 6.575a1 1 0 01-1.451 1.054L10 16.347l-5.94 3.125a1 1 0 01-1.451-1.054l1.127-6.575L-.04 11.19a1 1 0 01.554-1.706l6.602-.959 2.991-5.982A1 1 0 0110 2z" clip-rule="evenodd" />
                    </svg>
                    Rol Activo: {{ activeRole }}
                  </span>
                }
                <button type="button" class="btn-copy-id" (click)="copyId(user.id)" title="Copiar identificador interno">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  <span>{{ idCopied() ? '¡ID Copiado!' : 'ID: ' + user.id.slice(0, 13) + '...' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Formulario Interactivo Multi-Sección -->
        <div class="profile-layout-grid">
          <!-- Columna Izquierda: Formulario de Datos Personales -->
          <div class="profile-card form-section-card">
            <div class="section-heading">
              <h2 class="section-title">Información Personal</h2>
              <p class="section-subtitle">Edita tus datos de contacto y preferencias de cuenta local.</p>
            </div>

            <form class="profile-form" (ngSubmit)="saveProfile()">
              <div class="form-grid">
                <!-- Nombre para Mostrar -->
                <div class="form-field">
                  <label class="field-label" for="displayName">Nombre para Mostrar</label>
                  <div class="input-with-icon">
                    <svg class="field-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                    </svg>
                    <input
                      id="displayName"
                      name="displayName"
                      type="text"
                      class="form-input"
                      [(ngModel)]="formDisplayName"
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                </div>

                <!-- Correo Electrónico (Auth0 gestionado) -->
                <div class="form-field">
                  <label class="field-label" for="userEmail">Correo Electrónico</label>
                  <div class="input-with-icon readonly">
                    <svg class="field-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                    <input
                      id="userEmail"
                      name="userEmail"
                      type="email"
                      class="form-input readonly-input"
                      [value]="user.email || 'No disponible'"
                      disabled
                    />
                    <span class="auth0-badge" title="Verificado y gestionado por Auth0">Auth0</span>
                  </div>
                </div>

                <!-- Teléfono de Contacto -->
                <div class="form-field">
                  <label class="field-label" for="userPhone">Teléfono de Contacto</label>
                  <div class="input-with-icon">
                    <svg class="field-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    <input
                      id="userPhone"
                      name="userPhone"
                      type="tel"
                      class="form-input"
                      [(ngModel)]="formPhone"
                      placeholder="+57 300 123 4567"
                    />
                  </div>
                </div>

                <!-- Ciudad y Ubicación -->
                <div class="form-field">
                  <label class="field-label" for="userCity">Ciudad y Sector</label>
                  <div class="input-with-icon">
                    <svg class="field-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                    </svg>
                    <input
                      id="userCity"
                      name="userCity"
                      type="text"
                      class="form-input"
                      [(ngModel)]="formCity"
                      placeholder="Bogotá, Colombia"
                    />
                  </div>
                </div>
              </div>

              <!-- Biografía / Notas de Perfil -->
              <div class="form-field full-width">
                <label class="field-label" for="userBio">Biografía / Descripción del Perfil</label>
                <textarea
                  id="userBio"
                  name="userBio"
                  class="form-textarea"
                  rows="3"
                  [(ngModel)]="formBio"
                  placeholder="Describe brevemente tus propiedades, especialidad técnica o requerimientos..."
                ></textarea>
              </div>

              <!-- Barra de Acciones del Formulario -->
              <div class="form-actions">
                <button type="submit" class="btn-primary-save">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                  <span>Guardar Cambios</span>
                </button>
                <button type="button" class="btn-secondary-reset" (click)="resetForm()">
                  Restablecer
                </button>
              </div>
            </form>
          </div>

          <!-- Columna Derecha: Roles del Ecosistema y Preferencias -->
          <div class="profile-side-column">
            <!-- Tarjeta de Roles Asignados -->
            <div class="profile-card roles-card">
              <div class="section-heading">
                <h2 class="section-title">Roles del Ecosistema</h2>
                <p class="section-subtitle">Permisos y capacidades autorizadas en FixUp.</p>
              </div>

              <div class="roles-list-interactive">
                @for (role of user.roles; track role) {
                  <div
                    class="role-badge-row"
                    [class.active-role-row]="role === userStore.activeRole()"
                    [class.switchable-role-row]="role !== userStore.activeRole()"
                    [attr.role]="role !== userStore.activeRole() ? 'button' : null"
                    [attr.tabindex]="role !== userStore.activeRole() ? 0 : null"
                    [attr.title]="role !== userStore.activeRole() ? 'Cambiar al rol ' + role : null"
                    (click)="switchRole(role)"
                    (keydown.enter)="switchRole(role)"
                    (keydown.space)="switchRole(role)"
                  >
                    <div class="role-icon-box">
                      @if (role === 'OWNER') {
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                      } @else if (role === 'TENANT') {
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd" />
                        </svg>
                      } @else {
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                        </svg>
                      }
                    </div>
                    <div class="role-info">
                      <div class="role-title-row">
                        <span class="role-title">{{ role }}</span>
                        @if (role === userStore.activeRole()) {
                          <span class="active-tag">Activo</span>
                        }
                      </div>
                      <span class="role-desc">
                        @if (role === 'OWNER') {
                          Publicación de inmuebles y contratación de técnicos.
                        } @else if (role === 'TENANT') {
                          Consulta de inmuebles y reporte de solicitudes.
                        } @else if (role === 'FIXER') {
                          Cotización y ejecución de servicios técnicos Fixer.
                        } @else if (role === 'REAL_ESTATE_MANAGER') {
                          Gestión de portafolio de inmuebles y coordinación de servicios para terceros.
                        } @else if (role === 'PLATFORM_ADMIN') {
                          Administración de la plataforma: revisión de verificaciones de técnicos y gobernanza de usuarios.
                        } @else {
                          Rol de la plataforma FixUp.
                        }
                      </span>
                    </div>
                  </div>
                } @empty {
                  <p class="empty-roles">Sin roles asignados en el sistema.</p>
                }
              </div>
            </div>

            <!-- Tarjeta de Preferencias y Seguridad -->
            <div class="profile-card prefs-card">
              <div class="section-heading">
                <h2 class="section-title">Preferencias y Notificaciones</h2>
              </div>

              <div class="pref-items">
                <label class="pref-toggle">
                  <input type="checkbox" [(ngModel)]="prefEmail" />
                  <span class="toggle-slider"></span>
                  <span class="pref-label">Notificaciones de incidencias por correo</span>
                </label>

                <label class="pref-toggle">
                  <input type="checkbox" [(ngModel)]="prefSms" />
                  <span class="toggle-slider"></span>
                  <span class="pref-label">Alertas SMS para solicitudes urgentes</span>
                </label>
              </div>

              <div class="logout-section">
                <button type="button" class="btn-logout" (click)="auth.logout()">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
                  </svg>
                  <span>Cerrar sesión de FixUp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="loading-state">
          <div class="spinner"></div>
          <p class="loading-text">Cargando datos del usuario...</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
    }

    .profile-container {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .save-toast {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      border-radius: 12px;
      padding: 0.85rem 1.25rem;
      font-size: 0.9rem;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
      animation: fadeIn 0.3s ease;

      .toast-icon {
        width: 20px;
        height: 20px;
        color: #10B981;
      }
    }

    /* 1. Hero Card */
    .profile-hero-card {
      background: #FFFFFF;
      border-radius: 20px;
      border: 1px solid rgba(206, 172, 120, 0.28);
      box-shadow: 0 12px 30px -8px rgba(45, 46, 49, 0.08);
      overflow: hidden;

      .hero-cover-pattern {
        position: relative;
        height: 110px;
        background: linear-gradient(135deg, #2D2E31 0%, #1E1F22 50%, #3D3E42 100%);

        .cover-gradient {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 80% 20%, rgba(206, 172, 120, 0.35) 0%, transparent 60%);
        }

        .cover-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(206, 172, 120, 0.2) 1px, transparent 1px);
          background-size: 20px 20px;
          opacity: 0.6;
        }
      }

      .hero-body {
        padding: 0 2rem 1.75rem 2rem;
        display: flex;
        align-items: flex-start;
        gap: 1.5rem;
        position: relative;
        background: #FFFFFF;

        .avatar-wrapper {
          position: relative;
          margin-top: -48px;
          flex-shrink: 0;

          .avatar-circle {
            width: 96px;
            height: 96px;
            border-radius: 50%;
            background: linear-gradient(135deg, #CEAC78 0%, #A8864B 100%);
            color: #2D2E31;
            font-size: 2.1rem;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 4px solid #FFFFFF;
            box-shadow: 0 8px 20px rgba(45, 46, 49, 0.2);
            letter-spacing: 1px;
          }

          .btn-avatar-edit {
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: #2D2E31;
            color: #FFFFFF;
            border: 2px solid #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;

            svg { width: 15px; height: 15px; }
            &:hover { background: #CEAC78; color: #2D2E31; }
          }
        }

        .user-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding-top: 0.85rem;

          .name-status-row {
            display: flex;
            align-items: center;
            gap: 0.85rem;
            flex-wrap: wrap;

            .user-full-name {
              font-family: var(--fixup-font-heading);
              color: var(--fixup-color-primary, #2D2E31);
              font-size: 1.65rem;
              font-weight: 700;
              margin: 0;
              letter-spacing: -0.02em;
            }

            .status-pill {
              display: inline-flex;
              align-items: center;
              gap: 0.4rem;
              background: #F3F4F6;
              color: #4B5563;
              font-size: 0.75rem;
              font-weight: 700;
              padding: 0.2rem 0.65rem;
              border-radius: 20px;

              .status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #9CA3AF;
              }

              &.active {
                background: #D1FAE5;
                color: #065F46;

                .status-dot {
                  background: #10B981;
                  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
                }
              }
            }
          }

          .user-email-label {
            color: #6B7280;
            font-size: 0.9rem;
            margin: 0;
          }

          .meta-badges {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-top: 0.45rem;
            flex-wrap: wrap;

            .role-highlight-badge {
              display: inline-flex;
              align-items: center;
              gap: 0.4rem;
              background: rgba(206, 172, 120, 0.18);
              color: #8C662B;
              font-size: 0.78rem;
              font-weight: 700;
              padding: 0.3rem 0.75rem;
              border-radius: 20px;
              border: 1px solid rgba(206, 172, 120, 0.35);

              .badge-icon { width: 14px; height: 14px; }
            }

            .btn-copy-id {
              display: inline-flex;
              align-items: center;
              gap: 0.4rem;
              background: #F9FAFB;
              border: 1px solid #E5E7EB;
              color: #4B5563;
              font-size: 0.76rem;
              font-family: monospace;
              padding: 0.3rem 0.65rem;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s ease;

              svg { width: 13px; height: 13px; }
              &:hover { background: #F3F4F6; border-color: #D1D5DB; color: #1F2937; }
            }
          }
        }
      }
    }

    /* 2. Layout Grid */
    .profile-layout-grid {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 1.5rem;

      @media (max-width: 960px) {
        grid-template-columns: 1fr;
      }
    }

    .profile-card {
      background: #FFFFFF;
      border-radius: 20px;
      border: 1px solid rgba(206, 172, 120, 0.25);
      box-shadow: 0 10px 25px -8px rgba(45, 46, 49, 0.06);
      padding: 1.75rem;
    }

    .section-heading {
      margin-bottom: 1.25rem;

      .section-title {
        font-family: var(--fixup-font-heading);
        font-size: 1.25rem;
        color: var(--fixup-color-primary, #2D2E31);
        margin: 0 0 0.25rem 0;
        letter-spacing: -0.01em;
      }

      .section-subtitle {
        color: #7A756D;
        font-size: 0.84rem;
        margin: 0;
      }
    }

    /* Formulario */
    .profile-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;

      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;

        @media (max-width: 640px) {
          grid-template-columns: 1fr;
        }
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;

        &.full-width {
          grid-column: 1 / -1;
        }

        .field-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: #374151;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;

          .field-icon {
            position: absolute;
            left: 0.85rem;
            width: 17px;
            height: 17px;
            color: #9CA3AF;
            pointer-events: none;
          }

          .form-input {
            width: 100%;
            padding: 0.65rem 0.85rem 0.65rem 2.4rem;
            border: 1px solid #D1D5DB;
            border-radius: 10px;
            font-size: 0.9rem;
            color: #1F2937;
            background: #FFFFFF;
            transition: all 0.2s ease;

            &:focus {
              outline: none;
              border-color: #CEAC78;
              box-shadow: 0 0 0 3px rgba(206, 172, 120, 0.2);
            }
          }

          &.readonly {
            .readonly-input {
              background: #F9FAFB;
              color: #6B7280;
              cursor: not-allowed;
            }

            .auth0-badge {
              position: absolute;
              right: 0.75rem;
              background: #EEF2F6;
              color: #4B5563;
              font-size: 0.7rem;
              font-weight: 700;
              padding: 0.15rem 0.45rem;
              border-radius: 6px;
            }
          }
        }

        .form-textarea {
          width: 100%;
          padding: 0.65rem 0.85rem;
          border: 1px solid #D1D5DB;
          border-radius: 10px;
          font-size: 0.9rem;
          color: #1F2937;
          resize: vertical;
          font-family: inherit;
          transition: all 0.2s ease;

          &:focus {
            outline: none;
            border-color: #CEAC78;
            box-shadow: 0 0 0 3px rgba(206, 172, 120, 0.2);
          }
        }
      }

      .form-actions {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        margin-top: 0.5rem;

        .btn-primary-save {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #2D2E31 0%, #1E1F22 100%);
          color: #FFFFFF;
          border: 1px solid rgba(206, 172, 120, 0.35);
          border-radius: 10px;
          padding: 0.7rem 1.4rem;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(45, 46, 49, 0.2);
          transition: all 0.2s ease;

          svg { width: 16px; height: 16px; color: #CEAC78; }

          &:hover {
            transform: translateY(-1px);
            border-color: #CEAC78;
            box-shadow: 0 6px 16px rgba(45, 46, 49, 0.25);
          }
        }

        .btn-secondary-reset {
          background: transparent;
          border: 1px solid #D1D5DB;
          color: #4B5563;
          border-radius: 10px;
          padding: 0.7rem 1.15rem;
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            background: #F3F4F6;
            color: #1F2937;
          }
        }
      }
    }

    /* Columna Derecha */
    .profile-side-column {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .roles-list-interactive {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      .role-badge-row {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        background: #F9FAFB;
        border: 1px solid #E5E7EB;
        border-radius: 12px;
        padding: 0.75rem 1rem;
        transition: all 0.2s ease;

        &.active-role-row {
          background: rgba(206, 172, 120, 0.12);
          border-color: rgba(206, 172, 120, 0.45);
        }

        &.switchable-role-row {
          cursor: pointer;

          &:hover, &:focus-visible {
            border-color: var(--fixup-color-neutral);
            background: #F3F4F6;
          }

          &:focus-visible {
            outline: 2px solid #CEAC78;
            outline-offset: 2px;
          }
        }

        .role-icon-box {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #8C662B;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
          flex-shrink: 0;

          svg { width: 18px; height: 18px; }
        }

        .role-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;

          .role-title-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;

            .role-title {
              font-weight: 700;
              font-size: 0.88rem;
              color: #1F2937;
            }

            .active-tag {
              background: #10B981;
              color: #FFFFFF;
              font-size: 0.65rem;
              font-weight: 700;
              padding: 0.1rem 0.4rem;
              border-radius: 6px;
            }
          }

          .role-desc {
            font-size: 0.76rem;
            color: #6B7280;
            line-height: 1.3;
          }
        }
      }
    }

    /* Preferencias */
    .pref-items {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      margin-bottom: 1.25rem;

      .pref-toggle {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
        font-size: 0.84rem;
        color: #374151;

        input {
          accent-color: #CEAC78;
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
      }
    }

    .logout-section {
      padding-top: 1rem;
      border-top: 1px solid #E5E7EB;

      .btn-logout {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        background: transparent;
        border: 1px solid #FCA5A5;
        color: #DC2626;
        border-radius: 10px;
        padding: 0.65rem 1.15rem;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        justify-content: center;
        transition: all 0.2s ease;

        svg { width: 16px; height: 16px; }

        &:hover {
          background: #FEF2F2;
          border-color: #EF4444;
        }
      }
    }

    .loading-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #6B7280;

      .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid rgba(206, 172, 120, 0.2);
        border-top-color: #CEAC78;
        border-radius: 50%;
        margin: 0 auto 1rem auto;
        animation: spin 0.8s linear infinite;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ProfileComponent {
  readonly userStore = inject(CurrentUserStore);
  readonly auth = inject(AuthService);

  readonly saveMessage = signal<string | null>(null);
  readonly idCopied = signal<boolean>(false);

  // Campos de formulario editables localmente
  formDisplayName = signal<string>('');
  formPhone = signal<string>('+57 300 890 1234');
  formCity = signal<string>('Bogotá, Colombia');
  formBio = signal<string>('Usuario activo de la plataforma FixUp. Gestión de inmuebles y solicitudes técnicas.');

  // Preferencias
  prefEmail = signal<boolean>(true);
  prefSms = signal<boolean>(true);

  constructor() {
    const initialName = this.userStore.user()?.displayName || '';
    this.formDisplayName.set(initialName);
  }

  readonly userInitials = computed<string>(() => {
    const name = this.formDisplayName() || this.userStore.user()?.displayName;
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    const email = this.userStore.user()?.email;
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'FX';
  });

  saveProfile(): void {
    // Simula guardado local interactivo para esta sesión
    this.saveMessage.set('¡Cambios guardados con éxito en la sesión local!');
    setTimeout(() => {
      this.saveMessage.set(null);
    }, 4000);
  }

  resetForm(): void {
    const initialName = this.userStore.user()?.displayName || '';
    this.formDisplayName.set(initialName);
    this.formPhone.set('+57 300 890 1234');
    this.formCity.set('Bogotá, Colombia');
    this.formBio.set('Usuario activo de la plataforma FixUp. Gestión de inmuebles y solicitudes técnicas.');
    this.saveMessage.set('Valores del formulario restablecidos.');
    setTimeout(() => {
      this.saveMessage.set(null);
    }, 3000);
  }

  /**
   * Activa `role` como el rol de sesión actual, siempre que la cuenta ya lo tenga asignado (la
   * fila correspondiente solo dispara esto cuando `role !== userStore.activeRole()`, pero se
   * repite la comprobación aquí porque un manejador de clic nunca debe confiar únicamente en que
   * la plantilla lo llamó en el momento correcto).
   *
   * Delega en `AuthService.selectRole`, que ya hacía exactamente esto (fijar el rol activo y
   * navegar a `/dashboard`) desde antes de esta pantalla tener manejador de clic — el gap era
   * puramente de UI, no de lógica faltante.
   */
  switchRole(role: Role): void {
    if (role === this.userStore.activeRole()) {
      return;
    }
    this.auth.selectRole(role);
  }

  copyId(id: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(id);
    }
    this.idCopied.set(true);
    setTimeout(() => {
      this.idCopied.set(false);
    }, 2500);
  }
}
