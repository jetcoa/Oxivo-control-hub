import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, isAfter, subDays } from "date-fns";
import { Calendar, TrendingUp, CheckSquare, Clock, Search, Globe, Sparkles, ExternalLink, Share2 } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { meetings, type Meeting } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import CountUp from "@/components/CountUp";

const typeColors: Record<string, string> = {
  "1-on-1": "#60a5fa", external: "#a78bfa", sales: "#34d399", team: "#fb923c",
  standup: "#818cf8", planning: "#2dd4bf", interview: "#f472b6", "all-hands": "#fbbf24",
};

const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

const kpis = [
  { label: "Total Meetings", value: 247, Icon: Calendar },
  { label: "This Week", value: 8, Icon: TrendingUp },
  { label: "Open Action Items", value: 12, Icon: CheckSquare },
  { label: "Avg Duration", value: 34, Icon: Clock, suffix: "m" },
];

const MeetingIntelligence = () => {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [sort, setSort] = useState("recent");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<Record<string, boolean[]>>({});

  const filtered = useMemo(() => {
    let list = [...meetings];
    if (search) list = list.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()));
    if (dateRange !== "all") {
      const days = parseInt(dateRange);
      const cutoff = subDays(new Date(), days);
      list = list.filter((m) => isAfter(parseISO(m.date), cutoff));
    }
    if (sort === "recent") list.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    else if (sort === "oldest") list.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    else list.sort((a, b) => b.duration_minutes - a.duration_minutes);
    return list;
  }, [search, dateRange, sort]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => { counts[m.meeting_type] = (counts[m.meeting_type] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  const barData = useMemo(() => {
    const months: Record<string, number> = {};
    meetings.forEach((m) => {
      const key = format(parseISO(m.date), "MMM");
      months[key] = (months[key] || 0) + 1;
    });
    return Object.entries(months).map(([month, count]) => ({ month, count }));
  }, []);

  const toggleAction = (meetingId: string, idx: number) => {
    setActionItems((prev) => {
      const meeting = meetings.find((m) => m.id === meetingId)!;
      const current = prev[meetingId] || meeting.action_items.map((a) => a.done);
      const updated = [...current];
      updated[idx] = !updated[idx];
      return { ...prev, [meetingId]: updated };
    });
  };

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const initialsColors = ["#60a5fa", "#a78bfa", "#34d399", "#fb923c", "#818cf8", "#f472b6"];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <motion.div key={k.label} variants={item} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><k.Icon size={20} /></div>
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </div>
            <p className="text-3xl font-bold font-mono"><CountUp end={k.value} suffix={k.suffix} /></p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <motion.div variants={item} className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Meeting Type Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                {pieData.map((d) => <Cell key={d.name} fill={typeColors[d.name] || "#94a3b8"} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div variants={item} className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.9)", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div variants={item} className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search meetings..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="7">Last 7d</SelectItem>
            <SelectItem value="30">Last 30d</SelectItem>
            <SelectItem value="90">Last 90d</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="longest">Longest Duration</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Meeting Feed */}
      <ScrollArea className="h-[600px]">
        <div className="space-y-3 pr-2">
          {filtered.map((m) => {
            const isExpanded = expanded === m.id;
            const aiStates = actionItems[m.id] || m.action_items.map((a) => a.done);
            return (
              <motion.div key={m.id} variants={item} className="glass-card overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : m.id)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/20 transition-colors">
                  <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: typeColors[m.meeting_type], color: typeColors[m.meeting_type] }}>
                    {m.meeting_type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{m.title}</p>
                    <p className="text-[11px] text-muted-foreground">{format(parseISO(m.date), "MMM d, yyyy · h:mm a")} · {m.duration_display}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {m.attendees.slice(0, 3).map((name, i) => (
                      <div key={name} className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: initialsColors[i % initialsColors.length] }}>
                        {getInitials(name)}
                      </div>
                    ))}
                    {m.attendees.length > 3 && <span className="text-[10px] text-muted-foreground ml-1">+{m.attendees.length - 3}</span>}
                  </div>
                  {m.action_items.filter((a) => !a.done).length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{m.action_items.filter((a) => !a.done).length} actions</Badge>
                  )}
                  {m.has_external_participants && <Globe size={14} className="text-muted-foreground shrink-0" />}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="border-t border-border px-5 py-4 space-y-4">
                        <p className="text-sm text-muted-foreground">{m.summary}</p>
                        {m.action_items.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold mb-2">Action Items</h4>
                            <div className="space-y-1.5">
                              {m.action_items.map((a, i) => (
                                <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input type="checkbox" checked={aiStates[i]} onChange={() => toggleAction(m.id, i)} className="rounded border-border accent-primary" />
                                  <span className={aiStates[i] ? "line-through text-muted-foreground" : ""}>{a.task}</span>
                                  <span className="text-[10px] text-muted-foreground ml-auto">{a.assignee}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Sparkles size={12} /> {m.ai_insights}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {m.fathom_url && <Button size="sm" variant="outline" className="text-xs h-7"><ExternalLink size={12} /> Open Recording</Button>}
                          {m.share_url && <Button size="sm" variant="outline" className="text-xs h-7"><Share2 size={12} /> Share Link</Button>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </motion.div>
  );
};

export default MeetingIntelligence;
