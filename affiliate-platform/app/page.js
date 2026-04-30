import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function Home() {
  const hasSession = Boolean(cookies().get("affiliate_session")?.value);
  redirect(hasSession ? "/dashboard" : "/login");
}
