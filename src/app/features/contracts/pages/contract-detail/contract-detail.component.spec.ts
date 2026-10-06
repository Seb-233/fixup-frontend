import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContractDetailComponent } from './contract-detail.component';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('ContractDetailComponent', () => {
  let component: ContractDetailComponent;
  let fixture: ComponentFixture<ContractDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContractDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'c1'
              }
            },
            params: of({ contractId: 'c1' })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContractDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
