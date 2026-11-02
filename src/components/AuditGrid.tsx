"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type ICellRendererParams, type RowClassParams } from "ag-grid-community";
import { OutcomeStamp } from "./ui";
import { money } from "@/lib/format";

ModuleRegistry.registerModules([AllCommunityModule]);

// The audit log: every decision Standby made on your watches, in one grid. "Verify the chain" recomputes
// every seal on the server and marks each row intact or changed.

export type AuditRow = {
  id: string;
  seq: number;
  at: string;
  watchId: string;
  watch: string;
  store: string;
  demo: boolean;
  offer: string;
  scout: string;
  scoutBy: string;
  banker: string;
  bankerBy: string;
  vault: string;
  outcome: string;
  totalCents: number | null;
  currency: string;
  paid: boolean;
  capture: string | null;
  decidedBy: string;
  seal: string;
  changed: boolean;
};
type Row = AuditRow & { integrity?: "ok" | "broken"; problem?: string | null; totals?: Totals };
type Totals = { shown: number; paidCents: number; paidCount: number; blocked: number; askedYou: number };
type Verify = { checkedAt: string; total: number; broken: number; checks: { id: string; ok: boolean; problem: string | null }[] };

const theme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 600,
  accentColor: "#e8930c",
  borderColor: "#e4e7ec",
  headerBackgroundColor: "#f4f5f7",
  foregroundColor: "#0e1525",
  wrapperBorderRadius: 16,
  rowHeight: 52,
  headerHeight: 40,
});

const FILTERS: { key: string; label: string; test: (r: Row) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "paid", label: "Paid", test: (r) => r.paid },
  { key: "found", label: "Found", test: (r) => r.outcome === "FOUND" },
  { key: "you", label: "Asked you", test: (r) => ["NEEDS_YOU", "DENIED", "APPROVED", "YOU_BOUGHT", "PASSED"].includes(r.outcome) },
  { key: "blocked", label: "Blocked by the Vault", test: (r) => r.outcome === "BLOCKED" },
  { key: "skipped", label: "Skipped", test: (r) => r.outcome === "SKIPPED" },
];

const VERDICT: Record<string, { icon: string; cls: string }> = {
  yes: { icon: "✓", cls: "bg-good-soft text-good" },
  pass: { icon: "✓", cls: "bg-good-soft text-good" },
  no: { icon: "✕", cls: "bg-bad-soft text-bad" },
  block: { icon: "✕", cls: "bg-bad-soft text-bad" },
  "red flag": { icon: "!", cls: "bg-warn-soft text-warn" },
  unsure: { icon: "?", cls: "bg-brand-soft text-brand" },
};

