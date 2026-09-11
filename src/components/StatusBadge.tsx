import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-medium capitalize",
        `badge-status-${status}`,
        className,
      )}
    >
      {titleCase(status)}
    </Badge>
  );
}
