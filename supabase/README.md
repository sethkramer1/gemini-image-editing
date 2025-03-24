# Supabase Database Changes

This directory contains SQL migration files for updating the Supabase database schema.

## Recent Updates

### User-Specific Conversations (2024-03-23)

The application has been updated to support user-specific conversations. Now each user can only see and manipulate their own conversations, messages, and images.

#### Database Changes

1. Updated Row Level Security (RLS) policies for all tables to enforce user-based access control
2. Set `user_id` to default to the authenticated user's ID for new conversations

#### How to Apply These Changes

To apply these changes to your Supabase project:

1. Navigate to the Supabase dashboard for your project
2. Go to the SQL Editor
3. Copy the contents of `migrations/20240323_update_rls_policies.sql`
4. Paste the SQL into the editor and run the query

Alternatively, if you're using the Supabase CLI:

```bash
supabase db push
```

## Initial Schema

The initial database schema is defined in the root `supabase-schema.sql` file.

To create the initial schema:

1. Navigate to the Supabase dashboard for your project
2. Go to the SQL Editor
3. Copy the contents of `../supabase-schema.sql`
4. Paste the SQL into the editor and run the query

## Storage Configuration

Make sure you have created a Storage bucket named `images` in your Supabase project. 