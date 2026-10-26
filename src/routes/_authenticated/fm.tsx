import { createFileRoute } from "@tanstack/react-router";
import { FMShell } from "@/components/FMShell";

export const Route = createFileRoute("/_authenticated/fm")({
  component: FMShell,
});
