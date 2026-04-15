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

const ownerNameCache = new Map<string, string>();

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
    return new URLSearchParams({ ...base, priority: "in.(high,urgent)", current_stage: "not.in.(converted,lost)" });
  }

  if (view === "Stuck") {
    const q = new URLSearchParams({ ...base, current_stage: "not.in.(converted,lost)" });
    q.append('stuck_reason', 'not.is.null');
    q.append('stuck_reason', 'neq.');
    return q;
  }

  return new URLSearchParams({ ...base, followup_due_at: "lt.NOW()", current_stage: "not.in.(converted,lost,nurture)" });
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
      ? (String(row.priority).toLowerCase() === 'high' ? 'High' : String(row.priority).toLowerCase() === 'medium' ? 'Medium' : 'Low')
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
  const [nextStage, setNextStage] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [finalOutcome, setFinalOutcome] = useState("");
  const [actionBusy, setActionBusy] = useState<"reassign" | "stage" | "followup" | "outcome" | null>(null);
  const [actionMessage, setActionMessage] = useState("");

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

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="glass-card rounded-xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Axivo IB/Broker Operator Hub v1</h1>
              <p className="text-sm text-muted-foreground">P6-04 Hot queue is now wired to Supabase REST read</p>
            </div>
            <Badge variant="secondary">P6-04 in progress</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="xl:col-span-4">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Lead Queue</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setRefreshTick((n) => n + 1)}>
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {queueViews.map((view) => (
                    <Button
                      key={view}
                      size="sm"
                      variant={activeView === view ? "default" : "outline"}
                      onClick={() => setActiveView(view)}
                    >
                      {view}
                    </Button>
                  ))}
                </div>
                <Separator />

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
                        className="w-full rounded-md border bg-card p-3 text-left text-sm hover:border-primary/50"
                        onClick={() => setSelectedLead(lead)}
                        type="button"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{lead.name}</div>
                          <Badge variant="outline">{lead.priority}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {lead.source} • {lead.stage} • {lead.owner}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="xl:col-span-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Lead Detail Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!selectedLead && <div className="text-muted-foreground">Select a lead from queue.</div>}
                {selectedLead && (
                  <div className="space-y-3">
                    <div className="rounded-md border p-3">
                      <div className="text-lg font-semibold leading-tight">{selectedLead.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Lead ID: {selectedLead.id}</div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <div className="rounded-md border p-2"><span className="text-muted-foreground">source:</span> {selectedLead.source}</div>
                      <div className="rounded-md border p-2"><span className="text-muted-foreground">stage:</span> {selectedLead.stage}</div>
                      <div className="rounded-md border p-2"><span className="text-muted-foreground">owner:</span> {selectedLead.owner}</div>
                      <div className="rounded-md border p-2"><span className="text-muted-foreground">priority:</span> {selectedLead.priority}</div>
                      <div className="rounded-md border p-2"><span className="text-muted-foreground">follow-up due:</span> {selectedLead.followUpDue}</div>
                      <div className="rounded-md border p-2"><span className="text-muted-foreground">last action:</span> {selectedLead.lastAction}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="xl:col-span-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Action Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {!selectedLead && <div className="text-muted-foreground">Select a lead to unlock actions.</div>}
                {actionMessage && <div className="rounded-md border p-2 text-xs text-muted-foreground">{actionMessage}</div>}

                <div className="space-y-2 rounded-md border p-3">
                  <Label htmlFor="reassign-to">Reassign</Label>
                  <Input
                    id="reassign-to"
                    placeholder="owner name or id"
                    value={reassignTo}
                    onChange={(e) => setReassignTo(e.target.value)}
                    disabled={!selectedLead}
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!selectedLead || !reassignTo.trim() || actionBusy !== null}
                    onClick={() => selectedLead && runAction('reassign', {
                      lead_id: selectedLead.id,
                      reassign_to: reassignTo.trim(),
                    }, WEBHOOKS.reassign)}
                  >
                    {actionBusy === 'reassign' ? 'Sending…' : 'Reassign Lead'}
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <Label>Change Stage</Label>
                  <Select value={nextStage} onValueChange={setNextStage} disabled={!selectedLead}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select next stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_lead">New Lead</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="stuck">Stuck</SelectItem>
                      <SelectItem value="nurture">Nurture</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!selectedLead || !nextStage || actionBusy !== null}
                    onClick={() => selectedLead && runAction('stage', {
                      lead_id: selectedLead.id,
                      stage: nextStage,
                    }, WEBHOOKS.stage)}
                  >
                    {actionBusy === 'stage' ? 'Sending…' : 'Apply Stage Change'}
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <Label htmlFor="followup-note">Trigger Follow-up</Label>
                  <Input
                    id="followup-note"
                    placeholder="follow-up note"
                    value={followupNote}
                    onChange={(e) => setFollowupNote(e.target.value)}
                    disabled={!selectedLead}
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!selectedLead || actionBusy !== null}
                    onClick={() => selectedLead && runAction('followup', {
                      lead_id: selectedLead.id,
                      note: followupNote.trim(),
                    }, WEBHOOKS.followup)}
                  >
                    {actionBusy === 'followup' ? 'Sending…' : 'Trigger Follow-up'}
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <Label>Mark as Lost / Won / Nurture</Label>
                  <Select value={finalOutcome} onValueChange={setFinalOutcome} disabled={!selectedLead}>
                    <SelectTrigger>
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
                    className="w-full"
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
