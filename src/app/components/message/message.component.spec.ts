import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { MessageComponent } from './message.component';
import { MessageService } from 'src/app/services/message.service';
import { AuthService } from 'src/app/services/auth.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { ArrayService } from 'src/app/services/array.service';
import { RoutingService } from 'src/app/services/routing.service';

@Component({ selector: 'app-test-message', template: '', standalone: false })
class TestMessageComponent extends MessageComponent {}

describe('MessageComponent', () => {
  let messages$: BehaviorSubject<unknown[]>;
  let loaded$: BehaviorSubject<boolean>;
  let errors$: Subject<void>;
  let retryMessages: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    messages$ = new BehaviorSubject<unknown[]>([]);
    loaded$ = new BehaviorSubject<boolean>(false);
    errors$ = new Subject<void>();
    retryMessages = vi.fn();

    await TestBed.configureTestingModule({
      declarations: [TestMessageComponent],
      providers: [
        {
          provide: MessageService,
          useValue: {
            messagesObservable: messages$.asObservable(),
            messagesLoaded$: loaded$.asObservable(),
            messagesError$: errors$.asObservable(),
            retryMessages,
            filterByType: (messages: unknown[]) => messages,
          },
        },
        { provide: AuthService, useValue: { userObservable: of({ id: 'u1' }) } },
        { provide: AnalyticsService, useValue: { logEvent: () => undefined } },
        { provide: ArrayService, useValue: {} },
        { provide: RoutingService, useValue: { clearQueryParams: () => undefined } },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
      ],
    }).compileComponents();
  });

  it('clears loading on an empty first read once the loaded signal resolves', () => {
    const fixture = TestBed.createComponent(TestMessageComponent);
    const component = fixture.componentInstance;
    component.messageType = 'expression';
    fixture.detectChanges();

    expect(component.loading).toBe(true);

    messages$.next([]);
    loaded$.next(true);
    fixture.detectChanges();

    expect(component.loading).toBe(false);
    expect(component.error).toBe(false);
  });

  it('retry resets loading and re-subscribes through the service', () => {
    const fixture = TestBed.createComponent(TestMessageComponent);
    const component = fixture.componentInstance;
    component.messageType = 'expression';
    fixture.detectChanges();

    errors$.next();
    expect(component.error).toBe(true);
    expect(component.loading).toBe(false);

    component.retry();

    expect(retryMessages).toHaveBeenCalled();
    expect(component.loading).toBe(true);
  });
});
