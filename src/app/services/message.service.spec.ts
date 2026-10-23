import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { MessageService } from './message.service';
import { Message } from 'src/app/models/message';
import { AuthService } from './auth.service';
import { RtdbService } from './rtdb.service';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    title: 'Title',
    body: 'Body',
    attachmentId: '',
    attachmentType: '',
    attachmentUrl: '',
    authorName: 'Ada',
    authorId: 'u1',
    isReply: false,
    replyLevel: 0,
    likes: [],
    replies: [],
    dateSent: new Date('2024-01-02T03:04:05Z'),
    isEditable: true,
    isSaved: false,
    isDeleted: false,
    isSticky: false,
    messageType: 'chat',
    ...overrides,
  } as Message;
}

describe('MessageService', () => {
  let service: MessageService;
  let rtdbSpy: jasmine.SpyObj<RtdbService>;
  let refs: Record<string, any>;
  let messagesFeed: Subject<Message[]>;

  beforeEach(() => {
    refs = {};
    messagesFeed = new Subject<Message[]>();
    rtdbSpy = jasmine.createSpyObj('RtdbService', ['object', 'list', 'createPushId']);
    rtdbSpy.list.and.returnValue({ valueChanges: () => messagesFeed.asObservable() });
    rtdbSpy.createPushId.and.returnValue('push-1');
    rtdbSpy.object.and.callFake((path: string) => {
      refs[path] ??= {
        valueChanges: () => of(null),
        set: jasmine.createSpy('set'),
        update: jasmine.createSpy('update'),
        remove: jasmine.createSpy('remove'),
      };
      return refs[path];
    });

    TestBed.configureTestingModule({
      providers: [
        MessageService,
        { provide: AuthService, useValue: { userObservable: of({ id: 'u1' } as any) } },
        { provide: RtdbService, useValue: rtdbSpy },
      ],
    });
    service = TestBed.inject(MessageService);
  });

  it('create forces isEditable false and a numeric dateSent', () => {
    service.create(makeMessage({ isEditable: true }));

    expect(refs['messages/m1'].set).toHaveBeenCalledWith(jasmine.objectContaining({
      isEditable: false,
      dateSent: new Date('2024-01-02T03:04:05Z').getTime(),
    }));
  });

  it('updateMessage carries authorship and forces isEditable false', () => {
    service.updateMessage(makeMessage({ isEditable: true, body: 'Edited' }));

    expect(refs['messages/m1'].update).toHaveBeenCalledWith(jasmine.objectContaining({
      authorId: 'u1',
      body: 'Edited',
      isEditable: false,
    }));
  });

  it('an expression payload adds attribution and year', () => {
    service.create(makeMessage({
      messageType: 'expression',
      attribution: 'Ada Lovelace',
      yearWritten: '1842',
    } as any));

    expect(refs['messages/m1'].set).toHaveBeenCalledWith(jasmine.objectContaining({
      attribution: 'Ada Lovelace',
      yearWritten: '1842',
    }));
  });

  it('normalizeMessage clones likes and normalizes replies recursively', () => {
    const like = { userId: 'u2', userName: 'Grace' };
    const replyLike = { userId: 'u3', userName: 'Alan' };
    const message = makeMessage({
      likes: { l1: like } as any,
      replies: {
        r1: makeMessage({
          id: 'r1',
          likes: [replyLike],
          replies: { r2: makeMessage({ id: 'r2', likes: null as any, replies: null as any }) } as any,
        }),
      } as any,
    });
    const emissions: Message[][] = [];
    service.messagesObservable.subscribe(value => emissions.push(value));

    messagesFeed.next([message]);

    const emitted = emissions[emissions.length - 1][0];
    expect(emitted.likes.length).toBe(1);
    expect(emitted.likes[0]).not.toBe(like);
    expect(emitted.replies[0].likes[0]).not.toBe(replyLike);
    expect(emitted.replies[0].replies[0].id).toBe('r2');
    expect(emitted.replies[0].replies[0].likes).toEqual([]);
  });

  it('toArray accepts a map or an array', () => {
    const emissions: Message[][] = [];
    service.messagesObservable.subscribe(value => emissions.push(value));

    messagesFeed.next([
      makeMessage({ id: 'map', likes: { a: { userId: 'u1', userName: 'A' } } as any }),
      makeMessage({ id: 'array', likes: [{ userId: 'u1', userName: 'A' }] }),
    ]);

    const emitted = emissions[emissions.length - 1];
    expect(emitted[0].likes.length).toBe(1);
    expect(emitted[1].likes.length).toBe(1);
  });

  it('deleteMessage removes only messages/<id>', () => {
    service.deleteMessage(makeMessage({ id: 'm1' }));

    expect(refs['messages/m1'].remove).toHaveBeenCalled();
    expect(rtdbSpy.object).toHaveBeenCalledTimes(1);
    expect(rtdbSpy.object).toHaveBeenCalledWith('messages/m1');
  });
});
