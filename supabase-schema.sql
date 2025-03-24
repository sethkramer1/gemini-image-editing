-- Create conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content TEXT,
  has_image BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create images table
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX conversations_user_id_idx ON conversations(user_id);
CREATE INDEX messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX images_message_id_idx ON images(message_id);

-- Create bucket for image storage
-- Note: Run this in the Supabase Storage section or through the API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- Set up Storage policies (replace with your own security requirements)
-- Note: This is a simplified policy that allows public access. Modify as needed.
-- INSERT INTO storage.policies (name, definition, bucket_id)
-- VALUES (
--   'Public Access',
--   '(bucket_id = ''images''::text)',
--   'images'
-- );

-- Set up Row Level Security (RLS) policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Public access policy for conversations (modify as needed for your app)
CREATE POLICY "Public Access" ON conversations
  FOR ALL USING (true);

-- Public access policy for messages
CREATE POLICY "Public Access" ON messages
  FOR ALL USING (true);

-- Public access policy for images
CREATE POLICY "Public Access" ON images
  FOR ALL USING (true); 