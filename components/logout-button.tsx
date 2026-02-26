"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button type="button" onClick={onLogout}>
      Logout
    </button>
  );
}
