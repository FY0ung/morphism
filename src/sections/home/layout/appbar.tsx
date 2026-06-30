"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/actionable/Buttons";
import { NAV_ITEMS } from "../const";

export default function HomeAppbar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav
      className="
        fixed left-1/2 top-6 z-50 -translate-x-1/2
        inline-flex items-center justify-center gap-2
        rounded-full border-[0.5px] border-border-default-onlight
        bg-background-default-default/16 px-2 py-1 backdrop-blur-[22px]
      "
      aria-label="Primary"
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Button
            key={item.href}
            color="default"
            variant="text"
            size="medium"
            aria-current={isActive ? "page" : undefined}
            onClick={() => router.push(item.href)}
            className={
              isActive ? "text-text-default-default" : "text-text-default-onlight"
            }
          >
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}
