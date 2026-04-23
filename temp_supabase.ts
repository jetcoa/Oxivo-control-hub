import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ntmpfdfdsybibvkhvuqh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50bXBmZGZkc3liaWJ2a2h2dXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjgwNzMsImV4cCI6MjA5MTA0NDA3M30.ODRZfCXPmz7zbxmzuqfCXVvWqNUcwYWz6RcEtlWaWjI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
