# Supabase Setup for Gemini Image Creation & Editing

This guide explains how to set up Supabase as the database backend for your Gemini Image Creation & Editing application.

## 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign up or log in
2. Create a new project
3. Give your project a name and set a secure database password
4. Choose the region closest to your users
5. Wait for your database to be provisioned (this might take a few minutes)

## 2. Set Up Database Tables

1. In your Supabase project, go to the SQL Editor
2. Copy the contents of the `supabase-schema.sql` file from this repository
3. Paste the SQL into the editor and click "Run"
4. This will create the necessary tables, indexes, and security policies

## 3. Create Storage Bucket

1. In your Supabase project, go to Storage
2. Click "Create a new bucket"
3. Enter "images" as the bucket name
4. Check "Public bucket" to make images publicly accessible (if that's what you want)
5. Click "Create bucket"

## 4. Set Up Storage Policies

1. After creating the bucket, click on the "images" bucket
2. Go to the "Policies" tab
3. Click "Add Policies"
4. For a simple setup, you can create a policy that allows public access:
   - Policy name: Public Access
   - Allowed operations: All
   - Policy definition: `true` (allows all operations)
   
   Note: For a production app, you might want more restrictive policies based on user authentication.

## 5. Get Your API Keys

1. In your Supabase project, go to Project Settings > API
2. You'll need the following values:
   - Project URL (ends with .supabase.co)
   - anon/public key

## 6. Configure Your Application

1. Copy your Supabase URL and anon key
2. Update the `.env.local` file in your application:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## 7. Run Your Application

Now that Supabase is set up and your application is configured, you can run your application:

```bash
npm run dev
```

Your application should now be storing conversation data, messages, and images in Supabase!

## Adding Authentication (Optional)

If you want to add user authentication to your application:

1. In Supabase, go to Authentication > Settings
2. Configure the auth methods you want to use (email, social providers, etc.)
3. Update the app code to use Supabase Auth
4. Modify the database policies to restrict access based on user IDs

## Troubleshooting

- If images aren't uploading correctly, check your storage bucket policies
- If database operations fail, check the browser console for error messages
- Ensure your environment variables are correctly set in `.env.local` 