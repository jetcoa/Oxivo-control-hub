import { supabase } from '@/lib/supabase';
import type { LogEntry } from '@/data/mockData';

export async function createAILogEntry(logEntry: Omit<LogEntry, 'id'>): Promise<LogEntry | null> {
  try {
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .insert({
        from_agent: logEntry.agentId,
        message: logEntry.message,
        message_type: logEntry.category,
        created_at: logEntry.timestamp
      })
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      agentId: data.from_agent,
      category: data.message_type,
      message: data.message,
      timestamp: data.created_at
    };
  } catch (error) {
    console.error('Error creating AI log entry:', error);
    return null;
  }
}

export async function updateAILogEntry(logId: string, updates: Partial<Omit<LogEntry, 'id'>>): Promise<LogEntry | null> {
  try {
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .update({
        from_agent: updates.agentId,
        message: updates.message,
        message_type: updates.category,
        created_at: updates.timestamp
      })
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      agentId: data.from_agent,
      category: data.message_type,
      message: data.message,
      timestamp: data.created_at
    };
  } catch (error) {
    console.error('Error updating AI log entry:', error);
    return null;
  }
}

export async function deleteAILogEntry(logId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('axivo_agent_comms')
      .delete()
      .eq('id', logId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting AI log entry:', error);
    return false;
  }
}