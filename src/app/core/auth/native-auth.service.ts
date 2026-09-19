import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { isNativePlatform } from '../config/native-platform';
import { isAuthCallbackUrl } from './native-callback';

/**
 * FR-UC-21: cierre del ciclo de autenticación dentro del contenedor Android.
 *
 * En web el navegador vuelve solo a /auth/callback. En Android la ventana de Auth0 se abre en
 * el navegador del sistema —nunca en un WebView embebido, que los proveedores de identidad
 * rechazan— y el control regresa por un deep link que esta clase escucha.
 */
@Injectable({
  providedIn: 'root'
})
export class NativeAuthService {
  private readonly auth0 = inject(Auth0Service);
  private readonly router = inject(Router);
  private listening = false;

  get enabled(): boolean {
    return isNativePlatform();
  }

  /** Abre la URL de Auth0 en el navegador del sistema. Auth0 la invoca en lugar de redirigir. */
  readonly openUrl = async (url: string): Promise<void> => {
    await Browser.open({ url, windowName: '_self' });
  };

  /**
   * Registra el escucha del deep link una sola vez. En web no hace nada, así que llamarlo desde
   * el arranque de la aplicación es seguro en las tres plataformas.
   */
  async listenForCallback(): Promise<void> {
    if (!this.enabled || this.listening) {
      return;
    }
    this.listening = true;

    await App.addListener('appUrlOpen', async ({ url }) => {
      if (!isAuthCallbackUrl(url, environment.native.appId)) {
        return;
      }

      try {
        const result = await firstValueFrom(this.auth0.handleRedirectCallback(url));
        const target = result?.appState?.target;
        await this.router.navigateByUrl(
          typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
            ? target
            : '/dashboard'
        );
      } catch {
        await this.router.navigate(['/auth/login']);
      } finally {
        // La pestaña del sistema queda encima de la aplicación hasta que se cierra a mano.
        await this.closeBrowser();
      }
    });
  }

  private async closeBrowser(): Promise<void> {
    try {
      await Browser.close();
    } catch {
      // Algunas versiones de Android ya cerraron la pestaña al disparar el deep link.
    }
  }
}
