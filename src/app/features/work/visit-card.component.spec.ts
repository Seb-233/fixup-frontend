import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { VisitResponse } from '../../data/models';
import { VisitCardComponent } from './visit-card.component';

const OWNER = 'owner-1';
const FIXER = 'fixer-1';

function visit(overrides: Partial<VisitResponse> = {}): VisitResponse {
  return {
    id: 'v-1',
    requestId: 'r-1',
    fixerUserId: FIXER,
    fixerName: 'Jhon Fredy Cárdenas',
    ownerUserId: OWNER,
    ownerName: 'Carolina Restrepo',
    proposedByUserId: OWNER,
    proposedByName: 'Carolina Restrepo',
    kind: 'DIAGNOSTIC',
    status: 'PROPOSED',
    scheduledAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    durationMinutes: 60,
    address: 'Calle 63 # 4-25',
    checklist: [],
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

describe('VisitCardComponent', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VisitCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function render(v: VisitResponse, me: string) {
    const fixture = TestBed.createComponent(VisitCardComponent);
    fixture.componentRef.setInput('visit', v);
    fixture.componentRef.setInput('me', me);
    fixture.detectChanges();
    return fixture;
  }

  const buttons = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());

  it('quien propuso espera; la contraparte puede confirmar', () => {
    const asOwner = render(visit(), OWNER).nativeElement as HTMLElement;
    expect(buttons(asOwner)).not.toContain('Confirmar');
    expect(asOwner.textContent).toContain('Esperando que la otra parte confirme');

    const asFixer = render(visit(), FIXER).nativeElement as HTMLElement;
    expect(buttons(asFixer)).toContain('Confirmar');
  });

  it('confirmar llama al backend y emite la visita actualizada', () => {
    const fixture = render(visit(), FIXER);
    let changed: VisitResponse | undefined;
    fixture.componentInstance.changed.subscribe((v) => (changed = v));
    (Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Confirmar')) as HTMLButtonElement).click();

    const request = backend.expectOne(`${environment.apiOrigin}/visits/v-1/confirm`);
    expect(request.request.method).toBe('POST');
    request.flush(visit({ status: 'CONFIRMED' }));
    expect(changed?.status).toBe('CONFIRMED');
  });

  it('solo el técnico registra el resultado, y solo cuando la visita ya empezó', () => {
    const past = visit({ status: 'CONFIRMED', scheduledAt: new Date(Date.now() - 3600 * 1000).toISOString() });
    expect(buttons(render(past, FIXER).nativeElement)).toContain('Registrar resultado');
    expect(buttons(render(past, OWNER).nativeElement)).not.toContain('Registrar resultado');
    expect(buttons(render(visit({ status: 'CONFIRMED' }), FIXER).nativeElement)).not.toContain('Registrar resultado');
  });

  it('una visita cerrada no ofrece acciones', () => {
    expect(buttons(render(visit({ status: 'CANCELLED', cancelReason: 'Se resolvió solo' }), OWNER).nativeElement)).toEqual([]);
  });

  it('cancelar exige motivo antes de llamar al backend', () => {
    const fixture = render(visit(), OWNER);
    const component = fixture.componentInstance;
    component.start('cancel');
    component.reason = '   ';
    component.submitCancel();
    expect(component.error()).toContain('por qué');
    backend.expectNone(`${environment.apiOrigin}/visits/v-1/cancel`);

    component.reason = 'Viajo esa semana';
    component.submitCancel();
    const request = backend.expectOne(`${environment.apiOrigin}/visits/v-1/cancel`);
    expect(request.request.body).toEqual({ reason: 'Viajo esa semana' });
    request.flush(visit({ status: 'CANCELLED' }));
  });
});
