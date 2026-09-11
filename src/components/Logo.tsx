import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 font-display font-bold", className)}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-gradient text-primary-foreground">
        <Home className="h-4 w-4" />
      </span>
      {!iconOnly && (
        <span className="text-lg tracking-tight">
          SAN <span className="text-primary">Connect</span>
        </span>
      )}
    </span>
  );
}
