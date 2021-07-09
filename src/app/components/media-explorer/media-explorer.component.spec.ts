import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaExplorerComponent } from './media-explorer.component';

describe('MediaExplorerComponent', () => {
  let component: MediaExplorerComponent;
  let fixture: ComponentFixture<MediaExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaExplorerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
