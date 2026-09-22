import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
  });

  it('renderiza la marca FixUp', () => {
    expect(fixture.nativeElement.textContent).toContain('FixUp');
  });

  it('ofrece CTAs hacia el login', () => {
    const links = fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>;
    const loginLinks = Array.from(links).filter((link) => link.textContent?.includes('Iniciar sesión'));

    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks.every((link) => link.getAttribute('href') === '/auth/login')).toBe(true);
  });

  it('renderiza la sección Cómo funciona', () => {
    expect(fixture.nativeElement.textContent).toContain('Cómo funciona');
    expect(fixture.nativeElement.textContent).toContain('Registra tu propiedad');
    expect(fixture.nativeElement.textContent).toContain('Reporta el problema');
    expect(fixture.nativeElement.textContent).toContain('Conecta con técnicos');
  });

  it('es independiente del shell privado y de APIs privadas', () => {
    expect(fixture.nativeElement.querySelector('app-private-shell')).toBeNull();
    expect(fixture.componentInstance.constructor.toString()).not.toContain('ControllerService');
  });
});
