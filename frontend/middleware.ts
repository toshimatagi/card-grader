import { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon, icon, opengraph-image, apple-icon, robots, sitemap
     * - api/ (Render プロキシなので auth不要)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon|opengraph-image|apple-icon|robots|sitemap|api).*)",
  ],
};
