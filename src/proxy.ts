// Next.js 16 renamed "middleware" to "proxy". This file must live in src/ (next to app/).
// If your installed Next.js is 15 or older: rename this file to src/middleware.ts
// and rename the exported function to `middleware`.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
