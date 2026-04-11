import { supabase } from '@/lib/supabase';
import type { CouncilSession } from '@/data/mockData';

export async function createCouncilSession(session: Omit<CouncilSession, 'id'>): Promise<CouncilSession | null> {
  try {
    // Since there's no dedicated council table, we'll use axivo_agent_comms for council-related messages
    // or create a simple approach for now - storing council data as special messages
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .insert({
        from_agent: 'council-system',
        message: JSON.stringify({
          type: 'council_session',
          question: session.question,
          participants: session.participants,
          status: session.status,
          messages: session.messages
        }),
        message_type: 'council_session',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    // Return a mock council session with the created ID
    return {
      id: data.id,
      question: session.question,
      participants: session.participants,
      status: session.status,
      messages: session.messages
    };
  } catch (error) {
    console.error('Error creating council session:', error);
    return null;
  }
}

export async function updateCouncilSession(sessionId: string, updates: Partial<Omit<CouncilSession, 'id'>>): Promise<CouncilSession | null> {
  try {
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .update({
        message: JSON.stringify({
          type: 'council_session',
          question: updates.question,
          participants: updates.participants,
          status: updates.status,
          messages: updates.messages
        }),
        message_type: 'council_session',
        created_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      question: data.question ? JSON.parse(data.message).question : updates.question || '',
      participants: data.participants ? JSON.parse(data.message).participants : updates.participants || [],
      status: data.status ? JSON.parse(data.message).status : updates.status || 'pending',
      messages: data.messages ? JSON.parse(data.message).messages : updates.messages || []
    };
  } catch (error) {
    console.error('Error updating council session:', error);
    return null;
  }
}

export async function deleteCouncilSession(sessionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('axivo_agent_comms')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting council session:', error);
    return false;
  }
}