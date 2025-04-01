import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InteractiveUserPanelComponent } from './interactive-user-panel.component';

describe('InteractiveUserPanelComponent', () => {
  let component: InteractiveUserPanelComponent;
  let fixture: ComponentFixture<InteractiveUserPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InteractiveUserPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InteractiveUserPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
