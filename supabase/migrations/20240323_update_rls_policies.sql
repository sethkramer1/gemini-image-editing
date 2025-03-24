-- Drop existing policies
DROP POLICY IF EXISTS "Public Access" ON conversations;
DROP POLICY IF EXISTS "Public Access" ON messages;
DROP POLICY IF EXISTS "Public Access" ON images;

-- Alter table to ensure user_id is non-null for new conversations
ALTER TABLE conversations 
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Create user-based policies for conversations
CREATE POLICY "Users can create their own conversations" 
ON conversations FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own conversations" 
ON conversations FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own conversations" 
ON conversations FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own conversations" 
ON conversations FOR DELETE 
TO authenticated 
USING (user_id = auth.uid());

-- For messages, we secure through the conversation_id foreign key
CREATE POLICY "Users can create messages in their conversations" 
ON messages FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_id 
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view messages in their conversations" 
ON messages FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_id 
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update messages in their conversations" 
ON messages FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_id 
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete messages in their conversations" 
ON messages FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.id = conversation_id 
    AND conversations.user_id = auth.uid()
  )
);

-- For images, we secure through the message_id foreign key
CREATE POLICY "Users can create images for their messages" 
ON images FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages
    JOIN conversations ON messages.conversation_id = conversations.id
    WHERE messages.id = message_id 
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view images for their messages" 
ON images FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM messages
    JOIN conversations ON messages.conversation_id = conversations.id
    WHERE messages.id = message_id 
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update images for their messages" 
ON images FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM messages
    JOIN conversations ON messages.conversation_id = conversations.id
    WHERE messages.id = message_id 
    AND conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete images for their messages" 
ON images FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM messages
    JOIN conversations ON messages.conversation_id = conversations.id
    WHERE messages.id = message_id 
    AND conversations.user_id = auth.uid()
  )
); 