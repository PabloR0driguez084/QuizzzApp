import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyquizzPage } from './myquizz.page';

describe('MyquizzPage', () => {
  let component: MyquizzPage;
  let fixture: ComponentFixture<MyquizzPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(MyquizzPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
