import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular';
import { routes } from './app.routes';
import { authHttpInterceptorFn } from '@auth0/auth0-angular';
import { provideFixUpAuth } from './core/auth/auth.config';
import { errorInterceptor } from './core/interceptors/error.interceptor';

// Configuración global de la aplicación Angular Standalone
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authHttpInterceptorFn, errorInterceptor])),
    provideFixUpAuth(),
    provideIonicAngular({}),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
