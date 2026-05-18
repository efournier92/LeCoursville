export interface FeatureConfig {
  id: string;
  label: string;
  route: string;
  icon: string;
}

export const FEATURES: FeatureConfig[] = [
  { id: 'people', label: 'People', route: '/people', icon: 'people' },
  { id: 'contacts', label: 'Contacts', route: '/contacts', icon: 'people' },
  { id: 'calendar', label: 'Calendar', route: '/calendar', icon: 'calendar_today' },
  { id: 'music', label: 'Music', route: '/media/audio', icon: 'library_music' },
  { id: 'videos', label: 'Videos', route: '/media/video', icon: 'local_movies' },
  { id: 'photos', label: 'Photos', route: '/photos', icon: 'photo' },
  { id: 'expressions', label: 'Expressions', route: '/expressions', icon: 'format_quote' },
  { id: 'chat', label: 'Chat', route: '/chat', icon: 'message' },
];

export const ACCOUNT_FEATURE: FeatureConfig = {
  id: 'account',
  label: 'Account',
  route: '/',
  icon: 'account_circle',
};