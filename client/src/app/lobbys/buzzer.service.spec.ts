import { TestBed } from '@angular/core/testing';

import { BuzzerService } from './buzzer.service';

describe('BuzzerService', () => {
  let service: BuzzerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BuzzerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
