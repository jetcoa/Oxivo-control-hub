import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { agents, type TaskItem } from "@/data/mockData";
import { useDashboard } from "@/legacy/context/DashboardDataContext";
import { tasks as initialTasks } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";

const columns = [
  { key: "todo" as const, label: "To Do" },
  { key: "doing" as const, label: "Doing" },
  { key: "needs-input" as const, label: "Needs Input" },
  { key: "done" as const, label: "Done" },
];

const priorityDot: Record<string, string> = { low: "bg-muted-foreground/50", medium: "bg-amber", high: "bg-primary", urgent: "bg-destructive" };

const formatDubaiTimestamp = (iso?: string) => {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dubai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(dt);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('month')}-${get('day')}, ${get('hour')}:${get('minute')}`;
};

const TaskBoard = () => {
  const { agents, tasks: liveTasks } = useDashboard();
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  useEffect(() => { if (liveTasks?.length) setTasks(liveTasks); }, [liveTasks]);
  const [dragging, setDragging] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDragging(id);
  const handleDrop = (col: TaskItem["column"]) => {
    if (!dragging) return;
    setTasks((prev) => prev.map((t) => (t.id === dragging ? { ...t, column: col } : t)));
    setDragging(null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto">
      {columns.map((col) => (
        <div
          key={col.key}
          className="glass-card p-4 min-h-[300px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(col.key)}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{col.label}</h3>
            <Badge variant="secondary" className="text-[10px]">{tasks.filter((t) => t.column === col.key).length}</Badge>
          </div>
          <div className={col.key === 'done' ? "max-h-[72vh] space-y-2.5 overflow-y-auto pr-1" : "space-y-2.5"}>
            {tasks.filter((t) => t.column === col.key).map((t) => {
              const agent = agents.find((a) => a.id === t.agentId) ?? {
                id: t.agentId,
                name: t.agentId || 'Unknown agent',
                emoji: '🤖',
              };

              return (
                <motion.div
                  key={t.id}
                  draggable
                  onDragStart={() => handleDragStart(t.id)}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-lg border border-border bg-card/80 p-3 cursor-grab active:cursor-grabbing"
                >
                  <p className="text-sm font-medium mb-1">{t.title}</p>
                  {formatDubaiTimestamp(t.createdAt) && (
                    <p className="mb-2 text-[10px] font-mono text-muted-foreground">{formatDubaiTimestamp(t.createdAt)}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{agent.emoji || '🤖'}</span>
                      <span className="text-xs text-muted-foreground">{agent.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.progress !== undefined && (
                        <span className="text-[10px] font-mono text-primary">{t.progress}%</span>
                      )}
                      <span className={`h-2 w-2 rounded-full ${priorityDot[t.priority]}`} title={t.priority} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskBoard;
