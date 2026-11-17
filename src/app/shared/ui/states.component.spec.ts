import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConnectivityService } from '../../core/connectivity/connectivity.service';
import { SERVER_ERROR_MESSAGE } from '../format';
import { ErrorStateComponent } from './states.component';

@Component({
  imports: [ErrorStateComponent],
  template: `<app-error [message]="message()" />`
})
class CustomMessageHost {
  readonly message = signal('El proveedor de indicadores no respondió.');
}

@Component({
  imports: [ErrorStateComponent],
  template: `<app-error />`
})
class DefaultHost {}

// Issue #54 (E2-S2-D2): si el backend respondió con un error, el texto no culpa a la conexión de la
// persona; el aviso de conexión queda solo para cuando el backend no se alcanza.
describe('ErrorStateComponent', () => {
  let connectivity: ConnectivityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    connectivity = TestBed.inject(ConnectivityService);
  });

  const render = <T>(host: new () => T): ComponentFixture<T> => {
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: ComponentFixture<unknown>) => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  it('con el backend en línea muestra el texto de falla del servidor y no menciona la conexión', () => {
    const fixture = render(DefaultHost);
    expect(text(fixture)).toContain('No pudimos cargar esta información');
    expect(text(fixture)).toContain(SERVER_ERROR_MESSAGE);
    expect(text(fixture)).not.toMatch(/conexión/i);
    expect(text(fixture)).toContain('Reintentar');
  });

  it('sin conexión con el backend muestra el aviso de conexión en lugar del de servidor', () => {
    connectivity.state.set('offline');
    const fixture = render(DefaultHost);
    expect(text(fixture)).toContain('Se perdió la conexión con el servidor');
    expect(text(fixture)).not.toContain(SERVER_ERROR_MESSAGE);
  });

  it('respeta el mensaje propio de la pantalla (p. ej. Mercado con su 503 de la API)', () => {
    const fixture = render(CustomMessageHost);
    expect(text(fixture)).toContain('El proveedor de indicadores no respondió.');
    expect(text(fixture)).not.toContain(SERVER_ERROR_MESSAGE);
  });
});
