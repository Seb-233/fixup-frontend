import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccessDeniedComponent } from './access-denied.component';

describe('AccessDeniedComponent', () => {
  let fixture: ComponentFixture<AccessDeniedComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccessDeniedComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(AccessDeniedComponent);
    fixture.detectChanges();
  });
  it('muestra el retorno al panel autenticado', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Acceso denegado');
    const link = Array.from(element.querySelectorAll('a')).find((item) => item.textContent?.includes('Volver al panel'));
    expect(link?.getAttribute('href')).toBe('/dashboard');
    expect(Array.from(element.querySelectorAll('a')).some((item) => item.getAttribute('href') === '/')).toBe(false);
  });
});