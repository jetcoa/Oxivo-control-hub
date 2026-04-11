export interface Agent {
  id: string;
  name: string;
  emoji: string;
  type: string;
  role: string;
  accentColor: string;
  status: "active" | "idle" | "error" | "offline";
  currentActivity: string;
  lastSeen: string;
  tasksCompleted: number;
  accuracy: number;
  skills: string[];
}

export const agents: Agent[] = [
  { id: "hormozi", name: "Hormozi", emoji: "⚡", type: "CEO", role: "Front door + Decisions + Final reporting", accentColor: "#fb7185", status: "active", currentActivity: "Reviewing Q2 revenue strategy", lastSeen: "just now", tasksCompleted: 142, accuracy: 96, skills: ["Revenue Strategy", "Prioritization", "Decision Making", "Market Analysis"] },
  { id: "shotwell", name: "Shotwell", emoji: "🧭", type: "COO", role: "Breakdown + Sequencing + Verification", accentColor: "#f59e0b", status: "active", currentActivity: "Unblocking pipeline bottleneck", lastSeen: "2m ago", tasksCompleted: 203, accuracy: 94, skills: ["Operations", "Process Design", "Blocker Removal", "Sequencing"] },
  { id: "andrej", name: "Andrej", emoji: "🧠", type: "Builder", role: "Implementation and build execution", accentColor: "#8b5cf6", status: "idle", currentActivity: "Awaiting next workflow audit", lastSeen: "15m ago", tasksCompleted: 87, accuracy: 99, skills: ["Prompt Engineering", "Agent Design", "Workflow Optimization", "Diagnostics"] },
  { id: "van", name: "Van", emoji: "🛠️", type: "Builder", role: "Implementation and build execution", accentColor: "#a3e635", status: "idle", currentActivity: "Standing by for build tasks", lastSeen: "8m ago", tasksCompleted: 156, accuracy: 92, skills: ["Supabase", "n8n Workflows", "API Integration", "Database Design"] },
];

export interface TaskItem {
  id: string;
  title: string;
  agentId: string;
  priority: "low" | "medium" | "high" | "urgent";
  progress?: number;
  column: "todo" | "doing" | "needs-input" | "done";
}

export const tasks: TaskItem[] = [
  { id: "t1", title: "Design onboarding flow v2", agentId: "hormozi", priority: "high", column: "todo" },
  { id: "t2", title: "Audit n8n webhook reliability", agentId: "van", priority: "medium", column: "todo" },
  { id: "t3", title: "Build Supabase edge function for leads", agentId: "van", priority: "high", progress: 65, column: "doing" },
  { id: "t4", title: "Refactor prompt chain for sales agent", agentId: "andrej", priority: "urgent", progress: 30, column: "doing" },
  { id: "t5", title: "Review Q2 OKR alignment", agentId: "shotwell", priority: "medium", column: "needs-input" },
  { id: "t7", title: "Deploy CRM integration pipeline", agentId: "van", priority: "high", column: "done" },
  { id: "t8", title: "Write investor update draft", agentId: "hormozi", priority: "urgent", column: "done" },
  { id: "t10", title: "Optimize database query performance", agentId: "van", priority: "high", progress: 80, column: "doing" },
];

export interface LogEntry {
  id: string;
  agentId: string;
  category: "observation" | "general" | "reminder" | "fyi";
  message: string;
  timestamp: string;
}

