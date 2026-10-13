import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { verifiedFixerGuard } from './core/auth/verified-fixer.guard';
import { Role } from './core/auth/auth.types';
import { ShellComponent } from './layout/shell/shell.component';

const ALL: Role[] = ['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'];
const PAYERS: Role[] = ['OWNER', 'REAL_ESTATE_MANAGER'];
const CLIENTS: Role[] = ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER'];

// Rutas de la aplicación web y PWA de Fix&Rent. Cada ruta privada declara los roles que la usan; el
// guard de rol compara contra el rol activo, no contra todos los roles de la cuenta.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Arriendos con mantenimiento resuelto',
    loadComponent: () => import('./features/landing/landing.page').then((m) => m.LandingPage)
  },
  {
    path: 'auth/login',
    title: 'Ingresar',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage)
  },
  {
    path: 'auth/callback',
    title: 'Ingresando',
    loadComponent: () => import('./features/auth/callback.page').then((m) => m.CallbackPage)
  },
  {
    path: 'auth/access-denied',
    title: 'Sin acceso',
    loadComponent: () => import('./features/auth/status.pages').then((m) => m.AccessDeniedPage)
  },
  {
    path: 'auth/account-restricted',
    title: 'Cuenta restringida',
    loadComponent: () => import('./features/auth/status.pages').then((m) => m.AccountRestrictedPage)
  },
  {
    path: 'auth/select-role',
    title: 'Elige tu rol',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/select-role.page').then((m) => m.SelectRolePage)
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [roleGuard],
    children: [
      {
        path: 'dashboard',
        title: 'Inicio',
        loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage)
      },

      // Inmuebles y catálogo (FR-UC-02, 03, 06, 12)
      {
        path: 'catalog',
        title: 'Catálogo de inmuebles',
        data: { roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage)
      },
      {
        path: 'catalog/:propertyId',
        title: 'Inmueble',
        data: { roles: ALL },
        loadComponent: () => import('./features/catalog/listing.page').then((m) => m.ListingPage)
      },
      {
        path: 'properties',
        title: 'Mis inmuebles',
        data: { roles: PAYERS },
        loadComponent: () => import('./features/properties/my-properties.page').then((m) => m.MyPropertiesPage)
      },
      {
        path: 'properties/new',
        title: 'Nuevo inmueble',
        data: { roles: PAYERS },
        loadComponent: () => import('./features/properties/property-form.page').then((m) => m.PropertyFormPage)
      },
      {
        path: 'properties/:propertyId/edit',
        title: 'Editar inmueble',
        data: { roles: PAYERS },
        loadComponent: () => import('./features/properties/property-form.page').then((m) => m.PropertyFormPage)
      },
      { path: 'properties/search', redirectTo: 'catalog' },
      // Enlaces que llegan desde notificaciones del backend
      { path: 'properties/:propertyId', redirectTo: 'catalog/:propertyId' },
      { path: 'visits/:visitId', redirectTo: 'visits' },
      { path: 'management/requests', redirectTo: 'management' },
      { path: 'fixers/:fixerUserId/profile', redirectTo: 'fixers/:fixerUserId' },
      {
        path: 'administration/properties/bulk-upload',
        title: 'Carga masiva de inmuebles',
        data: { roles: ['PLATFORM_ADMIN', 'REAL_ESTATE_MANAGER'] },
        loadComponent: () => import('./features/properties/bulk-upload.page').then((m) => m.BulkUploadPage)
      },

      // Solicitudes de reparación, cotizaciones y chat (FR-UC-17, 18, 24)
      {
        path: 'requests',
        title: 'Solicitudes',
        data: { roles: CLIENTS },
        loadComponent: () => import('./features/requests/my-requests.page').then((m) => m.MyRequestsPage)
      },
      {
        path: 'requests/new',
        title: 'Reportar un daño',
        data: { roles: CLIENTS },
        loadComponent: () => import('./features/requests/new-request.page').then((m) => m.NewRequestPage)
      },
      {
        path: 'requests/inbox',
        title: 'Solicitudes disponibles',
        data: { roles: ['FIXER'] },
        canActivate: [verifiedFixerGuard],
        loadComponent: () => import('./features/requests/inbox.page').then((m) => m.InboxPage)
      },
      {
        path: 'requests/:requestId',
        title: 'Solicitud',
        data: { roles: ALL },
        loadComponent: () => import('./features/requests/request-detail.page').then((m) => m.RequestDetailPage)
      },
      {
        path: 'requests/:requestId/messages',
        title: 'Conversación',
        data: { roles: ALL },
        loadComponent: () => import('./features/requests/chat.page').then((m) => m.ChatPage)
      },
      { path: 'quotations/request/:requestId', redirectTo: 'requests/:requestId' },
      {
        path: 'quotations/me',
        title: 'Mis cotizaciones',
        data: { roles: ['FIXER'] },
        loadComponent: () => import('./features/requests/my-quotations.page').then((m) => m.MyQuotationsPage)
      },
      {
        path: 'management',
        title: 'Mantenimiento',
        data: { roles: ['REAL_ESTATE_MANAGER'] },
        loadComponent: () => import('./features/requests/management.page').then((m) => m.ManagementPage)
      },

      // Trabajos, agenda, pagos (FR-UC-19, 20, 22 y visitas técnicas)
      {
        path: 'jobs/me',
        title: 'Mis trabajos',
        data: { roles: ['FIXER'] },
        loadComponent: () => import('./features/work/my-jobs.page').then((m) => m.MyJobsPage)
      },
      {
        path: 'jobs/:jobId',
        title: 'Trabajo',
        data: { roles: ALL },
        loadComponent: () => import('./features/work/job-detail.page').then((m) => m.JobDetailPage)
      },
      {
        path: 'visits',
        title: 'Agenda de visitas',
        data: { roles: ['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER'] },
        loadComponent: () => import('./features/work/agenda.page').then((m) => m.AgendaPage)
      },
      {
        path: 'payments',
        title: 'Pagos',
        data: { roles: PAYERS },
        loadComponent: () => import('./features/work/payments.page').then((m) => m.PaymentsPage)
      },
      {
        path: 'payments/earnings',
        title: 'Mis ingresos',
        data: { roles: ['FIXER'] },
        loadComponent: () => import('./features/work/earnings.page').then((m) => m.EarningsPage)
      },
      {
        path: 'expenses',
        title: 'Reporte de gastos',
        data: { roles: PAYERS },
        loadComponent: () => import('./features/work/expenses.page').then((m) => m.ExpensesPage)
      },

      // Técnicos (FR-UC-07, 08, 23 y perfil público)
      {
        path: 'fixers',
        title: 'Técnicos',
        data: { roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/fixers/directory.page').then((m) => m.DirectoryPage)
      },
      {
        path: 'fixers/verification',
        title: 'Verificación',
        data: { roles: ['FIXER'] },
        loadComponent: () => import('./features/fixers/verification.page').then((m) => m.VerificationPage)
      },
      {
        path: 'fixers/portfolio',
        title: 'Mi portafolio',
        data: { roles: ['FIXER'] },
        canActivate: [verifiedFixerGuard],
        loadComponent: () => import('./features/fixers/portfolio.page').then((m) => m.PortfolioPage)
      },
      {
        path: 'fixers/:fixerUserId',
        title: 'Perfil del técnico',
        data: { roles: ALL },
        loadComponent: () => import('./features/fixers/fixer-profile.page').then((m) => m.FixerProfilePage)
      },

      // Contratos y remodelaciones (FR-UC-09, 10, 01)
      {
        path: 'contracts',
        title: 'Contratos',
        data: { roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/contracts/contracts.page').then((m) => m.ContractsPage)
      },
      {
        path: 'contracts/new',
        title: 'Nuevo contrato',
        data: { roles: ['OWNER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/contracts/contract-form.page').then((m) => m.ContractFormPage)
      },
      {
        path: 'contracts/:contractId',
        title: 'Contrato',
        data: { roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/contracts/contract-detail.page').then((m) => m.ContractDetailPage)
      },
      {
        path: 'contracts/:contractId/edit',
        title: 'Editar contrato',
        data: { roles: ['OWNER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/contracts/contract-form.page').then((m) => m.ContractFormPage)
      },
      {
        path: 'remodelings',
        title: 'Remodelaciones',
        data: { roles: ['OWNER'] },
        loadComponent: () => import('./features/remodelings/remodelings.page').then((m) => m.RemodelingsPage)
      },
      {
        path: 'remodelings/new',
        title: 'Nueva remodelación',
        data: { roles: ['OWNER'] },
        loadComponent: () => import('./features/remodelings/remodeling-form.page').then((m) => m.RemodelingFormPage)
      },
      {
        path: 'remodelings/:projectId',
        title: 'Remodelación',
        data: { roles: ['OWNER', 'PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/remodelings/remodeling-detail.page').then((m) => m.RemodelingDetailPage)
      },

      // Administración de la plataforma (FR-UC-11, 23)
      {
        path: 'administration/fixer-review',
        title: 'Verificación de técnicos',
        data: { roles: ['PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/administration/fixer-review.page').then((m) => m.FixerReviewPage)
      },
      {
        path: 'administration/sla-board',
        title: 'Plazos de atención',
        data: { roles: ['PLATFORM_ADMIN'] },
        loadComponent: () => import('./features/administration/sla-board.page').then((m) => m.SlaBoardPage)
      },

      // Transversales
      {
        path: 'notifications',
        title: 'Notificaciones',
        data: { roles: ALL },
        loadComponent: () => import('./features/notifications/notifications.page').then((m) => m.NotificationsPage)
      },
      {
        path: 'analytics/market-indicators',
        title: 'Indicadores de mercado',
        data: { roles: ALL },
        loadComponent: () => import('./features/analytics/market.page').then((m) => m.MarketPage)
      },
      {
        path: 'profile',
        title: 'Mi perfil',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage)
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
