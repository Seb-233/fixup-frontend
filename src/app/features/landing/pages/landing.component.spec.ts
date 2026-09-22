import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LandingComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
  });

  it('renderiza la marca FixUp y el CTA de inicio de sesión', () => {
    expect(fixture.nativeElement.textContent).toContain('FixUp');
    const loginLinks = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>).filter((link) => link.textContent?.includes('Iniciar sesión'));
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks.every((link) => link.getAttribute('href') === '/auth/login')).toBe(true);
  });

  it('renderiza las secciones ancladas y la navegación del header', () => {
    const element = fixture.nativeElement as HTMLElement;
    ['inicio', 'como-funciona', 'propietarios', 'tecnicos', 'sobre-nosotros'].forEach((id) => expect(element.querySelector(`#${id}`)).toBeTruthy());
    const navLinks = Array.from(element.querySelectorAll('header nav a')).map((link) => link.getAttribute('href'));
    expect(navLinks).toEqual(['#inicio', '#como-funciona', '#propietarios', '#tecnicos', '#sobre-nosotros']);
  });

  it('explica los cuatro pasos sin el antiguo mockup dominante', () => {
    const text = fixture.nativeElement.textContent;
    ['Publica tu solicitud', 'Recibe cotizaciones', 'Elige al técnico', 'Gestiona y listo'].forEach((step) => expect(text).toContain(step));
    expect(text).not.toContain('Solicitud de servicio');
    expect(fixture.nativeElement.querySelector('.hero-panel')).toBeNull();
  });
});