export const logEntries: LogEntry[] = [
  { id: "l1", agentId: "hormozi", category: "observation", message: "Revenue pipeline shows 23% increase in qualified leads this week. Recommend doubling down on outbound.", timestamp: "2026-04-01T09:30:00Z" },
  { id: "l2", agentId: "andrej", category: "fyi", message: "GPT-4o latency spiked 40% at 2am UTC. Switched fallback to Claude 3.5 Sonnet. No user impact.", timestamp: "2026-04-01T09:15:00Z" },
  { id: "l3", agentId: "shotwell", category: "reminder", message: "Sprint retro is scheduled for Friday 3pm. Action items from last retro still pending review.", timestamp: "2026-04-01T08:45:00Z" },
  { id: "l5", agentId: "van", category: "observation", message: "Supabase RLS policies on 'leads' table need tightening. Found 2 overly permissive rules.", timestamp: "2026-04-01T08:00:00Z" },
  { id: "l6", agentId: "hormozi", category: "fyi", message: "Competitor X launched a new pricing tier. Our positioning still holds — no action needed yet.", timestamp: "2026-03-31T18:00:00Z" },
  { id: "l7", agentId: "andrej", category: "reminder", message: "Prompt version 3.2 rollout due tomorrow. Final QA pass required before deploy.", timestamp: "2026-03-31T16:30:00Z" },
  { id: "l8", agentId: "shotwell", category: "observation", message: "Onboarding funnel drop-off at step 3 increased by 8%. Flagging for UX review.", timestamp: "2026-03-31T14:00:00Z" },
  { id: "l10", agentId: "van", category: "general", message: "n8n workflow for lead enrichment completed. Processing 200 leads/hour.", timestamp: "2026-03-31T10:00:00Z" },
];

export interface CouncilMessage {
  agentId: string;
  messageNumber: number;
  text: string;
  timestamp: string;
}

export interface CouncilSession {
  id: string;
  question: string;
  status: "active" | "concluded" | "pending";
  participants: { agentId: string; sent: number; limit: number }[];
  messages: CouncilMessage[];
}

export const councilSessions: CouncilSession[] = [
  {
    id: "c1",
    question: "Should we pivot the sales agent from outbound email to LinkedIn DMs?",
    status: "concluded",
    participants: [
      { agentId: "hormozi", sent: 2, limit: 3 },
      { agentId: "shotwell", sent: 2, limit: 3 },
      { agentId: "andrej", sent: 1, limit: 3 },
    ],
    messages: [
      { agentId: "hormozi", messageNumber: 1, text: "LinkedIn DMs have 3x higher response rates in our ICP segment. The data supports a pivot.", timestamp: "2026-03-30T10:00:00Z" },
      { agentId: "shotwell", messageNumber: 1, text: "Operationally feasible. We'd need 2 days to reconfigure the n8n pipeline and update templates.", timestamp: "2026-03-30T10:05:00Z" },
      { agentId: "andrej", messageNumber: 1, text: "The current prompt chain is email-optimized. LinkedIn requires shorter, more conversational copy. I can redesign in 4 hours.", timestamp: "2026-03-30T10:10:00Z" },
      { agentId: "hormozi", messageNumber: 2, text: "Green light. Shotwell, sequence the migration. Andrej, start prompt redesign. Ship by Thursday.", timestamp: "2026-03-30T10:15:00Z" },
      { agentId: "shotwell", messageNumber: 2, text: "Confirmed. Migration plan drafted. Execution goes to Van and Andrej, then returns to Shotwell for verification.", timestamp: "2026-03-30T10:20:00Z" },
    ],
  },
  {
    id: "c2",
    question: "How should we handle the increasing API costs from the enrichment pipeline?",
    status: "active",
    participants: [
      { agentId: "hormozi", sent: 1, limit: 3 },
      { agentId: "van", sent: 1, limit: 3 },
      { agentId: "shotwell", sent: 1, limit: 3 },
      { agentId: "andrej", sent: 0, limit: 3 },
    ],
    messages: [
      { agentId: "van", messageNumber: 1, text: "Current enrichment costs are $847/month and growing 15% MoM. Main driver is Clearbit API calls on unqualified leads.", timestamp: "2026-04-01T08:00:00Z" },
      { agentId: "shotwell", messageNumber: 1, text: "We should add a pre-qualification filter before enrichment. Only enrich leads scoring above 60 on our ICP model.", timestamp: "2026-04-01T08:10:00Z" },
      { agentId: "hormozi", messageNumber: 1, text: "Agreed. But also negotiate volume pricing with Clearbit. At our scale, we should be getting 30-40% discount.", timestamp: "2026-04-01T08:20:00Z" },
    ],
  },
];

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration_minutes: number;
  duration_display: string;
  attendees: string[];
  summary: string;
  action_items: { task: string; assignee: string; done: boolean }[];
  ai_insights: string;
  meeting_type: "standup" | "sales" | "interview" | "all-hands" | "1-on-1" | "planning" | "team";
  sentiment: "positive" | "neutral" | "negative";
  has_external_participants: boolean;
  external_domains: string[];
  fathom_url: string | null;
  share_url: string | null;
}

