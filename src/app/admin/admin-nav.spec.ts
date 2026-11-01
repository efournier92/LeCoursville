import { ADMIN_NAV, ADMIN_NAV_GROUPS, visibleAdminNav } from './admin-nav';

describe('admin-nav', () => {
  it('has fourteen unique route keys', () => {
    const keys = ADMIN_NAV.map(item => item.key);
    expect(keys.length).toBe(14);
    expect(new Set(keys).size).toBe(14);
  });

  it('every path starts with /admin/', () => {
    ADMIN_NAV.forEach(item => expect(item.path.startsWith('/admin/')).toBe(true));
  });

  it('groups appear in ADMIN_NAV_GROUPS order', () => {
    const order = ADMIN_NAV.map(item => item.group);
    const unique = order.filter((group, i) => order.indexOf(group) === i);
    expect(unique).toEqual(ADMIN_NAV_GROUPS);
  });

  it('contacts sit in People and expressions in Content', () => {
    const contacts = ADMIN_NAV.find(item => item.key === 'contacts');
    expect(contacts?.group).toBe('People');
    expect(contacts?.path).toBe('/admin/contacts');
    const expressions = ADMIN_NAV.find(item => item.key === 'expressions');
    expect(expressions?.group).toBe('Content');
    expect(expressions?.path).toBe('/admin/expressions');
  });

  it('hides photo albums when no flags are loaded', () => {
    const keys = visibleAdminNav(undefined).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys.length).toBe(13);
  });

  it('hides photo albums when the flag is disabled', () => {
    const keys = visibleAdminNav({ enablePhotoAlbums: { enabled: false } }).map(item => item.key);
    expect(keys).not.toContain('photoAlbums');
    expect(keys.length).toBe(13);
  });

  it('shows photo albums when the flag is enabled and keeps the other thirteen', () => {
    const keys = visibleAdminNav({ enablePhotoAlbums: { enabled: true } }).map(item => item.key);
    expect(keys).toContain('photoAlbums');
    expect(keys.length).toBe(14);
  });
});
