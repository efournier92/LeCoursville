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

  it('hides photo albums when no flags are loaded', () => {
    const keys = visibleAdminNav(undefined).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys.length).toBe(11);
  });

  it('hides photo albums when the flag is disabled', () => {
    const keys = visibleAdminNav({ enablePhotoAlbums: { enabled: false } }).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys.length).toBe(11);
  });

  it('shows photo albums when the flag is enabled and keeps the other eleven', () => {
    const keys = visibleAdminNav({ enablePhotoAlbums: { enabled: true } }).map(item => item.key);
    expect(keys).toContain('photoAlbums');
    expect(keys.length).toBe(12);
  });
});
