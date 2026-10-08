import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SlaBoardComponent } from './sla-board.component';
import { AdministrationSlaStore, SlaBoardRow } from '../../services/administration-sla.store';

describe('SlaBoardComponent', () => {
  let component: SlaBoardComponent;
  let fixture: ComponentFixture<SlaBoardComponent>;

  const mockRows: SlaBoardRow[] = [
    {
      id: 'req-1',
      requestId: 'req-1',
      propertyId: 'prop-1',
      city: 'Bogotá',
      specialty: 'Plumbing',
      title: 'Fuga de agua',
      slaDeadline: '2026-10-10T12:00:00Z',
      urgencyLevel: 'URGENT',
      status: 'SLA_BREACHED',
      slaState: 'BREACHED',
      remainingMinutes: -30,
      assignedFixerUserId: null,
      lastEscalationNotifiedAt: null,
      createdAt: '2026-10-06T12:00:00Z'
    }
  ];

  let storeMock: {
    rows: ReturnType<typeof signal<SlaBoardRow[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    breachedCount: ReturnType<typeof signal<number>>;
    warningCount: ReturnType<typeof signal<number>>;
    totalCount: ReturnType<typeof signal<number>>;
    load: ReturnType<typeof vi.fn>;
    acknowledge: ReturnType<typeof vi.fn>;
    reassign: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    storeMock = {
      rows: signal(mockRows),
      loading: signal(false),
      error: signal(null),
      breachedCount: signal(1),
      warningCount: signal(0),
      totalCount: signal(1),
      load: vi.fn(),
      acknowledge: vi.fn().mockReturnValue(of(undefined)),
      reassign: vi.fn().mockReturnValue(of(undefined))
    };

    await TestBed.configureTestingModule({
      imports: [
        SlaBoardComponent,
        ReactiveFormsModule
      ],
      providers: [
        provideRouter([]),
        { provide: AdministrationSlaStore, useValue: storeMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SlaBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse e invocar la carga del store en ngOnInit', () => {
    expect(component).toBeTruthy();
    expect(storeMock.load).toHaveBeenCalled();
  });

  it('debe inicializar searchControl como FormControl no nulo', () => {
    expect(component.searchControl).toBeInstanceOf(FormControl);
    expect(component.searchControl.value).toBe('');
  });

  it('debe empezar con filtro de estado ALL', () => {
    expect(component.statusFilter()).toBe('ALL');
  });

  it('setStatusFilter actualiza el filtro', () => {
    component.setStatusFilter('SLA_BREACHED');
    expect(component.statusFilter()).toBe('SLA_BREACHED');
  });

  it('onMarcarAtendido llama a acknowledge del store con el requestId real', () => {
    component.onMarcarAtendido(mockRows[0]);
    expect(storeMock.acknowledge).toHaveBeenCalledWith('req-1');
  });

  it('onReasignar no utiliza IDs ficticios si no se proporciona un UUID real', () => {
    component.onReasignar(mockRows[0]);
    expect(storeMock.reassign).not.toHaveBeenCalled();
    expect(component.actionFeedback()?.type).toBe('error');
    expect(component.actionFeedback()?.message).toContain('UUID válido');
  });

  it('onReasignar llama al store si se proporciona un UUID real', () => {
    component.onReasignar(mockRows[0], '550e8400-e29b-41d4-a716-446655440000');
    expect(storeMock.reassign).toHaveBeenCalledWith('req-1', '550e8400-e29b-41d4-a716-446655440000');
  });
});
