import { requireOwner } from "@/lib/owner";
import { AppHeader } from "@/components/ui";
import BackLink from "@/components/BackLink";
import AuditGrid from "@/components/AuditGrid";

export const dynamic = "force-dynamic";

// The audit log: every decision Standby made for you, sealed in order and checkable.
export default async function AuditPage() {
  await requireOwner("/app/audit");
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6">
        <BackLink />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 max-w-3xl text-muted">
          Every decision Scout, the Banker and the Vault made on your watches, including the ones that never paid. Each is sealed to the one before it, so nothing can be quietly changed or removed.
        </p>
        <div className="mt-5">
          <AuditGrid />
        </div>
      </main>
    </div>
  );
}
