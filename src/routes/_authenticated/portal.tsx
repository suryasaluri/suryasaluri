import { createFileRoute, redirect } from "@tanstack/react-router";
import { CustomerShell } from "@/components/CustomerShell";

export const Route = createFileRoute("/_authenticated/portal")({
  beforeLoad: ({ context }) => {
    if (context.profile.role !== "customer") throw redirect({ to: "/admin" });
  },
  component: CustomerShell,
});
