import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

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

const queueViews: QueueView[] = ["New", "Hot", "Stuck", "Overdue"];

const queueSeed: Record<QueueView, QueueLead[]> = {
  New: [],
  Hot: [
    { id: "L-1021", name: "Aria Tan", source: "Referral", stage: "Negotiation", owner: "Jet", priority: "High", followUpDue: "Today 9:00 PM", lastAction: "Pricing sent" },
    { id: "L-1028", name: "Noel Ramos", source: "Inbound", stage: "Qualified", owner: "Andrej", priority: "High", followUpDue: "Tomorrow 10:00 AM", lastAction: "Call booked" },
  ],
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

async function fetchNewQueueFromSupabase(): Promise<QueueLead[]> {
  const query = new URLSearchParams({
    to_agent: "eq.andrej",
    status: "in.(pending,in_progress)",
    select: "id,task_title,task_body,to_agent,priority,status,created_at",
    order: "created_at.desc",
    limit: "25",
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/axivo_dispatch_queue?${query.toString()}`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase read failed (${response.status}): ${details}`);
  }

  const rows = (await response.json()) as Array<any>;
  return rows.map((row) => ({
    id: row.id,
    name: row.task_title || "Untitled lead",
    source: "Supabase dispatch",
    stage: row.status || "pending",
    owner: row.to_agent || "unassigned",
    priority: normalizePriority(row.priority),
    followUpDue: row.created_at ? new Date(row.created_at).toLocaleString() : "TBD",
    lastAction: row.task_body || "No action yet",
  }));
}

const OperatorHub = () => {
  const [activeView, setActiveView] = useState<QueueView>("New");
  const [queueState, setQueueState] = useState<QueueState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [leadData, setLeadData] = useState<Record<QueueView, QueueLead[]>>(queueSeed);
  const [selectedLead, setSelectedLead] = useState<QueueLead | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadQueue() {
      setQueueState("loading");
      setErrorMessage("");

      try {
        if (activeView === "New") {
          const newRows = await fetchNewQueueFromSupabase();
          if (cancelled) return;

          setLeadData((prev) => ({ ...prev, New: newRows }));
          setSelectedLead((prev) => prev ?? newRows[0] ?? null);
          setQueueState("ready");
          return;
        }

        if (cancelled) return;
        setSelectedLead((prev) => prev ?? queueSeed[activeView][0] ?? null);
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
              <p className="text-sm text-muted-foreground">P6-03 New queue is now live on Supabase REST read</p>
            </div>
            <Badge variant="secondary">P6-03 in progress</Badge>
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
                    <Button size="sm" variant="outline" onClick={() => setActiveView((v) => v)}>Retry</Button>
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
              <CardContent className="space-y-2 text-sm">
                {!selectedLead && <div className="text-muted-foreground">Select a lead from queue.</div>}
                {selectedLead && (
                  <div className="space-y-2">
                    <div><span className="text-muted-foreground">name:</span> {selectedLead.name}</div>
                    <div><span className="text-muted-foreground">source:</span> {selectedLead.source}</div>
                    <div><span className="text-muted-foreground">stage:</span> {selectedLead.stage}</div>
                    <div><span className="text-muted-foreground">owner:</span> {selectedLead.owner}</div>
                    <div><span className="text-muted-foreground">priority:</span> {selectedLead.priority}</div>
                    <div><span className="text-muted-foreground">follow-up due:</span> {selectedLead.followUpDue}</div>
                    <div><span className="text-muted-foreground">last action:</span> {selectedLead.lastAction}</div>
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
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">Webhook action controls to wire:</div>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>Reassign</li>
                  <li>Change Stage</li>
                  <li>Trigger Follow-up</li>
                  <li>Mark as Lost / Won / Nurture</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default OperatorHub;
