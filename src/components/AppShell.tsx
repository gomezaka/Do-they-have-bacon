"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <div className="app-column" aria-label="Do They Have Bacon app">
        <main className="app-scroll">{children}</main>
        <nav className="bottom-nav" aria-label="Main navigation">
          <Link className={`nav-item ${navActive(pathname, "/") ? "active" : ""}`} href="/">
            <span aria-hidden="true">⌂</span><small>Home</small>
          </Link>
          <Link className={`nav-item ${navActive(pathname, "/search") ? "active" : ""}`} href="/search">
            <span aria-hidden="true">⌕</span><small>Search</small>
          </Link>
          <Link className="nav-scout" href="/hotels/add" aria-label="Report or add hotel">
            <span aria-hidden="true">🥓</span>
          </Link>
          <Link className={`nav-item ${navActive(pathname, "/map") ? "active" : ""}`} href="/map">
            <span aria-hidden="true">⌖</span><small>Map</small>
          </Link>
          <Link className={`nav-item ${navActive(pathname, "/tools") || navActive(pathname, "/login") ? "active" : ""}`} href="/tools">
            <span aria-hidden="true">◡</span><small>You</small>
          </Link>
        </nav>
      </div>
    </div>
  );
}
