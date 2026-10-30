export interface FeatureConfig {
  id: string;
  label: string;
  route: string;
  icon: string;
  /** Default when the flag has no RTDB record yet. Existing features default ON; view-toggle flags default OFF. */
  defaultEnabled?: boolean;
}

export const FEATURES: FeatureConfig[] = [
  { id: 'people', label: 'People', route: '/people', icon: 'diversity_2' },
  { id: 'contacts', label: 'Contacts', route: '/contacts', icon: 'contacts' },
  { id: 'calendar', label: 'Calendar', route: '/calendar', icon: 'calendar_month' },
  { id: 'music', label: 'Music', route: '/media/audio', icon: 'library_music' },
  { id: 'videos', label: 'Videos', route: '/media/video', icon: 'local_movies' },
  { id: 'photos', label: 'Photos', route: '/photos', icon: 'photo' },
  // View-mode toggle for /photos, not a separate destination: when ON the
  // album grid renders at /photos, when OFF the legacy gallery does.
  { id: 'enablePhotoAlbums', label: 'Photo Albums (new view)', route: '/photos', icon: 'photo_library', defaultEnabled: false },
  { id: 'expressions', label: 'Expressions', route: '/expressions', icon: 'lightbulb' },
  { id: 'chat', label: 'Chat', route: '/chat', icon: 'message' },
];

export const ACCOUNT_FEATURE: FeatureConfig = {
  id: 'account',
  label: 'Account',
  route: '/',
  icon: 'account_circle',
};

export const UPLOAD_FEATURE: FeatureConfig = {
  id: 'upload',
  label: 'Upload',
  route: '/upload',
  icon: 'perm_media',
};