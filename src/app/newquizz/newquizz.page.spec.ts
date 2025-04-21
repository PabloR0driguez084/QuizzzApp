import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NewquizzPage } from './newquizz.page';

describe('NewquizzPage', () => {
  let component: NewquizzPage;
  let fixture: ComponentFixture<NewquizzPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(NewquizzPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
