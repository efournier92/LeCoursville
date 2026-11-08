// Content routes admit any admin; super-only routes are filtered from the
// sidebar and guarded per child route. This table drives both the sidebar and
// the route paths.

export const ADMIN_ROUTE = {
  users: 'users',
  families: 'families',
  people: 'people',
  contacts: 'contacts',
  calendars: 'calendars',
  familyExplorer: 'family-explorer',
  expressions: 'expressions',
  media: 'media',
  photoAlbums: 'photo-albums',
  songs: 'songs',
  uploads: 'uploads',
  recovery: 'recovery',
  analytics: 'analytics',
  features: 'features',
} as const;

export type AdminRouteKey = keyof typeof ADMIN_ROUTE;

export type AdminNavGroup = 'People' | 'Content' | 'System';

export interface AdminNavItem {
  key: AdminRouteKey;
  path: string;
  label: string;
  icon: string;
  group: AdminNavGroup;
  featureFlag?: string;
  superOnly?: boolean;
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = ['People', 'Content', 'System'];

export const ADMIN_NAV: AdminNavItem[] = [
  { key: 'families', path: '/admin/' + ADMIN_ROUTE.families, label: 'Families', icon: 'groups', group: 'People' },
  { key: 'people', path: '/admin/' + ADMIN_ROUTE.people, label: 'People', icon: 'person_add', group: 'People' },
  { key: 'contacts', path: '/admin/' + ADMIN_ROUTE.contacts, label: 'Contacts', icon: 'contact_mail', group: 'People' },
  { key: 'calendars', path: '/admin/' + ADMIN_ROUTE.calendars, label: 'Calendars', icon: 'calendar_month', group: 'People', featureFlag: 'legacyCalendarPdf' },
  { key: 'familyExplorer', path: '/admin/' + ADMIN_ROUTE.familyExplorer, label: 'Family Explorer', icon: 'account_tree', group: 'Content', superOnly: true },
  { key: 'expressions', path: '/admin/' + ADMIN_ROUTE.expressions, label: 'Expressions', icon: 'format_quote', group: 'Content' },
  { key: 'media', path: '/admin/' + ADMIN_ROUTE.media, label: 'Media', icon: 'perm_media', group: 'Content' },
  { key: 'photoAlbums', path: '/admin/' + ADMIN_ROUTE.photoAlbums, label: 'Photo Albums', icon: 'photo_library', group: 'Content', featureFlag: 'enablePhotoAlbums' },
  { key: 'songs', path: '/admin/' + ADMIN_ROUTE.songs, label: 'Songs', icon: 'queue_music', group: 'Content' },
  { key: 'uploads', path: '/admin/' + ADMIN_ROUTE.uploads, label: 'Uploads', icon: 'upload_file', group: 'Content', superOnly: true },
  { key: 'users', path: '/admin/' + ADMIN_ROUTE.users, label: 'Users', icon: 'manage_accounts', group: 'System', superOnly: true },
  { key: 'features', path: '/admin/' + ADMIN_ROUTE.features, label: 'Features', icon: 'toggle_on', group: 'System', superOnly: true },
  { key: 'recovery', path: '/admin/' + ADMIN_ROUTE.recovery, label: 'Recovery', icon: 'lock_reset', group: 'System', superOnly: true },
  { key: 'analytics', path: '/admin/' + ADMIN_ROUTE.analytics, label: 'Analytics', icon: 'insights', group: 'System', superOnly: true },
];

export function visibleAdminNav(
  flags: Record<string, { enabled?: boolean } | undefined> | null | undefined,
  user?: { roles?: { super?: boolean } } | null,
): AdminNavItem[] {
  return ADMIN_NAV.filter(item =>
    (!item.featureFlag || flags?.[item.featureFlag]?.enabled === true)
    && (!item.superOnly || user?.roles?.super === true));
}
