import { motion } from "framer-motion";
import { CheckCircle, Users, Target, ArrowRightLeft } from "lucide-react";
import { agents, activityFeed, metricCards } from "@/data/mockData";
import { useDashboard } from "@/context/DashboardDataContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import CountUp from "@/components/CountUp";

const iconMap = { CheckCircle, Users, Target, ArrowRightLeft };
const statusColors: Record<string, string> = { active: "bg-primary", idle: "bg-amber", error: "bg-destructive", offline: "bg-muted-foreground/40" };

const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

const CommandDeck = () => {
  const { agents, logs, live } = useDashboard();
  const activityFeed = logs.slice(0, 8).map((l) => ({ id: l.id, agentId: l.agentId, action: l.message, timestamp: l.timestamp }));
  const metricCards = [
    { label: "Tasks", value: 0, trend: live ? "live" : "mock", icon: "CheckCircle" as const },
    { label: "Active Agents", value: agents.filter((a) => a.status === "active").length, trend: `${agents.length} total`, icon: "Users" as const },
    { label: "Avg Accuracy", value: agents.length ? agents.reduce((n,a)=>n+a.accuracy,0)/agents.length : 0, trend: live ? "Supabase" : "mock", icon: "Target" as const, suffix: "%" },
    { label: "Logs", value: logs.length, trend: live ? "live" : "mock", icon: "ArrowRightLeft" as const },
  ];
  return (
  <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
    {/* Metric Cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metricCards.map((m) => {
        const Icon = iconMap[m.icon];
        return (
          <motion.div key={m.label} variants={item} className="glass-card p-5 hover:glow-emerald transition-shadow cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon size={20} /></div>
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
            <p className="text-3xl font-bold font-mono tracking-tight">
              <CountUp end={m.value} suffix={m.suffix} decimals={m.suffix === "%" ? 1 : 0} />
            </p>
            <p className="text-xs text-primary mt-1">{m.trend}</p>
          </motion.div>
        );
      })}
    </div>

    {/* Activity + Agent Status */}
    <div className="grid lg:grid-cols-5 gap-4">
      <motion.div variants={item} className="glass-card p-5 lg:col-span-3">
        <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
        <ScrollArea className="h-72">
          <div className="space-y-3 pr-3">
            {activityFeed.map((a) => {
              const agent = agents.find((ag) => ag.id === a.agentId)!;
              return (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <span className="text-lg leading-none">{agent.emoji}</span>
                  <div className="flex-1">
                    <span className="font-medium">{agent.name}</span>{" "}
                    <span className="text-muted-foreground">{a.action}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{a.timestamp}</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </motion.div>

      <motion.div variants={item} className="glass-card p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold mb-3">Agent Status</h2>
        <div className="space-y-3">
          {agents.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                {a.status === "active" && <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: a.accentColor }} />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusColors[a.status]}`} />
              </span>
              <span className="text-lg leading-none">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground truncate">{a.currentActivity}</p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{a.lastSeen}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  </motion.div>
  );
};

export default CommandDeck;
