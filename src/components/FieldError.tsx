"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type FieldErrorProps = {
  message?: string;
  className?: string;
};

/**
 * Softly reveals / hides a validation message so errors feel less abrupt.
 */
export default function FieldError({ message, className }: FieldErrorProps) {
  const [visibleMessage, setVisibleMessage] = useState(message);
  const isOpen = Boolean(message);

  useEffect(() => {
    if (message) {
      setVisibleMessage(message);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVisibleMessage(undefined);
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  return (
    <div
      role={isOpen ? "alert" : undefined}
      aria-live="polite"
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="overflow-hidden">
        {visibleMessage ? (
          <p
            className={cn(
              "pt-1 text-sm text-red-600 origin-top transition-transform duration-200 ease-out",
              isOpen ? "translate-y-0" : "-translate-y-1"
            )}
          >
            {visibleMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
