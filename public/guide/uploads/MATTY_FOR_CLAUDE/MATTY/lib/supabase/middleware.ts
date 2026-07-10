import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ログイン不要でアクセスできるパス（第41章: 未ログイン状態では一切の画面を表示しない の唯一の例外）
const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons") ||
    pathname === "/favicon.ico" ||
    pathname === "/offline.html" ||
    pathname === "/sw.js"
  );
}

/**
 * 全リクエストでSupabaseセッションを検証・リフレッシュし、
 * 未ログインユーザーをログイン画面へリダイレクトする。
 *
 * v1.2修正:
 * ・タブレットでのページ遷移後にログイン画面へ戻る問題を修正
 * ・タイムアウトを10秒に延長し、一時的な接続断での誤リダイレクトを防止
 * ・セッションCookieが存在する場合はタイムアウトでもリダイレクトしない
 * ・getSession()でCookieからセッション読み取り、getUser()でサーバー検証の2段階に変更
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }),
      },
    }
  );

  const { pathname } = request.nextUrl;

  // Cookieにセッションがあるかどうかをまず確認（ネットワーク不要）
  const { data: sessionData } = await supabase.auth.getSession();
  const hasSessionCookie = !!sessionData?.session;

  let user = null;
  let authError = false;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // タイムアウト・ネットワークエラー時
    authError = true;
    // Cookieにセッションが存在する場合はリダイレクトしない
    // → タブレットでのページ遷移後にログイン画面に飛ぶ問題の主因
    if (hasSessionCookie) {
      return supabaseResponse;
    }
    user = null;
  }

  // ネットワークエラーでCookieもない場合のみリダイレクト
  if (!user && !authError && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!user && authError && !hasSessionCookie && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
