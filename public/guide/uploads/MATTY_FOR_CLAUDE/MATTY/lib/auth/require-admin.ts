import { getCurrentProfile } from "@/lib/auth/current-profile";

/** CSV出力など管理者専用APIの入口で使うガード。管理者でなければ403を返す。 */
export async function requireAdminOrResponse() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { profile: null, response: new Response("Unauthorized", { status: 401 }) };
  }
  if (profile.role !== "admin") {
    return {
      profile: null,
      response: new Response("CSV出力は管理者のみ利用できます。", { status: 403 }),
    };
  }
  return { profile, response: null };
}
