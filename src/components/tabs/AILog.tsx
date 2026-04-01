import { useState } from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { agents, logEntries } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const catColors: Record<string, string> = {
  observation: "bg-primary/15 text-primary border-primary/20",
  general: "bg-muted text-muted-foreground border-border",
  reminder: "bg-amber/15 text-amber border-amber/20",
  fyi: "bg-accent/15 text-accent border-accent/20",
};

const item = { hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const AILog = () => {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? logEntries : logEntries.filter((l) => l.category === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Agent Log</h2>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="observation">Observation</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="reminder">Reminder</SelectItem>
            <SelectItem value="fyi">FYI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <motion.div variants={container} initial="hidden" animate="show" key={filter} className="space-y-3">
        {filtered.map((l) => {
          const agent = agents.find((a) => a.id === l.agentId)!;
          return (
            <motion.div key={l.id} variants={item} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{agent.emoji}</span>
                <span className="text-sm font-medium">{agent.name}</span>
                <Badge variant="outline" className={`text-[10px] ml-auto ${catColors[l.category]}`}>{l.category}</Badge>
                <span className="text-[10px] text-muted-foreground">{format(parseISO(l.timestamp), "MMM d, h:mm a")}</span>
              </div>
              <p className="text-sm text-muted-foreground">{l.message}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default AILog;
