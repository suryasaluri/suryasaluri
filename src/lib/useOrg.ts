import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrg() {
  return useQuery({
    queryKey: ["org"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("no user");
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user.user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
