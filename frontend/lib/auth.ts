import { fetchBackend } from './api-client';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'SUPERADMIN' | 'OWNER' | 'STAFF';
  gymId: string | null;
}

/**
 * Gets the current session and user details by querying the Express backend.
 */
export async function getSession(): Promise<JWTPayload | null> {
  try {
    const res = await fetchBackend('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.user) return null;

    return {
      userId: data.user.id,
      email: data.user.email,
      role: data.user.role,
      gymId: data.user.gym ? data.user.gym.id : null,
    };
  } catch (err) {
    console.error('[Frontend Auth] Error retrieving session:', err);
    return null;
  }
}

/**
 * Ensures strict role-based access and tenant isolation on the frontend.
 */
export async function getSessionForGym(gymSlug: string): Promise<JWTPayload | null> {
  const session = await getSession();
  if (!session) return null;

  if (session.role === 'SUPERADMIN') return session;

  try {
    const res = await fetchBackend('/api/auth/me');
    if (!res.ok) return null;
    const data = await res.json();
    
    if (!data.user || !data.user.gym || data.user.gym.slug !== gymSlug) {
      return null;
    }

    return session;
  } catch (err) {
    return null;
  }
}
