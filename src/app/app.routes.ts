import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { PlaceholderComponent } from './shared/components/placeholder/placeholder.component';
import { PrivateShellComponent } from './layout/private-shell/private-shell.component';

// Rutas de la aplicación web y PWA de FixUp
export const routes: Routes = [
  // 1. Redirección canónica de la raíz hacia el panel principal
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },

  // 2. Rutas públicas (sin sidebar ni layout privado)
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent),
    data: { title: 'Iniciar Sesión' }
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/pages/callback/callback.component').then((m) => m.CallbackComponent),
    data: { title: 'Procesando Autenticación' }
  },
  {
    path: 'auth/loading',
    loadComponent: () =>
      import('./features/auth/pages/session-loading/session-loading.component').then(
        (m) => m.SessionLoadingComponent
      ),
    data: { title: 'Sincronizando Sesión' }
  },
  {
    path: 'auth/access-denied',
    loadComponent: () =>
      import('./features/auth/pages/access-denied/access-denied.component').then(
        (m) => m.AccessDeniedComponent
      ),
    data: { title: 'Acceso Denegado' }
  },
  {
    path: 'auth/account-restricted',
    loadComponent: () =>
      import('./features/auth/pages/account-restricted/account-restricted.component').then(
        (m) => m.AccountRestrictedComponent
      ),
    data: { title: 'Cuenta Restringida' }
  },

  // 3. Ruta autenticada para selección de rol (fuera del layout privado, protegida por authGuard)
  {
    path: 'auth/select-role',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/pages/select-role/select-role.component').then(
        (m) => m.SelectRoleComponent
      ),
    data: { title: 'Seleccionar Rol' }
  },

  // 4. Rutas privadas protegidas dentro del layout privado (encabezado, navegación y router-outlet único)
  {
    path: '',
    component: PrivateShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { title: 'Panel Principal' }
      },
      {
        path: 'properties',
        canActivate: [roleGuard],
        component: PlaceholderComponent,
        data: {
          title: 'Propiedades',
          roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN']
        }
      },
      {
        path: 'fixers',
        canActivate: [roleGuard],
        component: PlaceholderComponent,
        data: {
          title: 'Técnicos',
          roles: ['OWNER', 'FIXER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN']
        }
      },
      // FR-UC-18: solicitudes de reparación.
      // La bandeja del Fixer va antes que el detalle para que 'inbox' no se lea como un id.
      {
        path: 'requests',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/requests/pages/mine/my-requests.component').then(
            (m) => m.MyRequestsComponent
          ),
        data: {
          title: 'Mis Solicitudes',
          roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER']
        }
      },
      {
        path: 'requests/inbox',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/requests/pages/inbox/request-inbox.component').then(
            (m) => m.RequestInboxComponent
          ),
        data: {
          title: 'Solicitudes Disponibles',
          roles: ['FIXER']
        }
      },
      {
        path: 'requests/:requestId',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/requests/pages/detail/request-detail.component').then(
            (m) => m.RequestDetailComponent
          ),
        data: {
          title: 'Detalle de la Solicitud',
          roles: ['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN']
        }
      },

      // FR-UC-18: cotizaciones
      {
        path: 'quotations/me',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/quotations/pages/mine/my-quotations.component').then(
            (m) => m.MyQuotationsComponent
          ),
        data: {
          title: 'Mis Cotizaciones',
          roles: ['FIXER']
        }
      },
      {
        path: 'quotations/request/:requestId',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/quotations/pages/board/quotation-board.component').then(
            (m) => m.QuotationBoardComponent
          ),
        data: {
          title: 'Cotizaciones Recibidas',
          roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER']
        }
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/auth/pages/profile/profile.component').then((m) => m.ProfileComponent),
        data: { title: 'Mi Perfil' }
      }
    ]
  },

  // 5. Comodín
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
