import { redirect } from "next/navigation";
import { getVerifiedServerSession } from "@/lib/auth/session";
import { getFirstAllowedHref } from "@/lib/auth/permissions";

export default async function SarprasIndexPage() {
  const session = await getVerifiedServerSession();
  redirect(session ? getFirstAllowedHref(session) : "/sarpras/dashboard");
}