export const meetings: Meeting[] = [
  { id: "m1", title: "Weekly Standup with Engineering", date: "2026-04-01T14:10:00Z", duration_minutes: 30, duration_display: "30m", attendees: ["Alice", "Bob", "Charlie"], summary: "Discussed sprint progress. Backend API 80% complete. Frontend components ahead of schedule. Blockers: need design review on settings page.", action_items: [{ task: "Review PR #42", assignee: "Alice", done: false }, { task: "Update API docs", assignee: "Bob", done: true }], ai_insights: "30 min meeting with 3 attendees. Pace was efficient — 10 min/person.", meeting_type: "standup", sentiment: "positive", has_external_participants: false, external_domains: [], fathom_url: null, share_url: null },
  { id: "m2", title: "Morning Sync — Product Team", date: "2026-03-31T09:00:00Z", duration_minutes: 15, duration_display: "15m", attendees: ["Diana", "Eve"], summary: "Quick sync on feature prioritization. Moved 'dark mode' to P2. Focus remains on onboarding flow.", action_items: [{ task: "Draft onboarding wireframes", assignee: "Eve", done: false }], ai_insights: "Shortest standup this week. High signal-to-noise ratio.", meeting_type: "standup", sentiment: "positive", has_external_participants: false, external_domains: [], fathom_url: null, share_url: null },
  { id: "m3", title: "Sales Discovery — Acme Corp", date: "2026-03-30T16:00:00Z", duration_minutes: 45, duration_display: "45m", attendees: ["Frank", "Grace", "Henry (Acme)"], summary: "Acme Corp interested in enterprise plan. Key concerns: SSO integration and data residency. Follow-up demo scheduled.", action_items: [{ task: "Send pricing proposal", assignee: "Frank", done: false }, { task: "Prepare SSO demo", assignee: "Grace", done: false }], ai_insights: "High-intent prospect. 2 action items generated. Follow up within 48hrs.", meeting_type: "sales", sentiment: "positive", has_external_participants: true, external_domains: ["acme.com"], fathom_url: "https://fathom.video/demo1", share_url: "https://share.axivo.ai/m3" },
  { id: "m4", title: "Sales Review — Beta Industries", date: "2026-03-28T11:00:00Z", duration_minutes: 60, duration_display: "1h", attendees: ["Frank", "Ivan (Beta)"], summary: "Beta Industries evaluating competitors. Price sensitivity is high. Need to emphasize ROI story.", action_items: [{ task: "Build ROI calculator", assignee: "Frank", done: false }], ai_insights: "Longer meeting than average sales call. Consider tightening pitch deck.", meeting_type: "sales", sentiment: "neutral", has_external_participants: true, external_domains: ["beta-ind.com"], fathom_url: "https://fathom.video/demo2", share_url: null },
  { id: "m5", title: "Engineering Manager Interview — Jane D.", date: "2026-03-27T14:00:00Z", duration_minutes: 55, duration_display: "55m", attendees: ["Alice", "Bob", "Jane D."], summary: "Strong candidate. 8 years experience. Good culture fit. Technical depth in distributed systems.", action_items: [{ task: "Submit interview scorecard", assignee: "Alice", done: true }, { task: "Schedule final round", assignee: "Bob", done: false }], ai_insights: "Candidate scored well on all rubric dimensions. Recommend advancing.", meeting_type: "interview", sentiment: "positive", has_external_participants: false, external_domains: [], fathom_url: null, share_url: null },
  { id: "m6", title: "Q2 All-Hands", date: "2026-03-25T17:00:00Z", duration_minutes: 75, duration_display: "1h 15m", attendees: ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace"], summary: "Q1 results exceeded targets by 12%. New hires onboarding next month. Product roadmap presented. Q&A on remote work policy.", action_items: [{ task: "Share Q1 report deck", assignee: "Diana", done: true }], ai_insights: "7 attendees. Largest meeting this month. High engagement in Q&A.", meeting_type: "all-hands", sentiment: "positive", has_external_participants: false, external_domains: [], fathom_url: null, share_url: "https://share.axivo.ai/m6" },
  { id: "m7", title: "1-on-1: Alice & Bob", date: "2026-03-29T10:00:00Z", duration_minutes: 30, duration_display: "30m", attendees: ["Alice", "Bob"], summary: "Discussed career growth. Bob wants to lead the next architecture review. Agreed on a stretch goal for Q2.", action_items: [{ task: "Draft architecture review plan", assignee: "Bob", done: false }], ai_insights: "Productive 1-on-1. Clear action items and growth discussion.", meeting_type: "1-on-1", sentiment: "positive", has_external_participants: false, external_domains: [], fathom_url: null, share_url: null },
  { id: "m8", title: "1-on-1: Diana & Eve", date: "2026-03-28T15:00:00Z", duration_minutes: 25, duration_display: "25m", attendees: ["Diana", "Eve"], summary: "Eve raised concerns about design review bottleneck. Agreed to implement async review process.", action_items: [{ task: "Set up async design review channel", assignee: "Diana", done: false }], ai_insights: "Issue identified and resolution planned in single session.", meeting_type: "1-on-1", sentiment: "neutral", has_external_participants: false, external_domains: [], fathom_url: null, share_url: null },
  { id: "m9", title: "Sprint Planning — Q2 Week 1", date: "2026-03-26T13:00:00Z", duration_minutes: 90, duration_display: "1h 30m", attendees: ["Alice", "Bob", "Charlie", "Diana"], summary: "Planned 24 story points. Focus areas: auth system, dashboard redesign, API v2. Capacity at 85% due to PTO.", action_items: [{ task: "Create Jira tickets for auth epic", assignee: "Charlie", done: true }, { task: "Update capacity spreadsheet", assignee: "Alice", done: true }], ai_insights: "Well-structured planning. All items estimated and assigned.", meeting_type: "planning", sentiment: "positive", has_external_participants: false, external_domains: [], fathom_url: null, share_url: null },
  { id: "m10", title: "Design System Review — Team", date: "2026-03-24T11:00:00Z", duration_minutes: 40, duration_display: "40m", attendees: ["Eve", "Diana", "Charlie"], summary: "Reviewed new component library. Agreed on color token naming convention. Dark mode support approved for Q2.", action_items: [{ task: "Document color token spec", assignee: "Eve", done: false }, { task: "Create dark mode Figma variants", assignee: "Diana", done: false }], ai_insights: "3-person focused review. Good alignment on design direction.", meeting_type: "team", sentiment: "positive", has_external_participants: false, external_domains: [], fathom_url: null, share_url: null },
];

export const activityFeed = [
  { id: "a1", agentId: "hormozi", action: "Approved Q2 revenue strategy", timestamp: "2m ago" },
  { id: "a3", agentId: "andrej", action: "Completed prompt chain audit — v3.2 ready", timestamp: "12m ago" },
  { id: "a4", agentId: "shotwell", action: "Cleared pipeline bottleneck in onboarding flow", timestamp: "18m ago" },
  { id: "a5", agentId: "van", action: "Deployed CRM integration edge function", timestamp: "25m ago" },
  { id: "a6", agentId: "hormozi", action: "Flagged competitor pricing change for review", timestamp: "1h ago" },
  { id: "a8", agentId: "andrej", action: "Switched AI fallback model due to latency spike", timestamp: "2h ago" },
];

export const metricCards = [
  { label: "Tasks Completed", value: 906, trend: "+12%", icon: "CheckCircle" as const },
  { label: "Active Agents", value: 3, trend: "3 of 4", icon: "Users" as const },
  { label: "Avg Accuracy", value: 95.6, trend: "+2.1%", icon: "Target" as const, suffix: "%" },
  { label: "Tasks Processed Today", value: 14, trend: "+3", icon: "ArrowRightLeft" as const },
];
