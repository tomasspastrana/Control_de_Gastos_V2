import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppData } from "@/lib/data";
import { TarjeteroApp } from "@/components/tarjetero/TarjeteroApp";

// Reads cookies/auth + per-user data on every request; never prerender at build.
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const data = await getAppData(user.id);

  return <TarjeteroApp data={data} userEmail={user.email ?? ""} />;
}
