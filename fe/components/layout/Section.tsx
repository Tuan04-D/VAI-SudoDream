import clsx from "clsx";
import type { ReactNode } from "react";

export default function Section({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={clsx("scroll-mt-20 py-12 lg:scroll-mt-24 lg:py-16", className)}>
      {children}
    </section>
  );
}
