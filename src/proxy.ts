import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/mode";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Keeps the Supabase session fresh on every page request, and sends signed-out
 * people to /login (and signed-in people away from it). Does nothing in demo mode.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (isDemoMode) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Refreshes the token if expired. Do not put code between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const onLogin = request.nextUrl.pathname === "/login";

  if (!signedIn && !onLogin) return redirectKeepingCookies(request, response, "/login");
  if (signedIn && onLogin) return redirectKeepingCookies(request, response, "/");
  return response;
}

/** Redirect while carrying over any refreshed auth cookies, so the session isn't lost. */
function redirectKeepingCookies(request: NextRequest, from: NextResponse, path: string) {
  const to = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((c) => to.cookies.set(c));
  return to;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
