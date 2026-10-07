import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContractEditComponent } from './contract-edit.component';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('ContractEditComponent', () => {
  let component: ContractEditComponent;
  let fixture: ComponentFixture<ContractEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContractEditComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null
              }
            },
            params: of({})
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContractEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
