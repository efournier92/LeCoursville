import { test, expect } from '../helpers/fixture';
import { E2E_USERS } from '../helpers/auth';
import { readDb, writeDb, deleteDb } from '../helpers/admin-db';
import { ROLES, del, get, patch, put, signIn, uidForEmail } from '../helpers/rules';

const STORAGE_BUCKET = 'lecoursville-dev.appspot.com';

function storageUrl(path: string): string {
  return `http://localhost:9199/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;
}

test.describe('rules', () => {
  test('server-only nodes reject unauthenticated RTDB reads', async () => {
    for (const node of ['recoveryRequests', 'adminAlerts']) {
      expect((await get(node)).status).not.toBe(200);
    }
  });

  test('an authenticated user cannot rewrite their own roles/user', async () => {
    const token = await signIn('user');
    const uid = await uidForEmail(E2E_USERS.user.email);

    expect((await put(`users/${uid}/roles/user`, false, token)).status).not.toBe(200);
    expect(await readDb<boolean>(`users/${uid}/roles/user`)).toBe(ROLES.user.user);
  });

  test('an authenticated user can still update their own profile fields', async () => {
    const token = await signIn('user');
    const uid = await uidForEmail(E2E_USERS.user.email);
    const original = await readDb<string>(`users/${uid}/name`);

    try {
      const res = await put(`users/${uid}/name`, 'E2E Renamed', token);
      expect(res.ok).toBe(true);
      expect(await readDb<string>(`users/${uid}/name`)).toBe('E2E Renamed');
    } finally {
      await writeDb(`users/${uid}/name`, original);
    }
  });

  test('staff admin cannot mutate features or promotedRoute', async () => {
    const token = await signIn('staff');
    const featureBefore = await readDb('features/chat');
    const routeBefore = await readDb('promotedRoute');

    const featureRes = await put(
      'features/chat',
      { enabled: true, updatedAt: Date.now() },
      token,
    );
    expect(featureRes.status).not.toBe(200);
    expect(await readDb('features/chat')).toEqual(featureBefore);

    const routeRes = await put(
      'promotedRoute',
      { route: '/chat', updatedAt: Date.now() },
      token,
    );
    expect(routeRes.status).not.toBe(200);
    expect(await readDb('promotedRoute')).toEqual(routeBefore);
  });

  test('super-only nodes reject staff reads and allow super reads', async () => {
    const staffToken = await signIn('staff');
    const superToken = await signIn('admin');
    const nodes = [
      'recoveryRequests',
      'adminAlerts',
      'recoveryAudit',
      'config/adminAlertRecipients',
    ];

    for (const node of nodes) {
      expect((await get(node, staffToken)).status).not.toBe(200);
      expect((await get(node, superToken)).status).toBe(200);
    }
  });

  test('roleAudit is super-read only and rejects every client write', async () => {
    const staffToken = await signIn('staff');
    const superToken = await signIn('admin');
    const id = `security-probe-${Date.now()}`;
    const record = {
      actorId: 'probe-actor',
      targetId: 'probe-target',
      targetEmail: 'probe@e2e.local',
      before: { user: true, admin: false, super: false },
      after: { user: true, admin: true, super: false },
      at: Date.now(),
    };
    await writeDb(`roleAudit/${id}`, record);

    try {
      for (const token of [staffToken, superToken]) {
        const res = await put(`roleAudit/${id}`, { ...record, actorId: 'overwritten' }, token);
        expect(res.status).not.toBe(200);
      }
      expect(await readDb(`roleAudit/${id}`)).toEqual(record);

      const superRead = await get(`roleAudit/${id}`, superToken);
      expect(superRead.status).toBe(200);
      expect(await superRead.json()).toEqual(record);

      expect((await get(`roleAudit/${id}`, staffToken)).status).not.toBe(200);
    } finally {
      await deleteDb(`roleAudit/${id}`);
    }
  });

  test('featureFlagAudit is super-create and super-read only', async () => {
    const staffToken = await signIn('staff');
    const superToken = await signIn('admin');
    const id = `security-feature-audit-${Date.now()}`;
    const record = {
      flagId: 'chat',
      enabled: false,
      previous: true,
      actorId: 'probe-actor',
      actorEmail: 'probe@e2e.local',
      at: Date.now(),
    };

    try {
      expect((await put(`featureFlagAudit/${id}`, record, staffToken)).status).not.toBe(200);
      expect(await readDb(`featureFlagAudit/${id}`)).toBeNull();

      expect((await put(`featureFlagAudit/${id}`, record, superToken)).ok).toBe(true);
      expect(await readDb(`featureFlagAudit/${id}`)).toEqual(record);

      const superRead = await get(`featureFlagAudit/${id}`, superToken);
      expect(superRead.status).toBe(200);
      expect(await superRead.json()).toEqual(record);

      expect(
        (await put(`featureFlagAudit/${id}`, { ...record, enabled: true }, superToken)).status,
      ).not.toBe(200);
      expect(await readDb(`featureFlagAudit/${id}`)).toEqual(record);

      expect((await del(`featureFlagAudit/${id}`, superToken)).status).not.toBe(200);
      expect(await readDb(`featureFlagAudit/${id}`)).toEqual(record);
    } finally {
      await deleteDb(`featureFlagAudit/${id}`);
    }
  });

  test('messages deny forged authors, nested rewrites, and cross-author changes', async () => {
    const userToken = await signIn('user');
    const adminToken = await signIn('admin');
    const userUid = await uidForEmail(E2E_USERS.user.email);
    const adminUid = await uidForEmail(E2E_USERS.admin.email);
    const stamp = Date.now();
    const ownKey = `security-own-${stamp}`;
    const forgedKey = `security-forged-${stamp}`;
    const replyKey = `security-reply-${stamp}`;
    const adminReplyKey = `security-admin-reply-${stamp}`;
    const seeded = (await readDb<Record<string, any>>('messages/msg-1')) ?? null;
    expect(seeded).toBeTruthy();
    const message = (id: string, authorId: string, authorName: string, extra = {}) => ({
      id,
      authorId,
      authorName,
      title: 'Security message',
      body: 'Written by its author',
      messageType: 'chat',
      isReply: false,
      replyLevel: 0,
      likes: [],
      replies: [],
      dateSent: Date.now(),
      isSticky: false,
      isEditable: false,
      isSaved: true,
      isDeleted: false,
      attachmentId: '',
      attachmentType: '',
      attachmentUrl: '',
      ...extra,
    });
    const reply = (id: string, authorId: string, authorName: string, extra = {}) =>
      message(id, authorId, authorName, { isReply: true, replyLevel: 1, ...extra });

    try {
      // A member cannot create a message as someone else, and anonymous writes
      // are denied entirely.
      expect(
        (await put(`messages/${forgedKey}`, message(forgedKey, adminUid, 'Admin User'), userToken))
          .status,
      ).not.toBe(200);
      expect(
        (await put(`messages/${forgedKey}`, message(forgedKey, adminUid, 'Admin User'))).status,
      ).not.toBe(200);

      expect(
        (await put(`messages/${ownKey}`, message(ownKey, userUid, 'Regular User'), userToken)).ok,
      ).toBe(true);

      // The create-time storage allowlist must keep holding once the record
      // exists, so a member cannot swap in an arbitrary attachment URL.
      expect(
        (await patch(`messages/${ownKey}`, { attachmentUrl: 'https://evil.example/x.png' }, userToken)).status,
      ).not.toBe(200);
      expect(
        (await readDb<Record<string, any>>(`messages/${ownKey}`))?.attachmentUrl,
      ).toBe('');
      expect(
        (await patch(
          `messages/${ownKey}`,
          { attachmentUrl: storageUrl('photos/album-1/photo-0-0.png') },
          userToken,
        )).ok,
      ).toBe(true);

      // Writable payload fields stay strings and within bounds on update.
      expect((await patch(`messages/${ownKey}`, { body: 42 }, userToken)).status).not.toBe(200);
      expect((await patch(`messages/${ownKey}`, { title: 'x'.repeat(201) }, userToken)).status).not.toBe(200);
      expect(
        (await patch(`messages/${ownKey}`, { attachmentType: 'x'.repeat(101) }, userToken)).status,
      ).not.toBe(200);

      // Another member's body, author, and nested reply tree are all off limits.
      expect(
        (await put('messages/msg-1', { ...seeded, body: 'hijacked' }, userToken)).status,
      ).not.toBe(200);
      expect(
        (await put(
          'messages/msg-1',
          { ...seeded, replies: [{ ...reply('forged-nested', adminUid, 'Admin User') }] },
          userToken,
        )).status,
      ).not.toBe(200);
      expect((await del('messages/msg-1', userToken)).status).not.toBe(200);
      expect((await readDb<Record<string, any>>('messages/msg-1'))?.body).toBe(seeded.body);

      // An author cannot hand their own message to another identity.
      expect((await patch(`messages/${ownKey}`, { authorId: adminUid }, userToken)).status).not.toBe(200);
      expect((await readDb<Record<string, any>>(`messages/${ownKey}`))?.authorId).toBe(userUid);

      // Likes are child writes keyed by the liker, and only the liker.
      await deleteDb(`messages/msg-1/likes/${userUid}`);
      expect(
        (await put(
          `messages/msg-1/likes/${userUid}`,
          { userId: userUid, userName: 'Regular User' },
          userToken,
        )).ok,
      ).toBe(true);
      expect(
        (await put(
          `messages/msg-1/likes/${adminUid}`,
          { userId: adminUid, userName: 'Admin User' },
          userToken,
        )).status,
      ).not.toBe(200);

      // Replies are child writes whose author is pinned to the caller.
      expect(
        (await put(
          `messages/msg-1/replies/${replyKey}`,
          reply(replyKey, userUid, 'Regular User'),
          userToken,
        )).ok,
      ).toBe(true);
      expect(
        (await put(
          'messages/msg-1/replies/forged-reply',
          reply('forged-reply', adminUid, 'Admin User'),
          userToken,
        )).status,
      ).not.toBe(200);

      // Admin-authored replies cannot be edited by a member.
      expect(
        (await put(
          `messages/msg-1/replies/${adminReplyKey}`,
          reply(adminReplyKey, adminUid, 'Admin User'),
          adminToken,
        )).ok,
      ).toBe(true);
      expect(
        (await patch(`messages/msg-1/replies/${adminReplyKey}`, { body: 'hijacked' }, userToken)).status,
      ).not.toBe(200);

      // Create constraints: id, sticky, author name, attachment URL, date.
      expect(
        (await put(
          `messages/security-id-${stamp}`,
          message('different-id', userUid, 'Regular User'),
          userToken,
        )).status,
      ).not.toBe(200);
      expect(
        (await put(
          `messages/security-sticky-${stamp}`,
          message(`security-sticky-${stamp}`, userUid, 'Regular User', { isSticky: true }),
          userToken,
        )).status,
      ).not.toBe(200);
      expect(
        (await put(
          `messages/security-name-${stamp}`,
          message(`security-name-${stamp}`, userUid, 'n'.repeat(101)),
          userToken,
        )).status,
      ).not.toBe(200);
      expect(
        (await put(
          `messages/security-url-${stamp}`,
          message(`security-url-${stamp}`, userUid, 'Regular User', {
            attachmentUrl: 'https://evil.example/x.png',
          }),
          userToken,
        )).status,
      ).not.toBe(200);
      expect(
        (await put(
          `messages/security-date-${stamp}`,
          message(`security-date-${stamp}`, userUid, 'Regular User', {
            dateSent: Date.now() - 25 * 60 * 60 * 1000,
          }),
          userToken,
        )).status,
      ).not.toBe(200);
    } finally {
      await writeDb('messages/msg-1', seeded);
      await deleteDb(`messages/${ownKey}`);
      await deleteDb(`messages/${forgedKey}`);
      await deleteDb(`messages/security-id-${stamp}`);
      await deleteDb(`messages/security-sticky-${stamp}`);
      await deleteDb(`messages/security-name-${stamp}`);
      await deleteDb(`messages/security-url-${stamp}`);
      await deleteDb(`messages/security-date-${stamp}`);
    }
  });

  test('message identity is pinned to the writer profile name', async () => {
    // Chat authorName is identity, so it must equal users/<uid>/name; a missing
    // profile name is rejected rather than falling back to the email local part.
    // Expression authorName stays a content field: blank or the writer's own
    // name is accepted, and admins may set any author for quoted material.
    const token = await signIn('user');
    const uid = await uidForEmail(E2E_USERS.user.email);
    const profileName = await readDb<string>(`users/${uid}/name`);
    expect(profileName).toBeTruthy();
    const key = `security-identity-${Date.now()}`;
    const record = (authorName: unknown) => ({
      id: key,
      authorId: uid,
      authorName,
      title: 'Identity probe',
      body: 'Pinned author',
      messageType: 'chat',
      isReply: false,
      replyLevel: 0,
      likes: [],
      replies: [],
      dateSent: Date.now(),
      isSticky: false,
      isEditable: false,
      isSaved: true,
      isDeleted: false,
      attachmentId: '',
      attachmentType: '',
      attachmentUrl: '',
    });

    try {
      // Another member's name is rejected outright.
      expect((await put(`messages/${key}`, record('Admin User'), token)).status).not.toBe(200);

      // A member with no profile name is rejected rather than allowed to
      // self-attribute with an email-local-part fallback.
      await writeDb(`users/${uid}/name`, null);
      expect(
        (await put(`messages/${key}`, record(E2E_USERS.user.email.split('@')[0]), token)).status,
      ).not.toBe(200);
      await writeDb(`users/${uid}/name`, profileName);

      // The actual profile name is accepted.
      expect((await put(`messages/${key}`, record(profileName), token)).ok).toBe(true);

      const like = (userName: unknown) =>
        put(`messages/msg-1/likes/${uid}`, { userId: uid, userName }, token);
      await deleteDb(`messages/msg-1/likes/${uid}`);
      expect((await like('Admin User')).status).not.toBe(200);
      expect((await like(profileName)).ok).toBe(true);
    } finally {
      await writeDb(`users/${uid}/name`, profileName);
      await deleteDb(`messages/${key}`);
      await deleteDb(`messages/msg-1/likes/${uid}`);
    }
  });

  test('users is own-record or super, not the authenticated roster', async () => {
    const userToken = await signIn('user');
    const staffToken = await signIn('staff');
    const superToken = await signIn('admin');
    const userUid = await uidForEmail(E2E_USERS.user.email);
    const adminUid = await uidForEmail(E2E_USERS.admin.email);

    expect((await get(`users/${userUid}`, userToken)).ok).toBe(true);
    expect((await get(`users/${adminUid}`, userToken)).status).not.toBe(200);
    expect((await get('users', staffToken)).status).not.toBe(200);
    expect((await get(`users/${userUid}`, staffToken)).status).not.toBe(200);
    expect((await get('users', superToken)).ok).toBe(true);
  });

  test('signed-out media reads are public, clans stay authenticated', async () => {
    const mediaAnonymous = await get('media/media-audio');
    expect(mediaAnonymous.status).toBe(200);
    expect(await mediaAnonymous.json()).toMatchObject({ id: 'media-audio' });
    expect((await get('media')).status).toBe(200);

    expect((await get('clans/clan-1')).status).not.toBe(200);
    expect((await get('clans')).status).not.toBe(200);

    const token = await signIn('user');
    for (const node of ['media', 'clans']) {
      expect((await get(node, token)).ok).toBe(true);
    }
  });
});
