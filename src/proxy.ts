import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16: middleware.ts は非推奨となり proxy.ts へ改名された。
 * ファイル名・エクスポート関数名を "proxy" に変更する以外、ロジックは変更なし。
 * https://nextjs.org/docs/messages/middleware-to-proxy
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 以下を除く全リクエストにマッチする:
     * - _next/static, _next/image (静的ファイル)
     * - favicon.ico, manifest, icons, service worker, オフラインフォールバックページ
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/).*)",
  ],
};
