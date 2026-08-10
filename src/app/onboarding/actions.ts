"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type CreateBusinessState = {
  error: string | null;
};

const businessNameSchema = z.string().trim().min(1).max(120);

export async function createBusinessAction(
  _previousState: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const parsedName = businessNameSchema.safeParse(formData.get("businessName"));
  if (!parsedName.success) {
    return { error: "Enter a business name between 1 and 120 characters." };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase.rpc("create_business", {
    display_name: parsedName.data,
  });

  if (error) return { error: "Your business could not be created. Please try again." };
  redirect("/dashboard");
}
