"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/transactions", label: "Transactions" },
  { href: "/reports", label: "Reports" },
  { href: "/import", label: "Import" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: "20px", padding: "10px", borderBottom: "1px solid #ddd" }}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            fontWeight: pathname === link.href ? "bold" : "normal",
            textDecoration: "none",
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
