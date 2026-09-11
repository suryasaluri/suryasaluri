import { Check, X, Clock, Circle } from "lucide-react";
import { APPROVAL_STAGES, STAGE_LABELS } from "@/lib/db-types";
import type { Approval } from "@/lib/db-types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StageStepper({ approvals }: { approvals: Approval[] }) {
  const byStage = new Map(approvals.map((a) => [a.stage, a]));
  const firstIncompleteIdx = APPROVAL_STAGES.findIndex(
    (s) => byStage.get(s)?.status !== "approved",
  );

  return (
    <div className="flex flex-col gap-0 sm:flex-row sm:items-start">
      {APPROVAL_STAGES.map((stage, i) => {
        const a = byStage.get(stage);
        const status = a?.status ?? "pending";
        const isCurrent = i === firstIncompleteIdx && status !== "rejected";
        const isLast = i === APPROVAL_STAGES.length - 1;

        return (
          <div key={stage} className="flex flex-1 sm:flex-col">
            <div className="flex flex-col items-center sm:w-full">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold",
                    status === "approved" && "border-success bg-success text-success-foreground",
                    status === "rejected" &&
                      "border-destructive bg-destructive text-destructive-foreground",
                    status === "pending" &&
                      isCurrent &&
                      "border-warning bg-warning/15 text-warning",
                    status === "pending" &&
                      !isCurrent &&
                      "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {status === "approved" && <Check className="h-4 w-4" />}
                  {status === "rejected" && <X className="h-4 w-4" />}
                  {status === "pending" && isCurrent && <Clock className="h-4 w-4" />}
                  {status === "pending" && !isCurrent && <Circle className="h-3 w-3" />}
                </div>
                <div
                  className={cn(
                    "hidden h-0.5 flex-1 sm:block",
                    !isLast && (status === "approved" ? "bg-success" : "bg-border"),
                  )}
                />
              </div>
              <div className="mt-2 pb-6 text-center sm:pb-0">
                <div className="text-xs font-semibold">{STAGE_LABELS[stage]}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {status === "approved" && formatDate(a?.approved_at)}
                  {status === "rejected" && "Rejected"}
                  {status === "pending" && (isCurrent ? "In progress" : "Upcoming")}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
