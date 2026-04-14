import { supabase } from '@/lib/supabase';
import type { Agent, TaskItem, LogEntry, CouncilSession, Meeting } from './mockData';
import { createAILogEntry, updateAILogEntry, deleteAILogEntry } from './mutations/aiLogMutations';
import { createCouncilSession, updateCouncilSession, deleteCouncilSession } from './mutations/councilMutations';
import { createMeeting, updateMeeting, deleteMeeting } from './mutations/meetingMutations';

const ACTIVE_AGENT_IDS = new Set(['hormozi', 'shotwell', 'van', 'andrej']);
const LEGACY_TERMS = ['clief', 'oxivo_'];

// WRITE OPERATIONS
export async function createLogEntry(logEntry: Omit<LogEntry, 'id'>): Promise<LogEntry | null> {
  return await createAILogEntry(logEntry);
}

export async function updateLogEntry(logId: string, updates: Partial<Omit<LogEntry, 'id'>>): Promise<LogEntry | null> {
  return await updateAILogEntry(logId, updates);
}

export async function deleteLogEntry(logId: string): Promise<boolean> {
  return await deleteAILogEntry(logId);
}

export async function createCouncil(session: Omit<CouncilSession, 'id'>): Promise<CouncilSession | null> {
  return await createCouncilSession(session);
}

export async function updateCouncil(sessionId: string, updates: Partial<Omit<CouncilSession, 'id'>>): Promise<CouncilSession | null> {
  return await updateCouncilSession(sessionId, updates);
}

export async function deleteCouncil(sessionId: string): Promise<boolean> {
  return await deleteCouncilSession(sessionId);
}

export async function createMeetingEntry(meeting: Omit<Meeting, 'id'>): Promise<Meeting | null> {
  return await createMeeting(meeting);
}

export async function updateMeetingEntry(meetingId: string, updates: Partial<Omit<Meeting, 'id'>>): Promise<Meeting | null> {
  return await updateMeeting(meetingId, updates);
}

export async function deleteMeetingEntry(meetingId: string): Promise<boolean> {
  return await deleteMeeting(meetingId);
}

// FETCH OPERATIONS (Enhanced to read from our storage)
export async function fetchAgents(): Promise<Agent[]> {
  try {
    // Extract unique agent names from axivo_agent_comms since no dedicated agents table
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .select('from_agent, to_agent')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Collect unique agent names
    const agentNames = new Set<string>();
    (data || []).forEach((row: any) => {
      if (row.from_agent) agentNames.add(row.from_agent);
      if (row.to_agent) agentNames.add(row.to_agent);
    });

    const profiles: Record<string, Pick<Agent, 'emoji' | 'type' | 'role' | 'accentColor'>> = {
      hormozi: { emoji: '⚡', type: 'CEO', role: 'Front door + Decisions + Final reporting', accentColor: '#fb7185' },
      shotwell: { emoji: '🧭', type: 'COO', role: 'Breakdown + Sequencing + Verification', accentColor: '#f59e0b' },
      van: { emoji: '🛠️', type: 'Builder', role: 'Implementation and build execution', accentColor: '#a3e635' },
      andrej: { emoji: '🧠', type: 'Builder', role: 'Implementation and build execution', accentColor: '#8b5cf6' },
    };
    
    // Convert to Agent objects, keeping only active chain
    return Array.from(agentNames)
      .map(name => ({ raw: name, id: String(name).toLowerCase().replace(/\s+/g, '-') }))
      .filter(a => ACTIVE_AGENT_IDS.has(a.id))
      .map(({ raw, id }) => ({
        id,
        name: raw,
        ...profiles[id],
        status: 'idle',
        currentActivity: 'Idle',
        lastSeen: new Date().toISOString(),
        tasksCompleted: 0,
        accuracy: 0,
        skills: [],
      }));
  } catch (error) {
    console.error('Error fetching agents:', error);
    return [];
  }
}

