# External Setup Requirements

This document lists everything that needs to be configured outside of the codebase (in Supabase, APIs, etc.).

## 📋 Quick Checklist

- [ ] Create Supabase project
- [ ] Run database schema SQL
- [ ] Run RLS policies SQL
- [ ] Create storage bucket
- [ ] Configure storage policies
- [ ] Get OpenAI API key
- [ ] Get USDA API key (optional)
- [ ] Configure OAuth providers (optional)
- [ ] Set up environment variables
- [ ] Deploy backend API

---

## 1. Supabase Setup

### Required Actions:

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project
   - Note: Project URL and anon key

2. **Run Database Schema**
   - Open SQL Editor in Supabase dashboard
   - Copy contents of `supabase/schema.sql`
   - Paste and execute
   - Verify 16 tables were created

3. **Run RLS Policies**
   - In SQL Editor, copy contents of `supabase/rls-policies.sql`
   - Paste and execute
   - Verify policies are active in Authentication → Policies

4. **Create Storage Bucket**
   - Go to Storage → New bucket
   - Name: `meal-photos`
   - Make it **Public**
   - Create bucket

5. **Configure Storage Policies**
   - Go to Storage → Policies → `meal-photos`
   - Add three policies:
     - **INSERT**: Users can upload to their own folder
     - **SELECT**: Anyone can view images
     - **DELETE**: Users can delete their own images
   - See `SETUP.md` for exact policy SQL

6. **Enable Email Authentication**
   - Go to Authentication → Providers
   - Enable "Email" provider
   - (Optional) Disable email confirmation for development

### Files to Use:
- `supabase/schema.sql` - Database schema
- `supabase/rls-policies.sql` - Security policies

---

## 2. API Keys Setup

### OpenAI API (Required)

**Purpose:** Exercise description analysis, food translation, search ranking

**Steps:**
1. Go to https://platform.openai.com
2. Sign up/login
3. Add payment method
4. Go to API Keys section
5. Create new secret key
6. Copy key (starts with `sk-...`)
7. Add to `.env` as `EXPO_PUBLIC_OPENAI_API_KEY`
8. Set usage limits in Billing → Usage limits

**Cost:** Pay-per-use, ~$0.15 per 1M tokens (gpt-4o-mini)

---

### USDA API (Optional but Recommended)

**Purpose:** Food database search with comprehensive nutrition data

**Steps:**
1. Go to https://fdc.nal.usda.gov/api-guide.html
2. Sign up for free API key
3. Copy API key
4. Add to `.env` as `EXPO_PUBLIC_USDA_API_KEY`

**Cost:** Free

**Note:** App works without this, but food search will be limited to Supabase food database.

---

## 3. Environment Variables

### Required Variables:

Create `.env` file in project root (copy from `.env.example`):

```bash
# Supabase (REQUIRED)
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (REQUIRED)
EXPO_PUBLIC_OPENAI_API_KEY=sk-...

# USDA (OPTIONAL)
EXPO_PUBLIC_USDA_API_KEY=your_usda_api_key

# Backend API (REQUIRED)
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:3000

# Rork Project ID (REQUIRED for photo analysis)
RORK_PROJECT_ID=your_rork_project_id
```

### Where to Get Values:

- **Supabase URL & Key**: Supabase Dashboard → Settings → API
- **OpenAI Key**: OpenAI Platform → API Keys
- **USDA Key**: USDA FoodData Central API signup
- **Rork Project ID**: Your Rork AI project dashboard
- **Backend URL**: Your deployed backend URL (or `http://localhost:3000` for dev)

---

## 4. OAuth Providers (Optional)

### Google OAuth

**Steps:**
1. Go to https://console.cloud.google.com
2. Create project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
5. Copy Client ID and Secret
6. In Supabase: Authentication → Providers → Google
7. Enable and add Client ID + Secret

### Apple Sign-In (iOS Only)

**Steps:**
1. Go to Apple Developer Portal
2. Create App ID with Sign in with Apple
3. Create Services ID
4. Generate Secret Key
5. In Supabase: Authentication → Providers → Apple
6. Add Services ID, Secret Key, Team ID

