import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Customer, Profile } from "@/lib/db-types";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

export function useMyCustomer() {
  return useQuery({
    queryKey: ["my-customer"],
    queryFn: async (): Promise<Customer> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}
