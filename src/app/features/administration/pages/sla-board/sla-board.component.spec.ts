import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideRouter, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { SlaBoardComponent } from './sla-board.component';
import { PlaceholderComponent } from '../../../../shared/components/placeholder/placeholder.component';
import { SlaTimerComponent } from '../../../../shared/components/sla-timer/sla-timer.component';
import { AdministrationSlaStore } from '../../services/administration-sla.store';

describe('SlaBoardComponent', () => {
  let component: SlaBoardComponent;
  let fixture: ComponentFixture<SlaBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SlaBoardComponent,
        IonicModule.forRoot(),
        ReactiveFormsModule,
        PlaceholderComponent,
        SlaTimerComponent,
        RouterLink
      ],
      providers: [
        provideRouter([]),
        {
          provide: AdministrationSlaStore,
          useFactory: () => {
            const store = {
              rows: jasmine.createSpy('rows').and.returnValue([]),
              loading: jasmine.createSpy('loading').and.returnValue(false),
              error: jasmine.createSpy('error').and.returnValue(null),
              breachedCount: jasmine.createSpy('breachedCount').and.returnValue(0),
              warningCount: jasmine.createSpy('warningCount').and.returnValue(0),
              setRows: jasmine.createSpy('setRows'),
              setLoading: jasmine.createSpy('setLoading'),
              setError: jasmine.createSpy('setError'),
              markAttended: jasmine.createSpy('markAttended'),
              reassign: jasmine.createSpy('reassign')
            };
            return store as unknown as AdministrationSlaStore;
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SlaBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
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
});
