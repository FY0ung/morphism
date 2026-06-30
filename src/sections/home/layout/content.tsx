"use client";

import type { ChildrenProps } from "@/types";
import HomeAppbar from "./appbar";
import HomeFooter from "./footer";

const HomeContent = ({ children }: ChildrenProps) => {
  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between bg-background-default-default">
      <HomeAppbar />
      <main className="relative w-full flex-1">{children}</main>
      <HomeFooter />
    </div>
  );
};

export default HomeContent;
