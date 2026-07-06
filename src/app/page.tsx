import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TarjeteroApp } from "@/components/tarjetero/TarjeteroApp";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <TarjeteroApp userEmail={user.email ?? ""} />;
}
