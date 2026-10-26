import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Complex, Resident } from "@/lib/db-types";

// This demo seeds exactly one complex (Sanview Heights Owners' Association).
// A multi-complex deployment would scope this by the staff member's
// assignment or let them switch complexes.
export function useComplex() {
  return useQuery({
    queryKey: ["fm-complex"],
    queryFn: async (): Promise<Complex | null> => {
      const { data, error } = await supabase.from("complexes").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMyResident() {
  return useQuery({
    queryKey: ["my-resident"],
    queryFn: async (): Promise<Resident | null> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!customer) return null;
      const { data, error } = await supabase
        .from("residents")
        .select("*")
        .eq("customer_id", customer.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