export async function fetchTasks(): Promise<TaskItem[]> {
  try {
    const { data, error } = await supabase
      .from('axivo_dispatch_queue')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || [])
      .filter((t: any) => ACTIVE_AGENT_IDS.has(String(t.to_agent || '').toLowerCase().replace(/\s+/g, '-')))
      .map((t: any) => {
        const rawStatus = String(t.status || '').toLowerCase().trim();
        const needsInputStatuses = new Set(['needs output', 'needs-output', 'needs_output', 'needs input', 'needs-input', 'needs_input', 'blocked']);
        const doingStatuses = new Set(['claimed', 'in progress', 'in-progress', 'in_progress', 'doing']);
        const doneStatuses = new Set(['completed', 'complete', 'done']);

        let column: TaskItem['column'] = 'todo';
        if (doneStatuses.has(rawStatus)) column = 'done';
        else if (doingStatuses.has(rawStatus)) column = 'doing';
        else if (needsInputStatuses.has(rawStatus)) column = 'needs-input';

        const explicitProgressRaw = (t as any).progress ?? (t as any)?.payload?.progress;
        const explicitProgress = Number(explicitProgressRaw);
        const hasExplicitProgress = Number.isFinite(explicitProgress);
        const normalizedExplicitProgress = hasExplicitProgress
          ? Math.max(0, Math.min(100, explicitProgress))
          : undefined;

        // Guardrail: DONE must always render as 100%.
        // Avoid fake defaults for DOING; only show progress when explicit values exist.
        const progress =
          column === 'done'
            ? 100
            : hasExplicitProgress
              ? normalizedExplicitProgress
              : column === 'needs-input'
                ? 10
                : undefined;

        return {
          id: t.id,
          title: t.task_title || 'Untitled Task',
          agentId: String(t.to_agent || 'unknown').toLowerCase().replace(/\s+/g, '-'),
          priority: t.priority || 'medium',
          progress,
          column,
        };
      });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

export async function fetchLogs(): Promise<LogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || [])
      .filter((l: any) => {
        const fromId = String(l.from_agent || '').toLowerCase().replace(/\s+/g, '-');
        if (!ACTIVE_AGENT_IDS.has(fromId)) return false;
        const msg = String(l.message || '').toLowerCase();
        return !LEGACY_TERMS.some(term => msg.includes(term));
      })
      .map((l: any) => ({
        id: l.id,
        agentId: String(l.from_agent || 'unknown').toLowerCase().replace(/\s+/g, '-'),
        category: l.message_type || 'general',
        message: l.message || '',
        timestamp: l.created_at || new Date().toISOString(),
      }));
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
}

export async function fetchCouncilSessions(): Promise<CouncilSession[]> {
  try {
    // Fetch council sessions from axivo_agent_comms where message_type = 'council_session'
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .select('*')
      .eq('message_type', 'council_session')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((session: any) => {
      try {
        const parsed = JSON.parse(session.message);
        return {
          id: session.id,
          question: parsed.question || '',
          participants: parsed.participants || [],
          status: parsed.status || 'pending',
          messages: parsed.messages || []
        };
      } catch (parseError) {
        console.error('Error parsing council session:', parseError);
        return {
          id: session.id,
          question: 'Error parsing session',
          participants: [],
          status: 'error',
          messages: []
        };
      }
    });
  } catch (error) {
    console.error('Error fetching council sessions:', error);
    return [];
  }
}

export async function fetchMeetings(): Promise<Meeting[]> {
  try {
    // Fetch meetings from axivo_agent_comms where message_type = 'meeting'
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .select('*')
      .eq('message_type', 'meeting')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((meeting: any) => {
      try {
        const parsed = JSON.parse(meeting.message);
        return {
          id: meeting.id,
          title: parsed.title || '',
          date: parsed.date || new Date().toISOString(),
          duration_minutes: parsed.duration_minutes || 0,
          duration_display: parsed.duration_display || '0m',
          summary: parsed.summary || '',
          action_items: parsed.action_items || [],
          attendees: parsed.attendees || [],
          meeting_type: parsed.meeting_type || '',
          has_external_participants: parsed.has_external_participants || false,
          fathom_url: parsed.fathom_url || '',
          share_url: parsed.share_url || '',
          ai_insights: parsed.ai_insights || ''
        };
      } catch (parseError) {
        console.error('Error parsing meeting:', parseError);
        return {
          id: meeting.id,
          title: 'Error parsing meeting',
          date: new Date().toISOString(),
          duration_minutes: 0,
          duration_display: '0m',
          summary: 'Error parsing meeting data',
          action_items: [],
          attendees: [],
          meeting_type: '',
          has_external_participants: false,
          fathom_url: '',
          share_url: '',
          ai_insights: ''
        };
      }
    });
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return [];
  }
}
