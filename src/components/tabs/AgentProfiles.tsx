import { motion } from "framer-motion";
import { agents } from "@/data/mockData";
import { useDashboard } from "@/context/DashboardDataContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = { active: "bg-primary", idle: "bg-amber", error: "bg-destructive", offline: "bg-muted-foreground/40" };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const AgentProfiles = () => {
  const { agents } = useDashboard();
  return (
  <motion.div variants={container} initial="hidden" animate="show" className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
    {agents.map((a) => (
      <motion.div
        key={a.id}
        variants={item}
        whileHover={{ y: -4, boxShadow: `0 8px 30px ${a.accentColor}22` }}
        className="glass-card p-6 flex flex-col"
        style={{ borderTop: `3px solid ${a.accentColor}` }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{a.emoji}</span>
          <div>
            <h3 className="font-bold text-lg">{a.name}</h3>
            <p className="text-xs text-muted-foreground">{a.type} · {a.role.split("+")[0].trim()}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{a.role}</p>
        <div className="flex items-center gap-3 mb-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statusColors[a.status]}`} />
            <span className="capitalize">{a.status}</span>
          </div>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs">{a.tasksCompleted} tasks</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs">{a.accuracy}% acc</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {a.skills.map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px] font-normal">{s}</Badge>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-auto w-full">View Details</Button>
      </motion.div>
    ))}
  </motion.div>
  );
};

export default AgentProfiles;