---

## 5. Backend API Deployment

### Options:

**Option 1: Vercel (Recommended)**
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project root
3. Follow prompts
4. Update `EXPO_PUBLIC_RORK_API_BASE_URL` with Vercel URL

**Option 2: Railway**
1. Go to https://railway.app
2. Create new project
3. Connect GitHub repo
4. Deploy backend folder
5. Get deployment URL

**Option 3: Fly.io**
1. Install Fly CLI
2. Run `fly launch` in backend folder
3. Follow prompts
4. Deploy with `fly deploy`

**Option 4: Your Own Server**
1. Set up Node.js/Bun server
2. Install dependencies
3. Run backend server
4. Configure reverse proxy (nginx)
5. Set up SSL certificate

### Environment Variables for Backend:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## 6. Food Database Population (Optional)

The `food` table in Supabase can be populated with food data for search.

### Options:

1. **Manual Entry**: Add foods through Supabase dashboard
2. **Import CSV**: Import food database CSV file
3. **API Integration**: Use USDA API to populate (requires custom script)
4. **Third-party Database**: Import from other nutrition databases

**Note:** The app can work with empty food table, but search functionality will be limited.

---

## 7. Testing & Verification

After setup, verify:

### Database:
- [ ] All 16 tables exist
- [ ] RLS policies are enabled
- [ ] Can create test user
- [ ] Can insert test food entry
- [ ] Can insert test exercise entry

### Storage:
- [ ] `meal-photos` bucket exists and is public
- [ ] Can upload test image
- [ ] Can view uploaded image URL
- [ ] Can delete uploaded image

### APIs:
- [ ] OpenAI API responds (test with simple request)
- [ ] USDA API responds (if configured)
- [ ] Backend API is accessible
- [ ] tRPC routes respond correctly

### Authentication:
- [ ] Can sign up with email
- [ ] Can sign in with email
- [ ] Can sign in with Google (if configured)
- [ ] Profile is created automatically

---

## 8. Production Considerations

### Security:
- [ ] Enable email confirmation in production
- [ ] Set up proper CORS policies
- [ ] Review RLS policies for production
- [ ] Set up API rate limiting
- [ ] Enable Supabase audit logs

### Performance:
- [ ] Set up database connection pooling
- [ ] Configure CDN for image storage
- [ ] Set up caching layer
- [ ] Monitor API response times

### Monitoring:
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Monitor Supabase usage
- [ ] Monitor OpenAI API usage
- [ ] Set up alerts for errors

### Backup:
- [ ] Enable Supabase daily backups
- [ ] Set up storage bucket backups
- [ ] Document recovery procedures

---

## 9. Cost Estimates

### Supabase:
- **Free tier**: 500MB database, 1GB storage, 2GB bandwidth
- **Pro tier**: $25/month - 8GB database, 100GB storage, 250GB bandwidth

### OpenAI:
- **gpt-4o-mini**: ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
- **Estimated**: $5-20/month for moderate usage

### USDA API:
- **Free**: Unlimited requests

### Backend Hosting:
- **Vercel**: Free tier available, Pro $20/month
- **Railway**: $5/month minimum
- **Fly.io**: Pay-as-you-go, ~$5-10/month

**Total Estimated Cost:** $10-50/month for small to medium usage

---

## 10. Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **OpenAI Docs**: https://platform.openai.com/docs
- **USDA API Guide**: https://fdc.nal.usda.gov/api-guide.html
- **Hono Docs**: https://hono.dev
- **tRPC Docs**: https://trpc.io

---

## Summary

**Minimum Required Setup:**
1. Supabase project + schema + RLS
2. Storage bucket + policies
3. OpenAI API key
4. Environment variables configured
5. Backend API deployed

**Recommended Additional Setup:**
1. USDA API key
2. Google OAuth
3. Food database populated
4. Production monitoring
5. Backup strategy

See `SETUP.md` for detailed step-by-step instructions.
