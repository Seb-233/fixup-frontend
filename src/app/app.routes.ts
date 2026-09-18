import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { PlaceholderComponent } from './shared/components/placeholder/placeholder.component';

// Rutas de la aplicación web y PWA de FixUp
export const routes: Routes = [
  {
    path: '',
    component: PlaceholderComponent,
    data: { title: 'Inicio' }
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent),
    data: { title: 'Iniciar Sesión' }
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
    path: 'auth/select-role',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/pages/select-role/select-role.component').then(
        (m) => m.SelectRoleComponent
      ),
    data: { title: 'Seleccionar Rol' }
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
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/pages/profile/profile.component').then((m) => m.ProfileComponent),
    data: { title: 'Mi Perfil' }
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    component: PlaceholderComponent,
    data: { title: 'Panel Principal' }
  },
  {
    path: 'properties',
    component: PlaceholderComponent,
    data: { title: 'Propiedades' }
  },
  {
    path: 'fixers',
    component: PlaceholderComponent,
    data: { title: 'Técnicos' }
  },
  {
    path: 'requests',
    component: PlaceholderComponent,
    data: { title: 'Solicitudes' }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
