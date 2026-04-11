import { supabase } from '@/lib/supabase';
import type { Meeting } from '@/data/mockData';

export async function createMeeting(meeting: Omit<Meeting, 'id'>): Promise<Meeting | null> {
  try {
    // Store meeting data in axivo_agent_comms as a special message type
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .insert({
        from_agent: 'meeting-system',
        message: JSON.stringify({
          type: 'meeting',
          title: meeting.title,
          date: meeting.date,
          duration_minutes: meeting.duration_minutes,
          duration_display: meeting.duration_display,
          summary: meeting.summary,
          action_items: meeting.action_items,
          attendees: meeting.attendees,
          meeting_type: meeting.meeting_type,
          has_external_participants: meeting.has_external_participants,
          fathom_url: meeting.fathom_url,
          share_url: meeting.share_url,
          ai_insights: meeting.ai_insights
        }),
        message_type: 'meeting',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    // Return a mock meeting with the created ID
    return {
      id: data.id,
      title: meeting.title,
      date: meeting.date,
      duration_minutes: meeting.duration_minutes,
      duration_display: meeting.duration_display,
      summary: meeting.summary,
      action_items: meeting.action_items,
      attendees: meeting.attendees,
      meeting_type: meeting.meeting_type,
      has_external_participants: meeting.has_external_participants,
      fathom_url: meeting.fathom_url,
      share_url: meeting.share_url,
      ai_insights: meeting.ai_insights
    };
  } catch (error) {
    console.error('Error creating meeting:', error);
    return null;
  }
}

export async function updateMeeting(meetingId: string, updates: Partial<Omit<Meeting, 'id'>>): Promise<Meeting | null> {
  try {
    const { data, error } = await supabase
      .from('axivo_agent_comms')
      .update({
        message: JSON.stringify({
          type: 'meeting',
          title: updates.title,
          date: updates.date,
          duration_minutes: updates.duration_minutes,
          duration_display: updates.duration_display,
          summary: updates.summary,
          action_items: updates.action_items,
          attendees: updates.attendees,
          meeting_type: updates.meeting_type,
          has_external_participants: updates.has_external_participants,
          fathom_url: updates.fathom_url,
          share_url: updates.share_url,
          ai_insights: updates.ai_insights
        }),
        message_type: 'meeting',
        created_at: new Date().toISOString()
      })
      .eq('id', meetingId)
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      title: data.title ? JSON.parse(data.message).title : updates.title || '',
      date: data.date ? JSON.parse(data.message).date : updates.date || '',
      duration_minutes: data.duration_minutes ? JSON.parse(data.message).duration_minutes : updates.duration_minutes || 0,
      duration_display: data.duration_display ? JSON.parse(data.message).duration_display : updates.duration_display || '0m',
      summary: data.summary ? JSON.parse(data.message).summary : updates.summary || '',
      action_items: data.action_items ? JSON.parse(data.message).action_items : updates.action_items || [],
      attendees: data.attendees ? JSON.parse(data.message).attendees : updates.attendees || [],
      meeting_type: data.meeting_type ? JSON.parse(data.message).meeting_type : updates.meeting_type || '',
      has_external_participants: data.has_external_participants ? JSON.parse(data.message).has_external_participants : updates.has_external_participants || false,
      fathom_url: data.fathom_url ? JSON.parse(data.message).fathom_url : updates.fathom_url || '',
      share_url: data.share_url ? JSON.parse(data.message).share_url : updates.share_url || '',
      ai_insights: data.ai_insights ? JSON.parse(data.message).ai_insights : updates.ai_insights || ''
    };
  } catch (error) {
    console.error('Error updating meeting:', error);
    return null;
  }
}

export async function deleteMeeting(meetingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('axivo_agent_comms')
      .delete()
      .eq('id', meetingId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return false;
  }
}