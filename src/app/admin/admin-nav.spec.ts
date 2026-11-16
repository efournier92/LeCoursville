import { ADMIN_NAV, ADMIN_NAV_GROUPS, visibleAdminNav } from './admin-nav';

describe('admin-nav', () => {
  it('has thirteen unique route keys', () => {
    const keys = ADMIN_NAV.map(item => item.key);
    expect(keys.length).toBe(13);
    expect(new Set(keys).size).toBe(13);
  });

  it('every path starts with /admin/', () => {
    ADMIN_NAV.forEach(item => expect(item.path.startsWith('/admin/')).toBe(true));
  });

  it('groups appear in ADMIN_NAV_GROUPS order', () => {
    const order = ADMIN_NAV.map(item => item.group);
    const unique = order.filter((group, i) => order.indexOf(group) === i);
    expect(unique).toEqual(ADMIN_NAV_GROUPS);
  });

  it('the retired contacts entry is gone and expressions sits in Content', () => {
    expect(ADMIN_NAV.some(item => (item.key as string) === 'contacts')).toBe(false);
    const expressions = ADMIN_NAV.find(item => item.key === 'expressions');
    expect(expressions?.group).toBe('Content');
    expect(expressions?.path).toBe('/admin/expressions');
    expect(expressions?.superOnly).toBeUndefined();
  });

  it('hides photo albums, calendars, and super-only items when no flags are loaded', () => {
    const keys = visibleAdminNav(undefined).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys).not.toContain('calendars');
    expect(keys).not.toContain('users');
    expect(keys).not.toContain('familyExplorer');
    expect(keys.length).toBe(6);
  });

  it('hides photo albums and calendars when their flags are disabled', () => {
    const member = { roles: { super: false } };
    const keys = visibleAdminNav({
      enablePhotoAlbums: { enabled: false },
      legacyCalendarPdf: { enabled: false },
    }, member).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys).not.toContain('calendars');
    expect(keys).not.toContain('users');
    expect(keys.length).toBe(6);
  });

  it('shows calendars when its flag is enabled and never photo albums', () => {
    const member = { roles: { super: false } };
    const keys = visibleAdminNav({
      enablePhotoAlbums: { enabled: true },
      legacyCalendarPdf: { enabled: true },
    }, member).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys).toContain('calendars');
    expect(keys).not.toContain('users');
    expect(keys.length).toBe(7);
  });

  it('shows all items to a super when both content flags are enabled', () => {
    const keys = visibleAdminNav(
      { enablePhotoAlbums: { enabled: true }, legacyCalendarPdf: { enabled: true } },
      { roles: { super: true } },
    ).map(item => item.key);
    expect(keys.length).toBe(13);
  });

  it('shows only the flag-free items to a super when no flags are loaded', () => {
    const keys = visibleAdminNav(undefined, { roles: { super: true } }).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys).not.toContain('calendars');
    expect(keys.length).toBe(12);
  });
});
