"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function UserBadge({ className }: { className?: string }) {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  if (!session?.user) return null;

  const { name, email, image } = session.user;
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (email?.[0]?.toUpperCase() ?? "?");

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 ${className ?? ""}`}>
      {image ? (
        <Image
          src={image}
          alt={name ?? email ?? ""}
          width={26}
          height={26}
          className="rounded-full"
        />
      ) : (
        <div className="w-[26px] h-[26px] rounded-full bg-white/20 flex items-center justify-center text-xs font-medium shrink-0">
          {initials}
        </div>
      )}
      <span className="text-xs text-white/60 flex-1 truncate">{name ?? email}</span>
      <button
        onClick={handleSignOut}
        className="text-xs text-white/30 hover:text-white/60 transition-colors shrink-0"
      >
        Salir
      </button>
    </div>
  );
}
