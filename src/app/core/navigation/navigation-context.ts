export type NavigationOrigin = 'requests' | 'remodelings' | 'jobs' | 'inbox';

export interface NavigationContext {
  from?: NavigationOrigin | null;
  projectId?: string | null;
}
