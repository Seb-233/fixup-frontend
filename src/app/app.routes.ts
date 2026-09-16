import { Routes } from '@angular/router';
import { PlaceholderComponent } from './shared/components/placeholder/placeholder.component';

export const routes: Routes = [
  {
    path: '',
    component: PlaceholderComponent,
    data: { title: 'Inicio' }
  },
  {
    path: 'dashboard',
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
