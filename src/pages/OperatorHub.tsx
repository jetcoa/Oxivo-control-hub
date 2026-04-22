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
type MomentumStats = {
  percent: number;
  moves: number;
  replies: number;
  overdueFixed: number;
  reachOuts: number;
  momentumPercent: number;
  reachPercent: number;
};
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
    limit: "25",
  } as Record<string, string>;
  const twentyFourHoursAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  if (view === "New") {
    return new URLSearchParams({ ...base, order: "created_at.desc", created_at: `gte.${twentyFourHoursAgoIso}` });
  }

  if (view === "Hot") {
    return new URLSearchParams({
      ...base,
      order: "updated_at.asc",
      created_at: `lt.${twentyFourHoursAgoIso}`,
      current_stage: "in.(contacted,qualified,kyc_started,kyc_approved,reactivation)",
    });
  }

  if (view === "Stuck") {
    return new URLSearchParams({ ...base, order: "updated_at.asc", created_at: `lt.${twentyFourHoursAgoIso}`, current_stage: "in.(stuck,kyc_started,inactive,reactivation)" });
  }

  return new URLSearchParams({ ...base, order: "followup_due_at.asc", followup_due_at: "lt.NOW()", current_stage: "not.in.(lost,trading,funded,won)" });
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
  const now = new Date();
  const windowStartIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [leadUpdatesRes, followupsRes, overdueFixedRes, reachOutsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/leads?select=id&updated_at=gte.${encodeURIComponent(windowStartIso)}`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
    fetch(`${supabaseUrl}/rest/v1/follow_up_tasks?select=id&created_at=gte.${encodeURIComponent(windowStartIso)}`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
    fetch(`${supabaseUrl}/rest/v1/leads?select=id&updated_at=gte.${encodeURIComponent(windowStartIso)}&followup_due_at=gt.now()`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
    fetch(`${supabaseUrl}/rest/v1/leads?select=id&created_at=gte.${encodeURIComponent(windowStartIso)}`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    }),
  ]);

  if (!leadUpdatesRes.ok || !followupsRes.ok || !overdueFixedRes.ok || !reachOutsRes.ok) {
    throw new Error('Failed to load momentum stats');
  }

  const [leadUpdates, followups, overdueFixedRows, reachOutRows] = await Promise.all([
    leadUpdatesRes.json() as Promise<any[]>,
    followupsRes.json() as Promise<any[]>,
    overdueFixedRes.json() as Promise<any[]>,
    reachOutsRes.json() as Promise<any[]>,
  ]);

  const movesRaw = leadUpdates?.length || 0;
  const repliesRaw = followups?.length || 0;
  const overdueRaw = overdueFixedRows?.length || 0;
  const reachRaw = reachOutRows?.length || 0;

  const moves = Math.min(8, movesRaw);
  const replies = Math.min(3, repliesRaw);
  const overdueFixed = Math.min(2, overdueRaw);
  const reachOuts = Math.min(3, reachRaw);

  const momentumPercent = ((moves / 8) + (replies / 3) + (overdueFixed / 2)) / 3 * 70;
  const reachPercent = momentumPercent >= 70 ? (reachOuts / 3) * 30 : 0;
  const percent = Math.min(100, Math.round(momentumPercent + reachPercent));

  return {
    percent,
    moves,
    replies,
    overdueFixed,
    reachOuts,
    momentumPercent: Math.min(70, Math.round(momentumPercent)),
    reachPercent: Math.round(reachPercent),
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

  // Time-based requeue + urgency scoring:
  // recently touched leads are deprioritized so operators cycle through unresolved work first.
  const COOLDOWN_MINUTES = 120;
  const nowMs = Date.now();
  const scoredRows = rows
    .map((row) => {
      const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      const dueMs = row.followup_due_at ? new Date(row.followup_due_at).getTime() : 0;
      const isOverdue = dueMs > 0 && dueMs < nowMs;
      const minutesSinceUpdate = updatedMs > 0 ? (nowMs - updatedMs) / 60000 : 99999;
      const inCooldown = minutesSinceUpdate >= 0 && minutesSinceUpdate < COOLDOWN_MINUTES;

      const rawPriority = row.priority;
      const p = String(rawPriority ?? '').toLowerCase();
      const isUrgent = p.includes('urgent') || (typeof rawPriority === 'number' && rawPriority >= 3);
      const isHigh = p.includes('high') || (typeof rawPriority === 'number' && rawPriority === 2);
      const priorityScore =
        isUrgent ? 55 :
        isHigh ? 40 :
        (p.includes('medium') || p.includes('normal') || (typeof rawPriority === 'number' && rawPriority === 1)) ? 16 : 8;

      const stage = String(row.current_stage || '').toLowerCase();
      const stageScore = stage === 'stuck' ? 22 : stage === 'reactivation' ? 16 : stage === 'kyc_started' ? 12 : stage === 'inactive' ? 10 : 4;
      const overdueScore = isOverdue ? 30 : 0;
      const cooldownPenalty = inCooldown ? (isUrgent ? 8 : isHigh ? 15 : 40) : 0;
      const urgency = priorityScore + stageScore + overdueScore - cooldownPenalty;
      return { row, urgency, updatedMs, inCooldown };
    })
    .sort((a, b) => {
      const ap = String(a.row.priority ?? '').toLowerCase();
      const bp = String(b.row.priority ?? '').toLowerCase();
      const aBand = ap.includes('urgent') ? 3 : ap.includes('high') ? 2 : 1;
      const bBand = bp.includes('urgent') ? 3 : bp.includes('high') ? 2 : 1;

      // Strict pin: urgent/high always above non-high regardless of cooldown.
      if (aBand !== bBand) return bBand - aBand;

      if (a.urgency !== b.urgency) return b.urgency - a.urgency;
      return a.updatedMs - b.updatedMs;
    })
    .map((x) => x.row);

  const ownerIds = Array.from(new Set(scoredRows.map((r) => r.assigned_to).filter(Boolean)));
  const ownerMap = await resolveOwnerNames(ownerIds as string[]);

  return scoredRows.map((row) => ({
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
  const [followupDueAt, setFollowupDueAt] = useState("");
  const [finalOutcome, setFinalOutcome] = useState("");
  const [actionBusy, setActionBusy] = useState<"reassign" | "stage" | "followup" | "outcome" | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [momentum, setMomentum] = useState<MomentumStats>({ percent: 0, moves: 0, replies: 0, overdueFixed: 0, reachOuts: 0, momentumPercent: 0, reachPercent: 0 });
  const [masterView, setMasterView] = useState<MasterView>('all');
  const [masterSearch, setMasterSearch] = useState('');
  const [filterOwner, setFilterOwner] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterFollowup, setFilterFollowup] = useState('all');
  const [masterRows, setMasterRows] = useState<MasterRecord[]>([]);

  const [reactivationOwnerFilter, setReactivationOwnerFilter] = useState('all');
  const [reactivationNoRecentAction, setReactivationNoRecentAction] = useState(false);
  const [reactivationNoRecentTrading, setReactivationNoRecentTrading] = useState(false);
  const [selectedReactivationId, setSelectedReactivationId] = useState<string>('');
  const [reactivationReassignTo, setReactivationReassignTo] = useState('');
  const [reactivationPriority, setReactivationPriority] = useState('high');
  const [reactivationOutcome, setReactivationOutcome] = useState('nurture');

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
    const [rowsByView, latestMaster] = await Promise.all([
      Promise.all(views.map((v) => fetchQueueFromSupabase(v))),
      fetchMasterList(),
    ]);

    const nextLeadData = views.reduce((acc, v, i) => {
      acc[v] = rowsByView[i];
      return acc;
    }, {} as Record<QueueView, QueueLead[]>);

    setLeadData(nextLeadData);
    setMasterRows(latestMaster);

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

  const tagReactivationPriority = async (leadId: string, priority: string) => {
    try {
      setActionMessage('');
      const res = await fetch(`${supabaseUrl}/rest/v1/leads?id=eq.${leadId}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error('Priority tag update failed');
      setActionMessage('Priority tag saved.');
      setRefreshTick((n) => n + 1);
    } catch (e: any) {
      setActionMessage(e?.message || 'Priority tag failed.');
    }
  };

  const setLeadFollowupDueAt = async (leadId: string, dueAtLocal: string) => {
    if (!dueAtLocal) return '';
    const iso = new Date(dueAtLocal).toISOString();
    const res = await fetch(`${supabaseUrl}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ followup_due_at: iso }),
    });
    if (!res.ok) throw new Error('Failed to set follow-up due date/time');
    return iso;
  };

  const lockLeadFollowupDueAt = async (leadId: string, dueAtLocal: string) => {
    const iso = await setLeadFollowupDueAt(leadId, dueAtLocal);
    const retryDelays = [1500, 4000];
    retryDelays.forEach((delay) => {
      window.setTimeout(() => {
        void fetch(`${supabaseUrl}/rest/v1/leads?id=eq.${leadId}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ followup_due_at: iso }),
        });
      }, delay);
    });
    return iso;
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

  const workloadToday = useMemo(() => {
    const newCount = leadData.New.length;
    const hotCount = leadData.Hot.length;
    const stuckCount = leadData.Stuck.length;
    const overdueCount = leadData.Overdue.length;

    const uniqueActionIds = new Set<string>([
      ...leadData.New.map((l) => l.id),
      ...leadData.Hot.map((l) => l.id),
      ...leadData.Stuck.map((l) => l.id),
      ...leadData.Overdue.map((l) => l.id),
    ]);

    return {
      actionsNeeded: uniqueActionIds.size,
      followUps: momentum.replies,
      atRisk: new Set<string>([
        ...leadData.Stuck.map((l) => l.id),
        ...leadData.Overdue.map((l) => l.id),
      ]).size,
      queueTotals: { newCount, hotCount, stuckCount, overdueCount },
    };
  }, [leadData, momentum.replies]);

  const ownerLabel = (ownerId?: string | null) => ownerId ? (ownerOptions.find((o) => o.id === ownerId)?.name || ownerId) : 'unassigned';
  const uniqueSources = Array.from(new Set(masterRows.map((r) => r.source_channel).filter(Boolean))) as string[];
  const uniqueStages = Array.from(new Set(masterRows.map((r) => r.current_stage).filter(Boolean))) as string[];

  const ownerBookRows = useMemo(() => {
    const groups = new Map<string, {
      ownerId: string;
      ownerName: string;
      assigned: number;
      qualified: number;
      funded: number;
      active: number;
      inactive: number;
      overdue: number;
      stuck: number;
      sources: Record<string, number>;
    }>();

    for (const r of masterRows) {
      const ownerId = r.assigned_to || 'unassigned';
      const ownerName = ownerLabel(r.assigned_to);
      const stage = String(r.current_stage || '').toLowerCase();
      const source = r.source_channel || 'unknown';
      const isOverdue = !!r.followup_due_at && new Date(r.followup_due_at).getTime() < Date.now();

      if (!groups.has(ownerId)) {
        groups.set(ownerId, {
          ownerId,
          ownerName,
          assigned: 0,
          qualified: 0,
          funded: 0,
          active: 0,
          inactive: 0,
          overdue: 0,
          stuck: 0,
          sources: {},
        });
      }

      const g = groups.get(ownerId)!;
      g.assigned += 1;
      if (['qualified', 'kyc_started', 'kyc_approved'].includes(stage)) g.qualified += 1;
      if (['funded', 'won', 'funded_client'].includes(stage)) g.funded += 1;
      if (['trading', 'active_trader', 'active'].includes(stage)) g.active += 1;
      if (['inactive', 'dormant', 'reactivation'].includes(stage)) g.inactive += 1;
      if (['stuck', 'kyc_started', 'reactivation'].includes(stage)) g.stuck += 1;
      if (isOverdue) g.overdue += 1;
      g.sources[source] = (g.sources[source] || 0) + 1;
    }

    return Array.from(groups.values()).sort((a, b) => b.assigned - a.assigned);
  }, [masterRows, ownerOptions]);

  const businessMetrics = useMemo(() => {
    const rows = masterRows;
    const stageOf = (r: MasterRecord) => String(r.current_stage || '').toLowerCase();
    const overdue = (r: MasterRecord) => !!r.followup_due_at && new Date(r.followup_due_at).getTime() < Date.now();

    const summary = {
      newLeads: rows.filter((r) => stageOf(r) === 'new_lead').length,
      qualified: rows.filter((r) => ['qualified', 'kyc_started', 'kyc_approved'].includes(stageOf(r))).length,
      funded: rows.filter((r) => ['funded', 'won', 'funded_client'].includes(stageOf(r))).length,
      active: rows.filter((r) => ['trading', 'active_trader', 'active'].includes(stageOf(r))).length,
      inactive: rows.filter((r) => ['inactive', 'dormant', 'reactivation'].includes(stageOf(r))).length,
      overdue: rows.filter((r) => overdue(r)).length,
      stuck: rows.filter((r) => ['stuck', 'kyc_started', 'reactivation'].includes(stageOf(r))).length,
    };

    const byOwner = ownerBookRows.slice(0, 6).map((o) => ({ key: o.ownerName, value: o.assigned, leak: o.overdue + o.stuck }));

    const sourceMap: Record<string, number> = {};
    rows.forEach((r) => {
      const s = r.source_channel || 'unknown';
      sourceMap[s] = (sourceMap[s] || 0) + 1;
    });
    const bySource = Object.entries(sourceMap).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    const stageMap: Record<string, number> = {};
    rows.forEach((r) => {
      const s = String(r.current_stage || 'unknown');
      stageMap[s] = (stageMap[s] || 0) + 1;
    });
    const byStage = Object.entries(stageMap).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    return { summary, byOwner, bySource, byStage };
  }, [masterRows, ownerBookRows]);

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

  const reactivationRows = masterRows.filter((r) => {
    const stage = String(r.current_stage || '').toLowerCase();
    const updatedMs = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    const daysSinceUpdate = updatedMs ? (Date.now() - updatedMs) / (1000 * 60 * 60 * 24) : 999;
    const noRecentAction = daysSinceUpdate > 7;
    const noRecentTrading = daysSinceUpdate > 14;

    const baseSegment = ['inactive', 'dormant', 'reactivation', 'funded', 'trading', 'active', 'active_trader'].includes(stage);
    const byOwner = reactivationOwnerFilter === 'all' || r.assigned_to === reactivationOwnerFilter;
    const byAction = !reactivationNoRecentAction || noRecentAction;
    const tradingSensitive = ['funded', 'trading', 'active', 'active_trader'].includes(stage);
    const byTrading = !reactivationNoRecentTrading || !tradingSensitive || noRecentTrading;

    return baseSegment && byOwner && byAction && byTrading;
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
              <div className="relative mt-6">
                <div className="pointer-events-none absolute -top-6 left-0 right-0">
                  <span
                    className="absolute rounded-md border border-[#8ea24a]/35 bg-[#2f3012]/80 px-2 py-0.5 text-xs text-[#b8d965]"
                    style={{ left: `${Math.max(12, momentum.momentumPercent)}%`, transform: 'translateX(-100%)' }}
                  >
                    70% Momentum
                  </span>
                  <span className="absolute right-0 rounded-md border border-[#8ea24a]/35 bg-[#2f3012]/80 px-2 py-0.5 text-xs text-[#e3c54d]">
                    30% Outreach
                  </span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/25">
                  <div className="h-3 bg-[#b8d965]" style={{ width: `${momentum.momentumPercent}%` }} />
                  <div className="h-3 bg-[#e3c54d]" style={{ width: `${momentum.reachPercent}%` }} />
                </div>
              </div>
            </div>
            <div className="md:col-span-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-white/20 p-2">
                <div className="text-lg font-semibold">{workloadToday.actionsNeeded}</div>
                <div className="text-xs text-muted-foreground">actions needed</div>
              </div>
              <div className="rounded-md border border-white/20 p-2">
                <div className="text-lg font-semibold">{workloadToday.followUps}</div>
                <div className="text-xs text-muted-foreground">follow-ups today</div>
              </div>
              <div className="rounded-md border border-white/20 p-2">
                <div className="text-lg font-semibold">{workloadToday.atRisk}</div>
                <div className="text-xs text-muted-foreground">at risk / overdue</div>
              </div>
            </div>
          </div>
        </div>

        <div className="premium-glass rounded-xl border border-white/20 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-wide">Today’s 3 Moves (Playbook)</div>
            <div className="text-xs text-muted-foreground">This drives your results.</div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="rounded-lg border border-white/20 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="font-semibold text-[#b8d965]">Today’s Moves</span> (Actions) <InfoHint text="Counts any logged action completed today." /></div>
              <div className="mt-1 text-3xl font-semibold">{momentum.moves}<span className="text-lg text-[#b8d965]">/8</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{Math.max(0, 8 - momentum.moves)} more to target</div>
            </div>

            <div className="rounded-lg border border-white/20 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="font-semibold text-[#b8d965]">Replies Sent</span> (Follow-ups) <InfoHint text="Counts follow-up completed today." /></div>
              <div className="mt-1 text-3xl font-semibold">{momentum.replies}<span className="text-lg text-[#b8d965]">/3</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{momentum.replies >= 3 ? 'Target met' : `${3 - momentum.replies} more to target`}</div>
            </div>

            <div className="rounded-lg border border-white/20 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><span className="font-semibold text-[#b8d965]">Overdue Fixed</span> <InfoHint text="Counts leads that leave overdue status today." /></div>
              <div className="mt-1 text-3xl font-semibold">{momentum.overdueFixed}<span className="text-lg text-[#b8d965]">/2</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{momentum.overdueFixed >= 2 ? 'Target met' : `${2 - momentum.overdueFixed} more to target`}</div>
            </div>

            <div className="rounded-lg border border-white/20 p-3">
              <div className="flex items-center gap-1 text-xs text-[#e3c54d]"><span className="font-semibold">Complete the day</span> <span className="text-muted-foreground">(Outreach)</span> <InfoHint text="Counts outbound to new prospects only." /></div>
              <div className={`mt-2 text-3xl font-semibold ${momentum.reachOuts === 0 ? '' : 'text-[#e3c54d]'}`}>{momentum.reachOuts}<span className="text-lg text-[#e3c54d]">/3</span></div>
              <div className="mt-1 text-xs text-muted-foreground">{momentum.reachOuts >= 3 ? 'Day complete at 100%' : `${3 - momentum.reachOuts} more to complete the day`}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="xl:col-span-4">
            <Card className="premium-glass h-[560px] border-white/20 bg-transparent overflow-hidden flex flex-col">
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
              <CardContent className="space-y-4 flex-1 overflow-y-auto">
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
            <Card className="premium-glass h-[560px] border-white/20 bg-transparent overflow-hidden flex flex-col">
              <CardHeader>
                <CardTitle>Lead Detail Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm h-[480px] overflow-y-auto">
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
                  <div className="space-y-1">
                    <Label htmlFor="followup-due-at">Follow-up Due At</Label>
                    <Input
                      id="followup-due-at"
                      type="datetime-local"
                      className="glass-carved-field reassign-outline bg-[#dcedb4] text-[#2c3a16] dark:bg-transparent dark:text-slate-100"
                      value={followupDueAt}
                      onChange={(e) => setFollowupDueAt(e.target.value)}
                      disabled={!selectedLead}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="reassign-cta action-cta w-full font-semibold"
                    disabled={!selectedLead || actionBusy !== null}
                    onClick={() => {
                      if (!selectedLead) return;
                      void (async () => {
                        try {
                          setActionBusy('followup');
                          setActionMessage('');

                          let savedIso = '';
                          if (followupDueAt) {
                            savedIso = await lockLeadFollowupDueAt(selectedLead.id, followupDueAt);
                            if (savedIso) {
                              setSelectedLead((prev) => prev && prev.id === selectedLead.id
                                ? { ...prev, followUpDue: new Date(savedIso).toLocaleString(), lastAction: `Updated ${new Date().toLocaleString()}` }
                                : prev);
                            }
                          }

                          if (WEBHOOKS.followup) {
                            await postWebhook(WEBHOOKS.followup, {
                              lead_id: selectedLead.id,
                              note: followupNote.trim(),
                            });
                          }

                          // Enforce selected future due date after webhook side-effects.
                          if (followupDueAt) {
                            savedIso = await lockLeadFollowupDueAt(selectedLead.id, followupDueAt);
                          }

                          await refreshQueues(activeView, selectedLead.id);
                          setFollowupDueAt('');
                          setActionMessage(WEBHOOKS.followup ? 'Follow-up triggered and future due date locked.' : 'Due date saved (no follow-up webhook configured).');
                        } catch (e: any) {
                          setActionMessage(e?.message || 'Failed to trigger follow-up.');
                        } finally {
                          setActionBusy(null);
                        }
                      })();
                    }}
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
        </div>        <div className="premium-glass rounded-xl border border-white/20 px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-base font-semibold">Business Metrics Layer</div>
            <div className="text-xs text-muted-foreground">CRM-aligned broker metrics</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
            <div className="rounded-md border border-white/20 p-2 min-h-[72px] flex flex-col justify-center"><div className="text-lg font-semibold">{businessMetrics.summary.newLeads}</div><div className="text-xs text-muted-foreground">new leads</div></div>
            <div className="rounded-md border border-white/20 p-2 min-h-[72px] flex flex-col justify-center"><div className="text-lg font-semibold">{businessMetrics.summary.qualified}</div><div className="text-xs text-muted-foreground">qualified</div></div>
            <div className="rounded-md border border-white/20 p-2 min-h-[72px] flex flex-col justify-center"><div className="text-lg font-semibold">{businessMetrics.summary.funded}</div><div className="text-xs text-muted-foreground">funded</div></div>
            <div className="rounded-md border border-white/20 p-2 min-h-[72px] flex flex-col justify-center"><div className="text-lg font-semibold">{businessMetrics.summary.active}</div><div className="text-xs text-muted-foreground">active traders</div></div>
            <div className="rounded-md border border-white/20 p-2 min-h-[72px] flex flex-col justify-center"><div className="text-lg font-semibold">{businessMetrics.summary.inactive}</div><div className="text-xs text-muted-foreground">inactive</div></div>
            <div className="rounded-md border border-white/20 p-2 min-h-[72px] flex flex-col justify-center"><div className="text-lg font-semibold">{businessMetrics.summary.overdue}</div><div className="text-xs text-muted-foreground">overdue follow-ups</div></div>
            <div className="rounded-md border border-white/20 p-2 min-h-[72px] flex flex-col justify-center"><div className="text-lg font-semibold">{businessMetrics.summary.stuck}</div><div className="text-xs text-muted-foreground">stuck prospects</div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded-md border border-white/20 p-2 min-h-[120px] flex flex-col">
              <div className="mb-1 font-semibold">By owner / IB</div>
              <div className="flex-1 overflow-y-auto">
                {businessMetrics.byOwner.map((x) => <div key={x.key} className="flex justify-between"><span>{x.key}</span><span>{x.value} <span className="text-muted-foreground">(leak {x.leak})</span></span></div>)}
              </div>
            </div>
            <div className="rounded-md border border-white/20 p-2 min-h-[120px] flex flex-col">
              <div className="mb-1 font-semibold">By source</div>
              <div className="flex-1 overflow-y-auto">
                {businessMetrics.bySource.map((x) => <div key={x.key} className="flex justify-between"><span>{x.key}</span><span>{x.value}</span></div>)}
              </div>
            </div>
            <div className="rounded-md border border-white/20 p-2 min-h-[120px] flex flex-col">
              <div className="mb-1 font-semibold">By stage</div>
              <div className="flex-1 overflow-y-auto">
                {businessMetrics.byStage.map((x) => <div key={x.key} className="flex justify-between"><span>{x.key}</span><span>{x.value}</span></div>)}
              </div>
            </div>
          </div>
        </div>

        <div className="premium-glass rounded-xl border border-white/20 px-5 py-4 space-y-3 flex flex-col h-[560px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-base font-semibold">Master List / Full CRM View</div>
            <div className="text-xs text-muted-foreground">{filteredMasterRows.length} records</div>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
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
          <div className="flex-1 overflow-y-auto rounded-md border border-white/20 relative">
            <table className="w-full text-sm">
              <thead><tr className="text-left">
                <th className="sticky top-0 z-10 bg-black/10 p-2">Name</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Source</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Owner / IB</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Stage</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Priority</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Follow-up</th>
              </tr></thead>
              <tbody>
                {filteredMasterRows.map((r)=>{const overdue=!!r.followup_due_at && new Date(r.followup_due_at).getTime()<Date.now(); return <tr key={r.id} className="border-t border-white/10"><td className="p-2 font-medium">{r.full_name}</td><td className="p-2">{r.source_channel || '-'}</td><td className="p-2">{ownerLabel(r.assigned_to)}</td><td className="p-2">{r.current_stage || '-'}</td><td className="p-2">{r.priority || '-'}</td><td className="p-2">{overdue ? 'Overdue' : 'On track'}</td></tr>})}
              </tbody>
            </table>
          </div>
        </div>

        <div className="premium-glass rounded-xl border border-white/20 px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-base font-semibold">Owner Book / IB View</div>
            <div className="text-xs text-muted-foreground">{ownerBookRows.length} owners</div>
          </div>
          <div className="glass-scroll max-h-[260px] overflow-y-auto rounded-md border border-white/20">
            <table className="w-full text-xs md:text-sm">
              <thead className="sticky top-0 bg-black/10">
                <tr className="text-left">
                  <th className="p-2">Owner / IB</th>
                  <th className="p-2">Assigned</th>
                  <th className="p-2">Qualified</th>
                  <th className="p-2">Funded</th>
                  <th className="p-2">Active</th>
                  <th className="p-2">Inactive</th>
                  <th className="p-2">Overdue</th>
                  <th className="p-2">Stuck</th>
                  <th className="p-2">Source Mix</th>
                </tr>
              </thead>
              <tbody>
                {ownerBookRows.map((o) => (
                  <tr key={o.ownerId} className="border-t border-white/10">
                    <td className="p-2 font-medium">{o.ownerName}</td>
                    <td className="p-2">{o.assigned}</td>
                    <td className="p-2">{o.qualified}</td>
                    <td className="p-2">{o.funded}</td>
                    <td className="p-2">{o.active}</td>
                    <td className="p-2">{o.inactive}</td>
                    <td className="p-2">{o.overdue}</td>
                    <td className="p-2">{o.stuck}</td>
                    <td className="p-2">{Object.entries(o.sources).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${k}:${v}`).join(' · ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="premium-glass rounded-xl border border-white/20 px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-base font-semibold">Reactivation Layer</div>
            <div className="text-xs text-muted-foreground">{reactivationRows.length} candidates</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Select value={reactivationOwnerFilter} onValueChange={setReactivationOwnerFilter}><SelectTrigger><SelectValue placeholder="Owner / IB" /></SelectTrigger><SelectContent><SelectItem value="all">All owners</SelectItem>{ownerOptions.map(o=><SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
            <Select value={reactivationNoRecentAction ? 'yes' : 'no'} onValueChange={(v)=>setReactivationNoRecentAction(v==='yes')}><SelectTrigger><SelectValue placeholder="No recent action" /></SelectTrigger><SelectContent><SelectItem value="yes">No recent action</SelectItem><SelectItem value="no">Include recent action</SelectItem></SelectContent></Select>
            <Select value={reactivationNoRecentTrading ? 'yes' : 'no'} onValueChange={(v)=>setReactivationNoRecentTrading(v==='yes')}><SelectTrigger><SelectValue placeholder="No recent trading" /></SelectTrigger><SelectContent><SelectItem value="yes">No recent trading</SelectItem><SelectItem value="no">Include recent trading</SelectItem></SelectContent></Select>
            <div className="text-xs text-muted-foreground flex items-center">Dormant/inactive recovery segment</div>
          </div>

          <div className="glass-scroll max-h-[260px] overflow-y-auto rounded-md border border-white/20 relative">
            <table className="w-full text-xs md:text-sm">
              <thead><tr className="text-left">
                <th className="sticky top-0 z-10 bg-black/10 p-2">Client</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Owner</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Stage</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Follow-up</th>
                <th className="sticky top-0 z-10 bg-black/10 p-2">Reactivation Priority</th>
              </tr></thead>
              <tbody>
                {reactivationRows.map((r)=><tr key={r.id} onClick={()=>setSelectedReactivationId(r.id)} className={`border-t border-white/10 cursor-pointer ${selectedReactivationId===r.id?'bg-black/10':''}`}><td className="p-2 font-medium">{r.full_name}</td><td className="p-2">{ownerLabel(r.assigned_to)}</td><td className="p-2">{r.current_stage || '-'}</td><td className="p-2">{r.followup_due_at ? (new Date(r.followup_due_at).getTime() < Date.now() ? 'Overdue' : 'Scheduled') : 'None'}</td><td className="p-2">{String(r.priority || 'medium')}</td></tr>)}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <Select value={reactivationReassignTo} onValueChange={setReactivationReassignTo}><SelectTrigger><SelectValue placeholder="Reassign if needed" /></SelectTrigger><SelectContent>{ownerOptions.map(o=><SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
            <Select value={reactivationPriority} onValueChange={setReactivationPriority}><SelectTrigger><SelectValue placeholder="Priority tagging" /></SelectTrigger><SelectContent><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem></SelectContent></Select>
            <Select value={reactivationOutcome} onValueChange={setReactivationOutcome}><SelectTrigger><SelectValue placeholder="Outcome tracking" /></SelectTrigger><SelectContent><SelectItem value="nurture">Nurture</SelectItem><SelectItem value="won">Won</SelectItem><SelectItem value="lost">Lost</SelectItem></SelectContent></Select>
            <div className="flex gap-2">
              <Button size="sm" className="reassign-cta action-cta" disabled={!selectedReactivationId} onClick={()=>selectedReactivationId && runAction('followup',{lead_id:selectedReactivationId,note:'Reactivation follow-up triggered'},WEBHOOKS.followup)}>Follow-up</Button>
              <Button size="sm" className="reassign-cta action-cta" disabled={!selectedReactivationId || !reactivationReassignTo} onClick={()=>selectedReactivationId && runAction('reassign',{lead_id:selectedReactivationId,assigned_to:reactivationReassignTo},WEBHOOKS.reassign)}>Reassign</Button>
              <Button size="sm" className="reassign-cta action-cta" disabled={!selectedReactivationId} onClick={()=>selectedReactivationId && tagReactivationPriority(selectedReactivationId, reactivationPriority)}>Tag</Button>
              <Button size="sm" className="reassign-cta" disabled={!selectedReactivationId} onClick={()=>selectedReactivationId && runAction('outcome',{lead_id:selectedReactivationId,outcome:reactivationOutcome},WEBHOOKS.outcome || (reactivationOutcome==='won'?WEBHOOKS.won:reactivationOutcome==='lost'?WEBHOOKS.lost:WEBHOOKS.nurture))}>Track</Button>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default OperatorHub;
