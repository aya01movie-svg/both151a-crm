"use client";

import { useState, useTransition } from "react";
import { updateStaffRoleAction } from "@/lib/actions/staff";
import type { Profile, StaffRole } from "@/types/database";

export function StaffManager({
  staff,
  currentUserId,
}: {
  staff: Profile[];
  currentUserId: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {staff.map((s) => (
        <StaffRow key={s.id} profile={s} isSelf={s.id === currentUserId} />
      ))}
    </ul>
  );
}

function StaffRow({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const [role, setRole] = useState<StaffRole>(profile.role);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex items-center justify-between gap-3 border-b border-navy/5 pb-2 last:border-0">
      <div>
        <p className="font-bold text-navy">
          {profile.display_name}
          {isSelf && <span className="text-navy/30 text-xs ml-1">（自分）</span>}
        </p>
        {error && <p className="text-danger text-xs font-bold">{error}</p>}
      </div>
      <select
        value={role}
        disabled={pending || isSelf}
        onChange={(e) => {
          const next = e.target.value as StaffRole;
          setRole(next);
          setError(null);
          startTransition(async () => {
            try {
              await updateStaffRoleAction(profile.id, next);
            } catch (err) {
              setRole(profile.role);
              setError(err instanceof Error ? err.message : "変更に失敗しました。");
            }
          });
        }}
        className="min-h-10 rounded-app border-2 border-navy/10 bg-white px-2 text-sm font-bold text-navy disabled:opacity-40"
      >
        <option value="staff">一般スタッフ</option>
        <option value="admin">管理者</option>
      </select>
    </li>
  );
}
