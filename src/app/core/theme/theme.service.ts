import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'fixrent.theme';

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

// Tema claro por defecto (DESIGN.md); el oscuro sigue la preferencia del sistema hasta que la
// persona elige uno, y esa elección se recuerda en este navegador.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly state = signal<Theme>(stored() ?? (systemPrefersDark() ? 'dark' : 'light'));

  readonly theme = this.state.asReadonly();

  constructor() {
    this.apply(this.state());
  }

  toggle(): void {
    this.set(this.state() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.state.set(theme);
    this.apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Sin almacenamiento el tema dura lo que dure la pestaña.
    }
  }

  private apply(theme: Theme): void {
    if (typeof document !== 'undefined') document.documentElement.dataset['theme'] = theme;
  }
}
