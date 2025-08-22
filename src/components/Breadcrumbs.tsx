"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <div style={{ padding: "8px 16px", fontSize: "14px", color: "#555" }}>
      <Link href="/">Home</Link>
      {segments.map((segment, idx) => {
        const href = "/" + segments.slice(0, idx + 1).join("/");
        return (
          <span key={href}>
            {" / "}
            <Link href={href}>{segment}</Link>
          </span>
        );
      })}
    </div>
  );
}
