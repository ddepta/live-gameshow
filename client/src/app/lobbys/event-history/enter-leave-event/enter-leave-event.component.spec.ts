import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnterLeaveEventComponent } from './enter-leave-event.component';

describe('EnterLeaveEventComponent', () => {
  let component: EnterLeaveEventComponent;
  let fixture: ComponentFixture<EnterLeaveEventComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EnterLeaveEventComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EnterLeaveEventComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
