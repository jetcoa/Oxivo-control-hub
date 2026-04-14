import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://bpfnydgbtydcaugyblks.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZm55ZGdidHlkY2F1Z3libGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTYzOTcsImV4cCI6MjA4OTc5MjM5N30.SSQARg1xPD8jRE7g6k68Z0R6omuRWqjIn5GRsnzO8Mk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
