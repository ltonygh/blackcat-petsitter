"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { Role } from "@/types";

export interface HeaderSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
  };
}

interface HeaderProps {
  /** Session passed down from the server layout, or null if signed out. */
  session: HeaderSession | null;
  /** Server action that signs the user out (provides the <form> action). */
  signOutAction: () => Promise<void>;
}

const NAV_LINKS = [
  { href: "/", label: "首頁" },
  { href: "/social", label: "社交媒體" },
  { href: "/book", label: "立即預約" },
];

export function Header({ session, signOutAction }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = session?.user ?? null;
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[#FFEDB9]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#4A3B32]"
          onClick={() => setMobileOpen(false)}
        >
          <span className="text-xl" aria-hidden>
            🐈‍⬛
          </span>
          Blackcat.petsitter
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-white text-[#4A3B32]"
                  : "text-[#4A3B32]/80 hover:bg-white/60 hover:text-[#4A3B32]"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {user && (
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A3B32]/80 hover:bg-white/60"
            >
              Dashboard
            </Link>
          )}
          {user?.role === "owner" && (
            <Link
              href="/owner"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A3B32]/80 hover:bg-white/60"
            >
              Owner Dashboard
            </Link>
          )}
          {user?.role === "staff" && (
            <Link
              href="/staff"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A3B32]/80 hover:bg-white/60"
            >
              Staff Dashboard
            </Link>
          )}
        </nav>

        {/* Desktop auth area */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="max-w-[12rem] truncate text-sm text-[#4A3B32]/70">
                {user.name || user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-xl bg-[#FFA259] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d]"
                >
                  登出
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-[#FFA259] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#ff8f3d]"
            >
              登入
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded-lg p-2 text-[#4A3B32] md:hidden"
          aria-label="切換選單"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className="block text-xl leading-none">
            {mobileOpen ? "✕" : "☰"}
          </span>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-black/5 bg-[#FFEDB9] px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(link.href)
                    ? "bg-white text-[#4A3B32]"
                    : "text-[#4A3B32]/80 hover:bg-white/60"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A3B32]/80 hover:bg-white/60"
              >
                Dashboard
              </Link>
            )}
            {user?.role === "owner" && (
              <Link
                href="/owner"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A3B32]/80 hover:bg-white/60"
              >
                Owner Dashboard
              </Link>
            )}
            {user?.role === "staff" && (
              <Link
                href="/staff"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A3B32]/80 hover:bg-white/60"
              >
                Staff Dashboard
              </Link>
            )}

            <div className="mt-2 border-t border-black/5 pt-3">
              {user ? (
                <div className="flex flex-col gap-2">
                  <span className="truncate text-sm text-[#4A3B32]/70">
                    {user.name || user.email}
                  </span>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-[#FFA259] px-4 py-2 text-sm font-semibold text-white"
                    >
                      登出
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl bg-[#FFA259] px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  登入
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
