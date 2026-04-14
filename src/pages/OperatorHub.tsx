import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

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
  New: [
    { id: "L-1001", name: "Mia Santos", source: "FB Ads", stage: "New", owner: "Jet", priority: "Medium", followUpDue: "Today 6:00 PM", lastAction: "Lead created" },
    { id: "L-1002", name: "Renz Dela Cruz", source: "Website", stage: "New", owner: "Andrej", priority: "High", followUpDue: "Today 7:30 PM", lastAction: "Initial triage" },
  ],
  Hot: [
    { id: "L-1021", name: "Aria Tan", source: "Referral", stage: "Negotiation", owner: "Jet", priority: "High", followUpDue: "Today 9:00 PM", lastAction: "Pricing sent" },
    { id: "L-1028", name: "Noel Ramos", source: "Inbound", stage: "Qualified", owner: "Andrej", priority: "High", followUpDue: "Tomorrow 10:00 AM", lastAction: "Call booked" },
  ],
  Stuck: [
    { id: "L-1050", name: "Karla Uy", source: "Messenger", stage: "Needs Reply", owner: "Jet", priority: "Medium", followUpDue: "Overdue 1d", lastAction: "Awaiting response" },
  ],
  Overdue: [],
};

const OperatorHub = () => {
  const [activeView, setActiveView] = useState<QueueView>("New");
  const [queueState, setQueueState] = useState<QueueState>("loading");
  const [errorMode, setErrorMode] = useState(false);

  useEffect(() => {
    setQueueState("loading");
    const t = setTimeout(() => {
      setQueueState(errorMode ? "error" : "ready");
    }, 280);
    return () => clearTimeout(t);
  }, [activeView, errorMode]);

  const activeLeads = useMemo(() => queueSeed[activeView], [activeView]);

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="glass-card rounded-xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Axivo IB/Broker Operator Hub v1</h1>
              <p className="text-sm text-muted-foreground">Lead Queue filter state wired — Phase 6 / P6-02</p>
            </div>
            <Badge variant="secondary">P6-02 in progress</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="xl:col-span-4">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Lead Queue</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setErrorMode((s) => !s)}>
                    {errorMode ? "Disable Error" : "Simulate Error"}
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
                    <Button size="sm" variant="outline" onClick={() => setQueueState("loading")}>Retry</Button>
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
                <div className="text-muted-foreground">Fields to render on lead click:</div>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>name</li>
                  <li>source</li>
                  <li>stage</li>
                  <li>owner</li>
                  <li>priority</li>
                  <li>follow-up due</li>
                  <li>last action</li>
                </ul>
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
