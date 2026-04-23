import { useEffect, useState } from 'react';
import { agents as mockAgents, tasks as mockTasks, logEntries as mockLogs, councilSessions as mockCouncil, meetings as mockMeetings } from '@/data/mockData';
import { fetchAgents, fetchTasks, fetchLogs, fetchCouncilSessions, fetchMeetings } from '@/data/liveData';

export function useDashboardData() {
  const [agents, setAgents] = useState(mockAgents);
  const [tasks, setTasks] = useState(mockTasks);
  const [logs, setLogs] = useState(mockLogs);
  const [councilSessions, setCouncilSessions] = useState(mockCouncil);
  const [meetings, setMeetings] = useState(mockMeetings);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [a, t, l, c, m] = await Promise.all([
          fetchAgents(),
          fetchTasks(),
          fetchLogs(),
          fetchCouncilSessions(),
          fetchMeetings(),
        ]);
        if (!mounted) return;
        if (a.length) setAgents(a);
        if (t.length) setTasks(t);
        if (l.length) setLogs(l);
        if (c.length) setCouncilSessions(c);
        if (m.length) setMeetings(m);
        setLive(true);
      } catch {
        setLive(false);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { agents, tasks, logs, councilSessions, meetings, loading, live };
}
