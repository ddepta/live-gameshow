import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GetLobbyCodeComponent } from './get-lobby-code.component';

describe('GetLobbyCodeComponent', () => {
  let component: GetLobbyCodeComponent;
  let fixture: ComponentFixture<GetLobbyCodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GetLobbyCodeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GetLobbyCodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
