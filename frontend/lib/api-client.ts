import { cookies } from 'next/headers';

/**
 * Server-side helper to fetch data from the Express backend, forwarding authentication cookies.
 */
export async function fetchBackend(path: string, options: RequestInit = {}): Promise<Response> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const headers = new Headers(options.headers);

  // Attempt to forward cookies if running server-side
  try {
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();
    if (cookieString) {
      headers.set('Cookie', cookieString);
    }

    // Extract Bearer token if it exists in auth_token cookie
    const token = cookieStore.get('auth_token')?.value;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch (error) {
    // Client-side call: cookies will be sent automatically by the browser if credentials option is set
  }

  // Ensure JSON content type by default for body payloads
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers,
  });

  return response;
}
