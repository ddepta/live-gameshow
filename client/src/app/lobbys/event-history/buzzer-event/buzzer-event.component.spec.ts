import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuzzerEventComponent } from './buzzer-event.component';

describe('BuzzerEventComponent', () => {
  let component: BuzzerEventComponent;
  let fixture: ComponentFixture<BuzzerEventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BuzzerEventComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuzzerEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