function Verdict({ value, by }: { value: string; by?: string }) {
  const v = VERDICT[value];
  if (!v) return <span className="text-muted">—</span>;
  return (
    <span className="flex h-full items-center gap-1.5 leading-none">
      <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black leading-none ${v.cls}`} aria-hidden>
        {v.icon}
      </span>
      <span className="leading-tight">
        <span className="block capitalize">{value}</span>
        {by && <span className="block text-[11px] text-muted">{by}</span>}
      </span>
    </span>
  );
}

function TotalsCell(p: ICellRendererParams<Row>) {
  const t = p.data?.totals;
  if (!t) return null;
  const col = p.column?.getColId();
  if (col === "at") return <span className="font-semibold">{t.shown} decision{t.shown === 1 ? "" : "s"} shown</span>;
  if (col === "watch")
    return (
      <span className="text-muted">
        {t.blocked} blocked · {t.askedYou} asked you
      </span>
    );
  if (col === "totalCents")
    return (
      <span className="flex h-full flex-col items-end justify-center leading-tight">
        <span className="tabular font-semibold text-good">{money(t.paidCents)}</span>
        <span className="text-[11px] text-muted">
          paid · {t.paidCount} purchase{t.paidCount === 1 ? "" : "s"}
        </span>
      </span>
    );
  return null;
}

export default function AuditGrid() {
  const router = useRouter();
  const api = useRef<GridApi<Row> | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [verify, setVerify] = useState<Verify | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/audit", { cache: "no-store" });
    if (res.ok) setRows(await res.json());
  }, []);
  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  // Rows with the latest integrity result attached.
  const shown = useMemo(() => {
    if (!rows) return null;
    const byId = new Map(verify?.checks.map((c) => [c.id, c]) ?? []);
    return rows.map((r) => {
      const c = byId.get(r.id);
      return c ? { ...r, integrity: c.ok ? ("ok" as const) : ("broken" as const), problem: c.problem } : r;
    });
  }, [rows, verify]);

  async function runVerify() {
    setBusy("verify");
    setNote(null);
    const res = await fetch("/api/audit/verify", { method: "POST" });
    if (res.ok) setVerify(await res.json());
    setBusy(null);
  }

  async function tamper(action: "change" | "restore") {
    setBusy(action);
    setNote(null);
    const res = await fetch("/api/audit/tamper", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const json = await res.json();
    if (!res.ok) setNote(json.error);
    else if (action === "change") setNote(`Changed the price recorded on “${json.offer}” from ${money(json.from)} to ${money(json.to)}, without touching its seal. Now press Verify the chain.`);
    else setNote(`Put ${json.restored} decision${json.restored === 1 ? "" : "s"} back exactly as sealed. Verify again to see it intact.`);
    setVerify(null);
    await load();
    setBusy(null);
  }

  const cols = useMemo<ColDef<Row>[]>(
    () => [
      {
        field: "at",
        headerName: "When",
        width: 150,
        sort: "desc",
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""),
        cellRenderer: (p: ICellRendererParams<Row>) => (p.node.rowPinned ? <TotalsCell {...p} /> : p.valueFormatted),
      },
      {
        field: "watch",
        headerName: "Watch",
        flex: 1.6,
        minWidth: 230,
        cellRenderer: (p: ICellRendererParams<Row>) =>
          p.node.rowPinned ? (
            <TotalsCell {...p} />
          ) : (
            <span className="flex h-full flex-col justify-center leading-tight">
              <span className="truncate font-semibold">{p.data?.watch}</span>
              <span className="truncate text-[11px] text-muted">{p.data?.store}</span>
            </span>
          ),
      },
      { field: "offer", headerName: "Offer", flex: 1, minWidth: 160 },
      { field: "store", headerName: "Store", hide: true },
      { field: "scoutBy", headerName: "Scout model", hide: true },
      { field: "bankerBy", headerName: "Banker model", hide: true },
      { field: "scout", headerName: "Scout", width: 128, cellRenderer: (p: ICellRendererParams<Row>) => !p.node.rowPinned && <Verdict value={p.value} by={p.data?.scoutBy} /> },
      { field: "banker", headerName: "Banker", width: 128, cellRenderer: (p: ICellRendererParams<Row>) => !p.node.rowPinned && <Verdict value={p.value} by={p.data?.bankerBy} /> },
      { field: "vault", headerName: "Vault", width: 110, cellRenderer: (p: ICellRendererParams<Row>) => !p.node.rowPinned && <Verdict value={p.value} by="code" /> },
      {
        field: "outcome",
        headerName: "Outcome",
        width: 150,
        cellRenderer: (p: ICellRendererParams<Row>) =>
          !p.node.rowPinned && (
            <span className="flex h-full items-center">
              <OutcomeStamp outcome={p.value} />
            </span>
          ),
      },
      {
        field: "totalCents",
        headerName: "Total",
        width: 120,
        type: "rightAligned",
        cellRenderer: (p: ICellRendererParams<Row>) => (p.node.rowPinned ? <TotalsCell {...p} /> : <span className="tabular">{p.value != null ? money(p.value, p.data?.currency) : "—"}</span>),
      },
      { field: "capture", headerName: "PayPal capture", width: 170, cellClass: "font-mono text-xs", valueFormatter: (p) => p.value ?? "" },
      { field: "decidedBy", headerName: "Decided by", width: 115 },
      {
        field: "seal",
        headerName: "Seal",
        width: 140,
        cellClass: "font-mono text-xs",
        valueFormatter: (p) => (p.value ? `#${p.data?.seq} · ${String(p.value).slice(0, 8)}…` : ""),
        tooltipValueGetter: (p) => p.value,
      },
      {
        colId: "integrity",
        headerName: "Chain",
        width: 130,
        valueGetter: (p) => p.data?.integrity ?? "",
        tooltipValueGetter: (p) => p.data?.problem ?? undefined,
        cellRenderer: (p: ICellRendererParams<Row>) =>
          p.node.rowPinned ? null : p.data?.integrity === "ok" ? (
            <span className="font-semibold text-good">✓ Intact</span>
          ) : p.data?.integrity === "broken" ? (
            <span className="font-semibold text-bad">✕ Changed</span>
          ) : (
            <span className="text-muted">Not checked</span>
          ),
      },
    ],
    [],
  );

  const recount = useCallback(() => {
    const g = api.current;
    if (!g) return;
    const t: Totals = { shown: 0, paidCents: 0, paidCount: 0, blocked: 0, askedYou: 0 };
    g.forEachNodeAfterFilter((n) => {
      const r = n.data;
      if (!r) return;
      t.shown++;
      if (r.paid) {
        t.paidCents += r.totalCents ?? 0;
        t.paidCount++;
      }
      if (r.outcome === "BLOCKED") t.blocked++;
      if (r.decidedBy === "You" || r.outcome === "NEEDS_YOU") t.askedYou++;
    });
    setTotals(t);
  }, []);

  useEffect(() => {
    api.current?.onFilterChanged();
  }, [filter]);

  const pinned = useMemo(() => (totals ? [{ totals } as unknown as Row] : []), [totals]);

  return (
    <div className="space-y-4">
      {/* Integrity check */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
        <div className="min-w-0 flex-1">
          {verify ? (
            verify.broken === 0 ? (
              <p className="font-semibold text-good">
                ✓ All {verify.total} decisions intact.{" "}
                <span className="font-normal text-muted">Every seal recomputed and every link checked at {new Date(verify.checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}.</span>
              </p>
            ) : (
              <p className="font-semibold text-bad">
                ✕ {verify.broken} of {verify.total} decision{verify.total === 1 ? "" : "s"} changed after sealing.{" "}
                <span className="font-normal">The changed rows are marked in red below; hover for what&apos;s wrong.</span>
              </p>
            )
          ) : (
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">Every decision is sealed to the one before it.</span> Verifying recomputes each seal from what was decided on, so any later edit shows up.
            </p>
          )}
          {note && <p className="mt-1 text-sm text-ink/80">{note}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={runVerify} disabled={!!busy} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
            {busy === "verify" ? "Checking…" : "Verify the chain"}
          </button>
          {rows?.some((r) => r.changed) ? (
            <button type="button" onClick={() => tamper("restore")} disabled={!!busy} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:border-ink disabled:opacity-50">
              Put it back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => tamper("change")}
              disabled={!!busy || !rows?.some((r) => r.demo)}
              title="Demo only: edits one of your own past demo decisions so you can see Verify catch it"
              className="rounded-xl border border-dashed border-bad/40 px-3 py-2 text-sm font-semibold text-bad hover:border-bad disabled:opacity-40"
            >
              Try changing history (demo)
            </button>
          )}
        </div>
      </div>

      {/* Search, quick filters and export */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search watches, offers, captures…"
          aria-label="Search the audit log"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink sm:w-72"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === f.key ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => api.current?.exportDataAsCsv({ fileName: "standby-audit-log.csv", columnKeys: ["at", "watch", "store", "offer", "scout", "scoutBy", "banker", "bankerBy", "vault", "outcome", "totalCents", "capture", "decidedBy", "seal", "integrity"] })}
          className="ml-auto rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-ink"
        >
          Export CSV
        </button>
      </div>

      {/* Short logs fit their rows; long ones scroll inside a fixed height. */}
      <div className={(shown?.length ?? 0) > 10 ? "h-[560px]" : ""}>
        <AgGridReact<Row>
          domLayout={(shown?.length ?? 0) > 10 ? "normal" : "autoHeight"}
          theme={theme}
          rowData={shown ?? undefined}
          loading={!shown}
          columnDefs={cols}
          defaultColDef={{ sortable: true, resizable: true, filter: true }}
          getRowId={(p) => p.data.id ?? "totals"}
          quickFilterText={search}
          isExternalFilterPresent={() => filter !== "all"}
          doesExternalFilterPass={(n) => (n.data ? (FILTERS.find((f) => f.key === filter)?.test(n.data) ?? true) : true)}
          pinnedBottomRowData={pinned}
          onGridReady={(e) => {
            api.current = e.api;
          }}
          onModelUpdated={recount}
          getRowClass={(p: RowClassParams<Row>) => (p.data?.integrity === "broken" ? "!bg-bad-soft" : p.node.rowPinned ? "!bg-bg font-medium" : "cursor-pointer")}
          onRowClicked={(e) => {
            if (!e.node.rowPinned && e.data) router.push(`/app/w/${e.data.watchId}`);
          }}
          tooltipShowDelay={300}
          overlayNoRowsTemplate="No decisions yet. When Scout, the Banker and the Vault weigh an offer, it's recorded here."
        />
      </div>
    </div>
  );
}
