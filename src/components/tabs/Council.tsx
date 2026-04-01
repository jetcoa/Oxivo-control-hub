import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import { agents, councilSessions } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";

const statusBadge: Record<string, string> = {
  active: "bg-primary/15 text-primary border-primary/20",
  concluded: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber/15 text-amber border-amber/20",
};

const Council = () => {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {councilSessions.map((s) => {
        const isOpen = open === s.id;
        return (
          <div key={s.id} className="glass-card overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : s.id)}
              className="w-full flex items-start gap-3 p-5 text-left hover:bg-secondary/30 transition-colors"
            >
              <ChevronDown size={16} className={`mt-0.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{s.question}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {s.participants.map((p) => {
                    const agent = agents.find((a) => a.id === p.agentId)!;
                    return (
                      <span key={p.agentId} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[11px]">
                        {agent.emoji} {agent.name}
                        <span className="font-mono text-muted-foreground">{p.sent}/{p.limit}</span>
                        {p.sent >= p.limit ? <Check size={10} className="text-primary" /> : <Loader2 size={10} className="text-amber animate-spin" />}
                      </span>
                    );
                  })}
                </div>
              </div>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${statusBadge[s.status]}`}>{s.status}</Badge>
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-5 py-4 space-y-3">
                    {s.messages.map((m, i) => {
                      const agent = agents.find((a) => a.id === m.agentId)!;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex gap-3 text-sm"
                        >
                          <span className="text-lg shrink-0">{agent.emoji}</span>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium">{agent.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">#{m.messageNumber}</span>
                              <span className="text-[10px] text-muted-foreground">{format(parseISO(m.timestamp), "h:mm a")}</span>
                            </div>
                            <p className="text-muted-foreground">{m.text}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};

export default Council;
