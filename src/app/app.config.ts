import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners
} from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { provideFixUpAuth } from './core/auth/auth.config';
import { NativeAuthService } from './core/auth/native-auth.service';
import { fixupAuthInterceptor } from './core/demo/fixup-auth.interceptor';
import { connectivityInterceptor } from './core/connectivity/connectivity.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { ThemeService } from './core/theme/theme.service';
import { FixRentTitleStrategy } from './core/title.strategy';
import { provideApi } from './api/generated';
import { environment } from '../environments/environment';

// Configuración global de la aplicación Angular Standalone
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    { provide: TitleStrategy, useClass: FixRentTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([connectivityInterceptor, fixupAuthInterceptor, errorInterceptor])),
    provideFixUpAuth(),
    // El cliente de src/app/api/generated se genera desde docs/openapi.json del backend.
    provideApi(environment.apiOrigin),
    // FR-UC-21: en Android el retorno de Auth0 llega por deep link. En web no registra nada.
    provideAppInitializer(() => inject(NativeAuthService).listenForCallback()),
    provideAppInitializer(() => {
      inject(ThemeService);
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
