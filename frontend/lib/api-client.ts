import { cookies } from "next/headers";

/**
 * Server-side helper to fetch data from the Express backend, forwarding authentication cookies.
 */
export async function fetchBackend(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
  const headers = new Headers(options.headers);

  // Attempt to forward cookies if running server-side
  try {
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();
    console.log(`🔍 [fetchBackend] Path: ${path}`);
    console.log(`🔍 [fetchBackend] Incoming cookies string: "${cookieString}"`);

    if (cookieString) {
      headers.set("Cookie", cookieString);
    }

    // Extract Bearer token if it exists in auth_token cookie
    const token = cookieStore.get("auth_token")?.value;
    console.log(
      `🔍 [fetchBackend] Extracted auth_token: "${token ? token.substring(0, 15) + "..." : "undefined"}"`,
    );

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } catch (error: any) {
    console.log(
      `🔍 [fetchBackend] Client-side call or error: ${error.message}`,
    );
  }

  // Ensure JSON content type by default for body payloads
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers,
  });

  return response;
}
