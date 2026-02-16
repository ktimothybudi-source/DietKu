# Backend Setup Guide

This document outlines all the steps needed to set up the backend infrastructure and external services for the Rork Dietku Clone application.

## Table of Contents
1. [Supabase Setup](#supabase-setup)
2. [Environment Variables](#environment-variables)
3. [OpenAI API Setup](#openai-api-setup)
4. [USDA API Setup (Optional)](#usda-api-setup-optional)
5. [Supabase Storage Setup](#supabase-storage-setup)
6. [Backend API Setup](#backend-api-setup)
7. [OAuth Providers Setup](#oauth-providers-setup)

---

## Supabase Setup

### 1. Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - Project name: `rork-dietku-clone` (or your preferred name)
   - Database password: (save this securely)
   - Region: Choose closest to your users
5. Wait for project to be created (takes ~2 minutes)

### 2. Get Your Supabase Credentials
1. Go to Project Settings → API
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Create Database Schema
1. Go to SQL Editor in Supabase dashboard
2. Open `supabase/schema.sql` from this project
3. Copy and paste the entire SQL script
4. Click "Run" to execute
5. Verify tables were created in Table Editor

### 4. Set Up Row Level Security (RLS)
1. In SQL Editor, open `supabase/rls-policies.sql`
2. Copy and paste the entire SQL script
3. Click "Run" to execute
4. Verify policies were created in Authentication → Policies

### 5. Enable Email Authentication
1. Go to Authentication → Providers
2. Enable "Email" provider
3. Configure email templates if needed
4. (Optional) Disable "Confirm email" for development

---

## Environment Variables

### 1. Create `.env` File
1. Copy `.env.example` to `.env` in the project root
2. Fill in all required values:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI API Key
EXPO_PUBLIC_OPENAI_API_KEY=sk-...

# USDA API Key (optional)
EXPO_PUBLIC_USDA_API_KEY=your_usda_api_key

# Backend API URL
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000

# Rork Project ID
RORK_PROJECT_ID=your_rork_project_id
```

### 2. Never Commit `.env` File
- The `.env` file is already in `.gitignore`
- Never commit API keys or secrets to version control

---

## OpenAI API Setup

### 1. Create OpenAI Account
1. Go to [https://platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Add payment method (required for API access)

### 2. Create API Key
1. Go to API Keys section
2. Click "Create new secret key"
3. Copy the key (starts with `sk-...`)
4. Add to `.env` as `EXPO_PUBLIC_OPENAI_API_KEY`

### 3. Set Usage Limits (Recommended)
1. Go to Billing → Usage limits
2. Set monthly spending limit to prevent unexpected charges
3. Monitor usage in the dashboard

**Note:** OpenAI API is used for:
- Exercise description analysis (estimating calories from text)
- Food name translation (Indonesian to English for USDA search)
- Food search result ranking

---

## USDA API Setup (Optional)

The USDA FoodData Central API is used for food database search. It's optional but recommended for better food search results.

### 1. Get API Key
1. Go to [https://fdc.nal.usda.gov/api-guide.html](https://fdc.nal.usda.gov/api-guide.html)
2. Sign up for a free API key
3. Copy the API key
4. Add to `.env` as `EXPO_PUBLIC_USDA_API_KEY`

**Note:** The app will work without this, but food search will be limited to Supabase food database.

---

## Supabase Storage Setup

### 1. Create Storage Bucket
1. Go to Storage in Supabase dashboard
2. Click "New bucket"
3. Name: `meal-photos`
4. Make it **Public** (for image URLs)
5. Click "Create bucket"

### 2. Set Storage Policies
1. Go to Storage → Policies
2. Select `meal-photos` bucket
3. Add policy:

**Policy Name:** `Users can upload their own images`
- Operation: `INSERT`
- Policy definition:
```sql
(bucket_id = 'meal-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

**Policy Name:** `Users can view all images`
- Operation: `SELECT`
- Policy definition:
```sql
bucket_id = 'meal-photos'::text
```

**Policy Name:** `Users can delete their own images`
- Operation: `DELETE`
- Policy definition:
```sql
(bucket_id = 'meal-photos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

### 3. Verify Storage Setup
- Try uploading a test image through the app
- Check Storage → `meal-photos` bucket to see uploaded files

---

## Backend API Setup

The app uses tRPC for type-safe API calls. The backend is built with Hono.

### 1. Install Dependencies
```bash
bun install
```

### 2. Start Backend Server (Development)
```bash
# If using Bun
bun run backend

# If using Node.js
node backend/index.js
```

### 3. Update API URL
- For local development: `http://localhost:3000`
- For production: Your deployed backend URL
- Update `EXPO_PUBLIC_RORK_API_BASE_URL` in `.env`

### 4. Deploy Backend (Production)
Options:
- **Vercel**: Deploy Hono app to Vercel
- **Railway**: Deploy to Railway
- **Fly.io**: Deploy to Fly.io
- **Your own server**: Deploy Hono app to your server

---

## OAuth Providers Setup

### Google OAuth (Optional but Recommended)

1. **Create Google OAuth Credentials**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing
   - Enable Google+ API
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://your-project.supabase.co/auth/v1/callback`
   - Copy Client ID and Client Secret

2. **Configure in Supabase**
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable Google provider
   - Add:
     - Client ID (from Google Cloud Console)
     - Client Secret (from Google Cloud Console)
   - Save

3. **Test Google Sign-In**
   - Try signing in with Google in the app
   - Verify user is created in Authentication → Users

### Apple Sign-In (iOS Only, Optional)

1. **Create Apple App ID**
   - Go to [Apple Developer Portal](https://developer.apple.com)
   - Create App ID with Sign in with Apple capability

2. **Configure in Supabase**
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable Apple provider
   - Add:
     - Services ID
     - Secret Key
     - Team ID

---

## Verification Checklist

After completing all setup steps, verify:

- [ ] Supabase project created and credentials added to `.env`
- [ ] Database schema created (check Table Editor)
- [ ] RLS policies enabled (check Authentication → Policies)
- [ ] Storage bucket `meal-photos` created and public
- [ ] OpenAI API key added to `.env` and working
- [ ] USDA API key added (optional)
- [ ] Backend API URL configured
- [ ] OAuth providers configured (if using)
- [ ] Test user can sign up and sign in
- [ ] Test food entry can be created
- [ ] Test image can be uploaded to storage
- [ ] Test exercise entry can be created
- [ ] Test community post can be created

---

## Troubleshooting

### Database Connection Issues
- Verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check Supabase project is active (not paused)
- Verify RLS policies allow your operations

### Image Upload Issues
- Verify storage bucket exists and is public
- Check storage policies allow INSERT for authenticated users
- Verify file path format matches policy expectations

### OpenAI API Issues
- Verify API key is correct and has credits
- Check usage limits aren't exceeded
- Verify model name is correct (`gpt-4o-mini`)

### Authentication Issues
- Verify email provider is enabled in Supabase
- Check email templates if email confirmation is enabled
- Verify OAuth redirect URIs match exactly

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide.html)
- [Hono Documentation](https://hono.dev)
- [tRPC Documentation](https://trpc.io)

---

## Support

If you encounter issues:
1. Check error logs in Supabase Dashboard → Logs
2. Check browser/app console for errors
3. Verify all environment variables are set correctly
4. Ensure all SQL scripts ran successfully
5. Check Supabase project status page
