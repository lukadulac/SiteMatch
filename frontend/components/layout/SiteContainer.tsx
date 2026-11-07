import type { ReactNode } from "react";

type SiteContainerProps = {
  children: ReactNode;
};

export default function SiteContainer({ children }: SiteContainerProps) {
  return (
    <div className="mx-auto w-full max-w-300 p-6 md:px-12">
      {children}
    </div>
  );
}
