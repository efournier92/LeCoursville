// Every admin route requires roles.super. The parent route guard is the single
// enforcement point; this table drives both the sidebar and the route paths.

export const ADMIN_ROUTE = {
  users: 'users',
  families: 'families',
  people: 'people',
  calendars: 'calendars',
  familyExplorer: 'family-explorer',
  media: 'media',
  photoAlbums: 'photo-albums',
  songs: 'songs',
  uploads: 'uploads',
  recovery: 'recovery',
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
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = ['People', 'Content', 'System'];

export const ADMIN_NAV: AdminNavItem[] = [
  { key: 'families', path: '/admin/' + ADMIN_ROUTE.families, label: 'Families', icon: 'groups', group: 'People' },
  { key: 'people', path: '/admin/' + ADMIN_ROUTE.people, label: 'People', icon: 'person_add', group: 'People' },
  { key: 'calendars', path: '/admin/' + ADMIN_ROUTE.calendars, label: 'Calendars', icon: 'calendar_month', group: 'People' },
  { key: 'familyExplorer', path: '/admin/' + ADMIN_ROUTE.familyExplorer, label: 'Family Explorer', icon: 'account_tree', group: 'Content' },
  { key: 'media', path: '/admin/' + ADMIN_ROUTE.media, label: 'Media', icon: 'perm_media', group: 'Content' },
  { key: 'photoAlbums', path: '/admin/' + ADMIN_ROUTE.photoAlbums, label: 'Photo Albums', icon: 'photo_library', group: 'Content', featureFlag: 'enablePhotoAlbums' },
  { key: 'songs', path: '/admin/' + ADMIN_ROUTE.songs, label: 'Songs', icon: 'queue_music', group: 'Content' },
  { key: 'uploads', path: '/admin/' + ADMIN_ROUTE.uploads, label: 'Uploads', icon: 'upload_file', group: 'Content' },
  { key: 'users', path: '/admin/' + ADMIN_ROUTE.users, label: 'Users', icon: 'manage_accounts', group: 'System' },
  { key: 'features', path: '/admin/' + ADMIN_ROUTE.features, label: 'Features', icon: 'toggle_on', group: 'System' },
  { key: 'recovery', path: '/admin/' + ADMIN_ROUTE.recovery, label: 'Recovery', icon: 'lock_reset', group: 'System' },
];

export function visibleAdminNav(
  flags: Record<string, { enabled?: boolean } | undefined> | null | undefined,
): AdminNavItem[] {
  return ADMIN_NAV.filter(item => !item.featureFlag || flags?.[item.featureFlag]?.enabled === true);
}
