import { TestBed } from '@angular/core/testing';

import { QuizInteractiveService } from './quiz-interactive.service';

describe('QuizInteractiveService', () => {
  let service: QuizInteractiveService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuizInteractiveService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
