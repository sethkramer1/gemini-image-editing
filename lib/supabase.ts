import { createClient } from '@supabase/supabase-js';

// These environment variables need to be set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define types for your database tables
export type Conversation = {
  id: string;
  user_id?: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'model';
  content: string;
  has_image: boolean;
  created_at: string;
};

export type Image = {
  id: string;
  message_id: string;
  storage_path: string;
  original_path?: string;
  created_at: string;
}; 