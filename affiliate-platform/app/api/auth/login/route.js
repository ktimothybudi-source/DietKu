import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSupabasePublic } from "@/lib/supabasePublic";
import { setSessionCookie } from "@/lib/auth";
import { getAffiliateCodeColumn } from "@/lib/affiliateCodeColumn";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export async function POST(request) {
  try {
    const { email, password } = schema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const supabasePublic = getSupabasePublic();

    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }

    if (!supabasePublic) {
      return NextResponse.json({ error: "Missing public Supabase credentials." }, { status: 500 });
    }

    const { error: signInError } = await supabasePublic.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });
    if (signInError) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const codeColumn = await getAffiliateCodeColumn(supabase);
    const query = supabase.from("affiliates").select(`id,name,email,${codeColumn}`).limit(1);
    const { data: affiliate, error } = await query.eq("email", email.toLowerCase()).maybeSingle();

    if (error || !affiliate) {
      return NextResponse.json({ error: "Affiliate account not found." }, { status: 404 });
    }

    const response = NextResponse.json({ affiliate });
    setSessionCookie(response, affiliate.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error?.issues?.[0]?.message || "Unable to login." }, { status: 400 });
  }
}
