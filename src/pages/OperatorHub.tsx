import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { operatorSupabaseAnonKey as supabaseAnonKey, operatorSupabaseUrl as supabaseUrl } from "@/lib/supabaseOperator";
import { Info } from "lucide-react";
import logoDark from "@/assets/axivo-logo-dark.png";
import logoLight from "@/assets/axivo-logo-light.png";

type QueueView = "New" | "Hot" | "Stuck" | "Overdue";
type QueueState = "loading" | "ready" | "error";

type QueueLead = {
  id: string;
  name: string;
  source: string;
  stage: string;
  owner: string;
  priority: "Low" | "Medium" | "High";
  followUpDue: string;
  lastAction: string;
};

type OwnerOption = { id: string; name: string; role?: string; ibType?: string; parentId?: string | null };
type MomentumStats = { percent: number; actions: number; target: number; followups: number; overdueCleared: number };
type MasterView = 'all' | 'qualified' | 'funded' | 'active' | 'inactive' | 'nurture_lost';
type MasterRecord = {
  id: string;
  full_name: string;
  source_channel: string | null;
  current_stage: string | null;
  assigned_to: string | null;
  priority: string | null;
  followup_due_at: string | null;
  updated_at: string | null;
};

const LIFECYCLE_STAGES = [
  ['new_lead', 'New Lead'],
  ['contacted', 'Contacted'],
  ['qualified', 'Qualified'],
  ['kyc_started', 'KYC Started'],
  ['kyc_approved', 'KYC Approved'],
  ['funded', 'Funded'],
  ['trading', 'Trading'],
  ['inactive', 'Inactive'],
  ['reactivation', 'Reactivation'],
  ['lost', 'Lost'],
] as const;

const STAGE_TRANSITIONS: Record<string, string[]> = {
  new_lead: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['kyc_started', 'lost'],
  kyc_started: ['kyc_approved', 'inactive', 'lost'],
  kyc_approved: ['funded', 'lost'],
  funded: ['trading', 'inactive'],
  trading: ['inactive', 'reactivation'],
  inactive: ['reactivation', 'lost'],
  reactivation: ['contacted', 'qualified', 'lost'],
  lost: ['reactivation', 'new_lead'],
};

const ownerNameCache = new Map<string, string>();

const InfoHint = ({ text }: { text: string }) => (
  <button
    type="button"
    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
    title={text}
    aria-label={text}
  >
    <Info size={12} />
  </button>
);

const WEBHOOKS = {
  reassign: import.meta.env.VITE_WEBHOOK_REASSIGN as string | undefined,
  stage: import.meta.env.VITE_WEBHOOK_CHANGE_STAGE as string | undefined,
  followup: import.meta.env.VITE_WEBHOOK_TRIGGER_FOLLOWUP as string | undefined,
  outcome: import.meta.env.VITE_WEBHOOK_MARK_OUTCOME as string | undefined,
  lost: import.meta.env.VITE_WEBHOOK_MARK_LOST as string | undefined,
  won: import.meta.env.VITE_WEBHOOK_MARK_WON as string | undefined,
  nurture: import.meta.env.VITE_WEBHOOK_MARK_NURTURE as string | undefined,
};

const queueViews: QueueView[] = ["New", "Hot", "Stuck", "Overdue"];

const queueSeed: Record<QueueView, QueueLead[]> = {
  New: [],
  Hot: [],
  Stuck: [
    { id: "L-1050", name: "Karla Uy", source: "Messenger", stage: "Needs Reply", owner: "Jet", priority: "Medium", followUpDue: "Overdue 1d", lastAction: "Awaiting response" },
  ],
  Overdue: [],
};

function normalizePriority(value: unknown): "Low" | "Medium" | "High" {
  const n = Number(value);
  if (n >= 2) return "High";
  if (n === 1) return "Medium";
  return "Low";
}

function buildQueueQuery(view: QueueView): URLSearchParams {
  const base = {
    select: "id,full_name,source_channel,current_stage,assigned_to,priority,followup_due_at,stuck_reason,created_at,updated_at",
    order: "created_at.desc",
    limit: "25",
  } as Record<string, string>;

  if (view === "New") {
    return new URLSearchParams({ ...base, current_stage: "eq.new_lead" });
  }

  if (view === "Hot") {
    return new URLSearchParams({
      ...base,
      priority: "in.(high,urgent)",
      current_stage: "in.(contacted,qualified,kyc_started,kyc_approved,reactivation)",
    });
  }

  if (view === "Stuck") {
    return new URLSearchParams({ ...base, current_stage: "in.(kyc_started,inactive,reactivation)" });
  }

  return new URLSearchParams({ ...base, followup_due_at: "lt.NOW()", current_stage: "not.in.(lost,trading,funded,won)" });
}

