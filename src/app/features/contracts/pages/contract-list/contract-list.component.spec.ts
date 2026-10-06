import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContractListComponent } from './contract-list.component';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('ContractListComponent', () => {
  let component: ContractListComponent;
  let fixture: ComponentFixture<ContractListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContractListComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: () => null
              }
            },
            queryParamMap: of(new Map())
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContractListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
