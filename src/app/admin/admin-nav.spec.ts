import { ADMIN_NAV, ADMIN_NAV_GROUPS, visibleAdminNav } from './admin-nav';

describe('admin-nav', () => {
  it('has twelve unique route keys', () => {
    const keys = ADMIN_NAV.map(item => item.key);
    expect(keys.length).toBe(12);
    expect(new Set(keys).size).toBe(12);
  });

  it('every path starts with /admin/', () => {
    ADMIN_NAV.forEach(item => expect(item.path.startsWith('/admin/')).toBe(true));
  });

  it('groups appear in ADMIN_NAV_GROUPS order', () => {
    const order = ADMIN_NAV.map(item => item.group);
    const unique = order.filter((group, i) => order.indexOf(group) === i);
    expect(unique).toEqual(ADMIN_NAV_GROUPS);
  });

  it('hides photo albums and super-only items when no flags are loaded', () => {
    const keys = visibleAdminNav(undefined).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys).not.toContain('users');
    expect(keys.length).toBe(5);
  });

  it('hides photo albums and super-only items when the flag is disabled', () => {
    const member = { roles: { super: false } };
    const keys = visibleAdminNav({ enablePhotoAlbums: { enabled: false } }, member).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys).not.toContain('users');
    expect(keys.length).toBe(5);
  });

  it('shows photo albums and hides super-only items when the flag is enabled', () => {
    const member = { roles: { super: false } };
    const keys = visibleAdminNav({ enablePhotoAlbums: { enabled: true } }, member).map(item => item.key);
    expect(keys).toContain('photoAlbums');
    expect(keys).not.toContain('users');
    expect(keys.length).toBe(6);
  });

  it('shows all items to a super when the flag is enabled', () => {
    const keys = visibleAdminNav(
      { enablePhotoAlbums: { enabled: true } },
      { roles: { super: true } },
    ).map(item => item.key);
    expect(keys.length).toBe(12);
  });

  it('shows the flag-free items to a super when no flags are loaded', () => {
    const keys = visibleAdminNav(undefined, { roles: { super: true } }).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys.length).toBe(11);
  });
});
