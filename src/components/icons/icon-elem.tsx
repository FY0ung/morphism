"use client";

import { SVGProps, memo } from "react";
import { cn } from "@/lib/utils";
import { icons } from "./icons-list";

interface Props extends SVGProps<SVGSVGElement> {
  name: keyof typeof icons;
}
const Icon = ({ name, className, ...props }: Props) => {
  const Va = icons[name];
  return (
    <Va
      strokeWidth={1.2}
      {...props}
      className={cn("size-4 text-current!", className)}
    />
  );
};

export default memo(Icon);
