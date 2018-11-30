import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { StoriesEditComponent } from './stories-edit.component';

describe('StoriesEditComponent', () => {
  let component: StoriesEditComponent;
  let fixture: ComponentFixture<StoriesEditComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [StoriesEditComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(StoriesEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