async function resolveOwnerNames(ownerIds: string[]): Promise<Map<string, string>> {
  const unresolved = ownerIds.filter((id) => id && !ownerNameCache.has(id));
  if (!unresolved.length) return ownerNameCache;

  const selectVariants = [
    'id,full_name',
    'id,name',
    'id,display_name',
  ];

  for (const select of selectVariants) {
    const ids = unresolved.map((id) => `"${id}"`).join(',');
    const query = new URLSearchParams({ select, id: `in.(${ids})` });
    const res = await fetch(`${supabaseUrl}/rest/v1/users?${query.toString()}`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) continue;
    const rows = (await res.json()) as Array<any>;
    rows.forEach((r) => {
      const name = r.full_name || r.name || r.display_name;
      if (r.id && name) ownerNameCache.set(r.id, name);
    });
    break;
  }

  return ownerNameCache;
}

async function fetchOwnerOptions(): Promise<OwnerOption[]> {
  const res = await fetch(`${supabaseUrl}/rest/v1/users?select=id,name,role,ib_type,parent_ib_id&order=created_at.asc`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error('Failed to load owners');
  const rows = (await res.json()) as Array<any>;
  return rows
    .filter((r) => r.id)
    .map((r) => ({
      id: r.id,
      name: r.name || r.id,
      role: r.role,
      ibType: r.ib_type,
      parentId: r.parent_ib_id,
    }));
}

async function fetchMomentumStats(): Promise<MomentumStats> {
  const target = 12;
  const now = new Date();
  const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

  const [leadUpdatesRes, followupsRes, clearedRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/leads?select=id&updated_at=gte.${encodeURIComponent(startUtc)}`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
    fetch(`${supabaseUrl}/rest/v1/follow_up_tasks?select=id&created_at=gte.${encodeURIComponent(startUtc)}`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
    fetch(`${supabaseUrl}/rest/v1/leads?select=id&updated_at=gte.${encodeURIComponent(startUtc)}&followup_due_at=gt.now()`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
  ]);

  if (!leadUpdatesRes.ok || !followupsRes.ok || !clearedRes.ok) {
    throw new Error('Failed to load momentum stats');
  }

  const [leadUpdates, followups, cleared] = await Promise.all([
    leadUpdatesRes.json() as Promise<any[]>,
    followupsRes.json() as Promise<any[]>,
    clearedRes.json() as Promise<any[]>,
  ]);

  const actions = (leadUpdates?.length || 0) + (followups?.length || 0);
  const percent = Math.min(100, Math.round((actions / target) * 100));

  return {
    percent,
    actions,
    target,
    followups: followups?.length || 0,
    overdueCleared: cleared?.length || 0,
  };
}

async function fetchMasterList(): Promise<MasterRecord[]> {
  const q = new URLSearchParams({
    select: 'id,full_name,source_channel,current_stage,assigned_to,priority,followup_due_at,updated_at',
    order: 'updated_at.desc',
    limit: '500',
  });
  const res = await fetch(`${supabaseUrl}/rest/v1/leads?${q.toString()}`, {
    headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
  });
  if (!res.ok) throw new Error('Failed to load master list');
  return (await res.json()) as MasterRecord[];
}

async function fetchQueueFromSupabase(view: QueueView): Promise<QueueLead[]> {
  const query = buildQueueQuery(view);
  const response = await fetch(`${supabaseUrl}/rest/v1/leads?${query.toString()}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Lead source read failed (${response.status}): ${details}`);
  }

  const rows = (await response.json()) as Array<any>;
  const ownerIds = Array.from(new Set(rows.map((r) => r.assigned_to).filter(Boolean)));
  const ownerMap = await resolveOwnerNames(ownerIds as string[]);

  return rows.map((row) => ({
    id: row.id,
    name: row.full_name || "Untitled lead",
    source: row.source_channel || "Unknown",
    stage: row.current_stage || "new",
    owner: row.assigned_to ? (ownerMap.get(row.assigned_to) || row.assigned_to) : "unassigned",
    priority: typeof row.priority === 'string'
      ? (['high', 'urgent'].includes(String(row.priority).toLowerCase()) ? 'High' : ['medium', 'normal'].includes(String(row.priority).toLowerCase()) ? 'Medium' : 'Low')
      : normalizePriority(row.priority),
    followUpDue: row.followup_due_at ? new Date(row.followup_due_at).toLocaleString() : "TBD",
    lastAction: row.stuck_reason || (row.updated_at ? `Updated ${new Date(row.updated_at).toLocaleString()}` : "No action yet"),
  }));
}

const OperatorHub = () => {
  const [activeView, setActiveView] = useState<QueueView>("New");
  const [queueState, setQueueState] = useState<QueueState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [leadData, setLeadData] = useState<Record<QueueView, QueueLead[]>>(queueSeed);
  const [selectedLead, setSelectedLead] = useState<QueueLead | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [reassignTo, setReassignTo] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [nextStage, setNextStage] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [finalOutcome, setFinalOutcome] = useState("");
  const [actionBusy, setActionBusy] = useState<"reassign" | "stage" | "followup" | "outcome" | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [momentum, setMomentum] = useState<MomentumStats>({ percent: 58, actions: 7, target: 12, followups: 4, overdueCleared: 2 });
  const [masterView, setMasterView] = useState<MasterView>('all');
  const [masterSearch, setMasterSearch] = useState('');
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterFollowup, setFilterFollowup] = useState('all');
  const [masterRows, setMasterRows] = useState<MasterRecord[]>([]);

  const postWebhook = async (url: string | undefined, payload: Record<string, unknown>) => {
    if (!url) throw new Error("Missing webhook URL for this action.");
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Webhook failed (${res.status}): ${txt}`);
    }
  };

  const refreshQueues = async (focusView: QueueView, preserveLeadId?: string) => {
    const views: QueueView[] = ["New", "Hot", "Stuck", "Overdue"];
    const rowsByView = await Promise.all(views.map((v) => fetchQueueFromSupabase(v)));

    const nextLeadData = views.reduce((acc, v, i) => {
      acc[v] = rowsByView[i];
      return acc;
    }, {} as Record<QueueView, QueueLead[]>);

    setLeadData(nextLeadData);

    const allLeads = views.flatMap((v) => nextLeadData[v]);
    const preserved = preserveLeadId ? allLeads.find((l) => l.id === preserveLeadId) : null;
    const focusedFirst = nextLeadData[focusView]?.[0] ?? null;
    setSelectedLead(preserved ?? focusedFirst ?? null);
  };

  const runAction = async (
    action: "reassign" | "stage" | "followup" | "outcome",
    payload: Record<string, unknown>,
    endpoint: string | undefined,
  ) => {
    try {
      setActionBusy(action);
      setActionMessage("");
      const currentLeadId = selectedLead?.id;
      await postWebhook(endpoint, payload);
      await refreshQueues(activeView, currentLeadId);
      setActionMessage(`${action} action sent successfully and queues refreshed.`);
    } catch (err: any) {
      setActionMessage(err?.message || `Failed to run ${action} action.`);
    } finally {
      setActionBusy(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadOwners() {
      try {
        const owners = await fetchOwnerOptions();
        if (!cancelled) setOwnerOptions(owners);
      } catch {
        if (!cancelled) setOwnerOptions([]);
      }
    }

    void loadOwners();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((n) => n + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stats, master] = await Promise.all([fetchMomentumStats(), fetchMasterList()]);
        if (!cancelled) {
          setMomentum(stats);
          setMasterRows(master);
        }
      } catch {
        // keep last known value
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadQueue() {
      setQueueState("loading");
      setErrorMessage("");

      try {
        const rows = await fetchQueueFromSupabase(activeView);
        if (cancelled) return;

        setLeadData((prev) => ({ ...prev, [activeView]: rows }));
        setSelectedLead(rows[0] ?? null);
        setQueueState("ready");
      } catch (error: any) {
        if (cancelled) return;
        setErrorMessage(error?.message || "Queue load failed");
        setQueueState("error");
      }
    }

    void loadQueue();
    return () => {
      cancelled = true;
    };
  }, [activeView, refreshTick]);

  const activeLeads = useMemo(() => leadData[activeView], [activeView, leadData]);

  const selectedStage = String(selectedLead?.stage || '').toLowerCase();
  const allowedNextStages = (STAGE_TRANSITIONS[selectedStage] || LIFECYCLE_STAGES.map(([v]) => v))
    .filter((v) => v !== selectedStage);

  const lifecycleCounts = useMemo(() => {
    const rows = masterRows;
    const funded = rows.filter((r) => ['funded', 'won', 'funded_client'].includes(String(r.current_stage || '').toLowerCase())).length;
    const active = rows.filter((r) => ['trading', 'active_trader', 'active'].includes(String(r.current_stage || '').toLowerCase())).length;
    const inactive = rows.filter((r) => ['inactive', 'dormant', 'reactivation'].includes(String(r.current_stage || '').toLowerCase())).length;
    return { funded, active, inactive };
  }, [masterRows]);

  const ownerLabel = (ownerId?: string | null) => ownerId ? (ownerOptions.find((o) => o.id === ownerId)?.name || ownerId) : 'unassigned';
  const uniqueSources = Array.from(new Set(masterRows.map((r) => r.source_channel).filter(Boolean))) as string[];
  const uniqueStages = Array.from(new Set(masterRows.map((r) => r.current_stage).filter(Boolean))) as string[];

  const stageIn = (stage: string, values: string[]) => values.includes(stage);

  const filteredMasterRows = masterRows.filter((r) => {
    const stage = String(r.current_stage || '').toLowerCase();
    const priority = String(r.priority || '').toLowerCase();
    const isOverdue = !!r.followup_due_at && new Date(r.followup_due_at).getTime() < Date.now();

    const stageMap = {
      qualified: ['qualified', 'kyc_started', 'kyc_approved'],
      funded: ['funded', 'won', 'funded_client'],
      active: ['trading', 'active_trader', 'active'],
      inactive: ['inactive', 'dormant', 'reactivation'],
      nurture_lost: ['nurture', 'lost'],
    } as const;

    const byView =
      masterView === 'all' ? true :
      masterView === 'qualified' ? stageIn(stage, stageMap.qualified) :
      masterView === 'funded' ? stageIn(stage, stageMap.funded) :
      masterView === 'active' ? stageIn(stage, stageMap.active) :
      masterView === 'inactive' ? stageIn(stage, stageMap.inactive) :
      stageIn(stage, stageMap.nurture_lost);

    const search = masterSearch.trim().toLowerCase();
    const bySearch = !search || [r.full_name, r.source_channel, ownerLabel(r.assigned_to), r.current_stage, isOverdue ? 'overdue' : 'ontrack']
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(search));

    const byOwner = filterOwner === 'all' || r.assigned_to === filterOwner;
    const bySource = filterSource === 'all' || r.source_channel === filterSource;
    const byStage = filterStage === 'all' || stage === filterStage;
    const byPriority = filterPriority === 'all' || priority === filterPriority;
    const byFollowup = filterFollowup === 'all' || (filterFollowup === 'overdue' ? isOverdue : !isOverdue);

    return byView && bySearch && byOwner && bySource && byStage && byPriority && byFollowup;
  });

  return (
    <div className="operator-bg min-h-screen px-4 py-6 md:px-8 lg:px-12">
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="premium-glass rounded-xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={logoDark} alt="AXIVO logo" className="h-9 w-9 dark:hidden" />
              <img src={logoLight} alt="AXIVO logo" className="hidden h-9 w-9 dark:block" />
              <div className="leading-none">
                <h1 className="text-2xl font-bold tracking-tight">AXIVO</h1>
                <p className="-mt-[5px] text-xs text-muted-foreground">IB/BROKER Operator Hub v1</p>
              </div>
            </div>
            <Badge variant="secondary">Live</Badge>
          </div>
        </div>

        <div className="premium-glass rounded-xl border border-white/20 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-center">
            <div className="md:col-span-3">
              <div className="text-lg font-semibold">Momentum <span className="ml-1 text-xs text-[#b8d965]">● Live</span></div>
              <p className="text-xs text-muted-foreground">One action keeps it moving.</p>
            </div>
            <div className="md:col-span-5">
              <div className="mb-1 text-xs font-medium">Today’s progress</div>
              <div className="h-2 w-full rounded-full bg-black/20">
                <div className="h-2 rounded-full bg-[#b8d965]" style={{ width: `${momentum.percent}%` }} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{momentum.percent}% · {momentum.actions} / {momentum.target} actions</div>
            </div>
            <div className="md:col-span-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-white/20 p-2">
                <div className="text-lg font-semibold">{lifecycleCounts.funded}</div>
                <div className="text-xs text-muted-foreground">funded</div>
              </div>
              <div className="rounded-md border border-white/20 p-2">
                <div className="text-lg font-semibold">{lifecycleCounts.active}</div>
                <div className="text-xs text-muted-foreground">active</div>
              </div>
              <div className="rounded-md border border-white/20 p-2">
                <div className="text-lg font-semibold">{lifecycleCounts.inactive}</div>
                <div className="text-xs text-muted-foreground">inactive/reactivation</div>
              </div>
            </div>
          </div>
        </div>

        <div className="premium-glass rounded-xl border border-white/20 px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-base font-semibold">Master List / Full CRM View</div>
            <div className="text-xs text-muted-foreground">{filteredMasterRows.length} records</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ['all','All Leads'],
              ['qualified','Qualified'],
              ['funded','Funded'],
              ['active','Active Traders'],
              ['inactive','Inactive / Dormant'],
              ['nurture_lost','Nurture / Lost'],
            ] as Array<[MasterView,string]>).map(([k,label]) => (
              <Button key={k} size="sm" variant="outline" className={masterView===k? 'queue-tab-active' : 'border-[#8ea24a]/35 bg-[#eef6d4] text-[#2f3012] dark:bg-[#2f3012]/90 dark:text-slate-100'} onClick={() => setMasterView(k)}>{label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <Input placeholder="Search name, source, owner, stage, follow-up" value={masterSearch} onChange={(e)=>setMasterSearch(e.target.value)} className="md:col-span-2" />
            <Select value={filterOwner} onValueChange={setFilterOwner}><SelectTrigger><SelectValue placeholder="Owner / IB" /></SelectTrigger><SelectContent><SelectItem value="all">All owners</SelectItem>{ownerOptions.map(o=><SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
            <Select value={filterSource} onValueChange={setFilterSource}><SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{uniqueSources.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={filterStage} onValueChange={setFilterStage}><SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger><SelectContent><SelectItem value="all">All stages</SelectItem>{uniqueStages.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}><SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger><SelectContent><SelectItem value="all">All priorities</SelectItem><SelectItem value="urgent">urgent</SelectItem><SelectItem value="high">high</SelectItem><SelectItem value="medium">medium</SelectItem><SelectItem value="normal">normal</SelectItem><SelectItem value="low">low</SelectItem></SelectContent></Select>
            <Select value={filterFollowup} onValueChange={setFilterFollowup}><SelectTrigger><SelectValue placeholder="Follow-up status" /></SelectTrigger><SelectContent><SelectItem value="all">All follow-up</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="ontrack">On track</SelectItem></SelectContent></Select>
          </div>
          <div className="glass-scroll max-h-[280px] overflow-y-auto rounded-md border border-white/20">
            <table className="w-full text-sm">
              <thead className="bg-black/10 sticky top-0"><tr className="text-left"><th className="p-2">Name</th><th className="p-2">Source</th><th className="p-2">Owner / IB</th><th className="p-2">Stage</th><th className="p-2">Priority</th><th className="p-2">Follow-up</th></tr></thead>
              <tbody>
                {filteredMasterRows.map((r)=>{const overdue=!!r.followup_due_at && new Date(r.followup_due_at).getTime()<Date.now(); return <tr key={r.id} className="border-t border-white/10"><td className="p-2 font-medium">{r.full_name}</td><td className="p-2">{r.source_channel || '-'}</td><td className="p-2">{ownerLabel(r.assigned_to)}</td><td className="p-2">{r.current_stage || '-'}</td><td className="p-2">{r.priority || '-'}</td><td className="p-2">{overdue ? 'Overdue' : 'On track'}</td></tr>})}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="xl:col-span-4">
            <Card className="premium-glass h-full border-white/20 bg-transparent">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Lead Queue</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#8ea24a]/35 bg-[#eef6d4] text-[#2f3012] hover:bg-[#e4efc2] dark:bg-[#2f3012]/90 dark:text-slate-100 dark:hover:bg-[#3a3b16]"
                    onClick={() => setRefreshTick((n) => n + 1)}
                  >
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {queueViews.map((view) => {
                    const isActive = activeView === view;
                    return (
                      <Button
                        key={view}
                        size="sm"
                        variant="outline"
                        className={isActive
                          ? "queue-tab-active min-w-16 border-transparent font-semibold"
                          : "border-[#8ea24a]/35 bg-[#eef6d4] text-[#2f3012] hover:bg-[#e4efc2] dark:bg-[#2f3012]/90 dark:text-slate-100 dark:hover:bg-[#3a3b16]"}
                        onClick={() => setActiveView(view)}
                      >
                        {view}
                      </Button>
                    );
                  })}
                </div>
                <Separator />

                <div className="glass-scroll max-h-[460px] space-y-3 overflow-y-auto pr-1">
                  {queueState === "loading" && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading {activeView} leads...</div>
                  )}

                  {queueState === "error" && (
                    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
                      <div className="font-medium text-destructive">Failed to load {activeView} queue.</div>
                      <div className="text-muted-foreground">{errorMessage}</div>
                      <Button size="sm" variant="outline" onClick={() => setRefreshTick((n) => n + 1)}>Retry</Button>
                    </div>
                  )}

                  {queueState === "ready" && activeLeads.length === 0 && (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No leads in {activeView} queue.
                    </div>
                  )}

                  {queueState === "ready" && activeLeads.length > 0 && (
                    <div className="space-y-2">
                      {activeLeads.map((lead) => (
                        <button
                          key={lead.id}
                          className="w-full rounded-md border border-[#9fb06c] !bg-[#DCEDB4] p-3 text-left text-sm text-[#2c3a16] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] hover:border-[#8ea24a] dark:border-[#9fb06c]/55 dark:!bg-[#121b05] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          onClick={() => setSelectedLead(lead)}
                          type="button"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-[#243111] dark:text-slate-100">{lead.name}</div>
                            <Badge variant="outline" className="border-[#7f9150] text-[#2a3814] dark:border-[#96a965] dark:text-slate-200">{lead.priority}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-[#4a5b2a] dark:text-slate-400">
                            {lead.source} • {lead.stage} • {lead.owner}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="xl:col-span-4">
            <Card className="premium-glass h-full border-white/20 bg-transparent">
              <CardHeader>
                <CardTitle>Lead Detail Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!selectedLead && <div className="text-muted-foreground">Select a lead from queue.</div>}
                {selectedLead && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-[#8ea24a]/35 !bg-[#DCEDB4] p-3 text-[#2c3a16] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-[#8ea24a]/24 dark:!bg-[#1f210d] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="text-lg font-semibold leading-tight">{selectedLead.name}</div>
                      <div className="mt-1 text-xs text-[#4a5b2a] dark:text-slate-300">Lead ID: {selectedLead.id}</div>

                      <div className="mt-3 space-y-1.5 text-sm">
                        <div><span className="text-[#4a5b2a] dark:text-slate-300">source:</span> {selectedLead.source}</div>
                        <div><span className="text-[#4a5b2a] dark:text-slate-300">stage:</span> {selectedLead.stage}</div>
                        <div><span className="text-[#4a5b2a] dark:text-slate-300">owner:</span> {selectedLead.owner}</div>
                        <div><span className="text-[#4a5b2a] dark:text-slate-300">priority:</span> {selectedLead.priority}</div>
                        <div><span className="text-[#4a5b2a] dark:text-slate-300">follow-up due:</span> {selectedLead.followUpDue}</div>
                        <div><span className="text-[#4a5b2a] dark:text-slate-300">last action:</span> {selectedLead.lastAction}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="xl:col-span-4">
            <Card className="premium-glass h-full border-white/20 bg-transparent">
              <CardHeader>
                <CardTitle>Action Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {!selectedLead && <div className="text-muted-foreground">Select a lead to unlock actions.</div>}
                {actionMessage && <div className="rounded-md border p-2 text-xs text-muted-foreground">{actionMessage}</div>}

                <div className="premium-glass reassign-glass space-y-2 rounded-md border p-3 text-[#2c3a16] dark:text-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="reassign-to">Reassign</Label>
                    <InfoHint text="Assign this lead to another owner using their UUID." />
                  </div>
                  <Select value={reassignTo} onValueChange={setReassignTo} disabled={!selectedLead || ownerOptions.length === 0}>
                    <SelectTrigger id="reassign-to" className="glass-carved-field reassign-outline bg-[#dcedb4] text-[#2c3a16] dark:bg-transparent dark:text-slate-100">
                      <SelectValue placeholder={ownerOptions.length ? "Select assignee" : "No owners found"} />
                    </SelectTrigger>
                    <SelectContent className="border-[#9fb06c] bg-[#dcedb4]/95 text-[#2c3a16] backdrop-blur-md dark:border-[#8ea24a]/40 dark:bg-[#2f3012]/95 dark:text-slate-100">
                      {ownerOptions.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="reassign-cta action-cta w-full font-semibold"
                    disabled={!selectedLead || !reassignTo.trim() || actionBusy !== null}
                    onClick={() => selectedLead && runAction('reassign', {
                      lead_id: selectedLead.id,
                      assigned_to: reassignTo.trim(),
                    }, WEBHOOKS.reassign)}
                  >
                    {actionBusy === 'reassign' ? 'Sending…' : 'Reassign Lead'}
                  </Button>
                </div>

                <div className="premium-glass reassign-glass space-y-2 rounded-md border p-3 text-[#2c3a16] dark:text-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Label>Change Stage</Label>
                    <InfoHint text="Move lead through pipeline stages: new, contacted, qualified, or stuck." />
                  </div>
                  <Select value={nextStage} onValueChange={setNextStage} disabled={!selectedLead}>
                    <SelectTrigger className="glass-carved-field reassign-outline bg-[#dcedb4] text-[#2c3a16] dark:bg-transparent dark:text-slate-100">
                      <SelectValue placeholder="Select next stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {LIFECYCLE_STAGES
                        .filter(([value]) => allowedNextStages.includes(value))
                        .map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="reassign-cta action-cta w-full font-semibold"
                    disabled={!selectedLead || !nextStage || actionBusy !== null}
                    onClick={() => selectedLead && runAction('stage', {
                      lead_id: selectedLead.id,
                      stage: nextStage,
                    }, WEBHOOKS.stage)}
                  >
                    {actionBusy === 'stage' ? 'Sending…' : 'Apply Stage Change'}
                  </Button>
                </div>

                <div className="premium-glass reassign-glass space-y-2 rounded-md border p-3 text-[#2c3a16] dark:text-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="followup-note">Trigger Follow-up</Label>
                    <InfoHint text="Create/send a follow-up action using your note as context." />
                  </div>
                  <Input
                    id="followup-note"
                    className="glass-carved-field reassign-outline bg-[#dcedb4] text-[#2c3a16] placeholder:text-[#4a5b2a] dark:bg-transparent dark:text-slate-100 dark:placeholder:text-slate-300"
                    placeholder="follow-up note"
                    value={followupNote}
                    onChange={(e) => setFollowupNote(e.target.value)}
                    disabled={!selectedLead}
                  />
                  <Button
                    size="sm"
                    className="reassign-cta action-cta w-full font-semibold"
                    disabled={!selectedLead || actionBusy !== null}
                    onClick={() => selectedLead && runAction('followup', {
                      lead_id: selectedLead.id,
                      note: followupNote.trim(),
                    }, WEBHOOKS.followup)}
                  >
                    {actionBusy === 'followup' ? 'Sending…' : 'Trigger Follow-up'}
                  </Button>
                </div>

                <div className="premium-glass reassign-glass space-y-2 rounded-md border p-3 text-[#2c3a16] dark:text-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Label>Mark as</Label>
                    <InfoHint text="Lost = no deal. Won = closed client. Nurture = re-engage later." />
                  </div>
                  <Select value={finalOutcome} onValueChange={setFinalOutcome} disabled={!selectedLead}>
                    <SelectTrigger className="glass-carved-field reassign-outline bg-[#dcedb4] text-[#2c3a16] dark:bg-transparent dark:text-slate-100">
                      <SelectValue placeholder="Select final outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="nurture">Nurture</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="reassign-cta w-full font-semibold"
                    disabled={!selectedLead || !finalOutcome || actionBusy !== null}
                    onClick={() => {
                      if (!selectedLead) return;
                      const outcomeEndpoint =
                        WEBHOOKS.outcome ||
                        (finalOutcome === 'lost' ? WEBHOOKS.lost : finalOutcome === 'won' ? WEBHOOKS.won : WEBHOOKS.nurture);
                      void runAction('outcome', {
                        lead_id: selectedLead.id,
                        outcome: finalOutcome,
                      }, outcomeEndpoint);
                    }}
                  >
                    {actionBusy === 'outcome' ? 'Sending…' : 'Save Outcome'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default OperatorHub;
