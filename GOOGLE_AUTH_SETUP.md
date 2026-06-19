# Google OAuth Authentication Setup

This document explains how to set up Google OAuth authentication with email confirmation for AESkolar.

## Overview

The sign-in page now supports Google OAuth authentication with the following features:
- Google OAuth sign-in flow
- Automatic redirect to role selection page after successful authentication
- Welcome email sent to the user's Gmail account after authentication

## Prerequisites

1. **Supabase Project** - You should already have a Supabase project set up
2. **Google Cloud Console** - Access to Google Cloud Console to configure OAuth
3. **Email Service** - Resend account (recommended) or another email service

## Step 1: Configure Google OAuth in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Providers** > **Google**
3. Enable the Google provider
4. You'll need to set up Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google+ API
   - Create OAuth 2.0 credentials:
     - Application type: Web application
     - Authorized redirect URI: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - Copy the Client ID and Client Secret
5. Paste the Client ID and Client Secret into your Supabase Google provider settings

## Step 2: Deploy the Edge Function for Email Sending

The Edge Function is located at `supabase/functions/send-welcome-email/index.ts`

### Option A: Using Resend (Recommended)

1. Sign up at [Resend.com](https://resend.com/)
2. Get your API key from the Resend dashboard
3. Set the environment variable in Supabase:
   - Go to your Supabase project > Edge Functions > Settings
   - Add environment variable: `RESEND_API_KEY` = `your-resend-api-key`
4. Deploy the Edge Function:
   ```bash
   supabase functions deploy send-welcome-email
   ```

### Option B: Using Supabase Built-in Email

If you prefer to use Supabase's built-in email service:

1. Enable email auth in Supabase dashboard
2. Configure email templates in Supabase dashboard
3. The Edge Function will fall back to logging if RESEND_API_KEY is not set

## Step 3: Configure Email Domain (for Resend)

1. In Resend dashboard, add your domain
2. Verify your domain by adding DNS records
3. Update the `from` email in the Edge Function to use your verified domain

## Step 4: Test the Implementation

1. Start your development server:
   ```bash
   npm run dev
   ```
2. Navigate to the sign-in page
3. Click "Continue with Google"
4. Complete the Google OAuth flow
5. Verify that:
   - You're redirected to the role selection page
   - A welcome email is sent to your Gmail account

## Environment Variables

Make sure your `.env` file contains:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Troubleshooting

### Google OAuth not working
- Verify your Google OAuth credentials are correct
- Check that the redirect URI matches exactly
- Ensure Google provider is enabled in Supabase

### Email not sending
- Check the browser console for errors
- Verify the Edge Function is deployed
- Check that RESEND_API_KEY is set in Supabase Edge Functions settings
- Verify your domain is verified in Resend

### Redirect not working / "localhost refused to connect" after Google sign-in

This almost always means a **port mismatch** or the dev server is not running.

1. Start the app: `npm run dev` — note the port Vite prints (default **5176** in `vite.config.js`).
2. Open the app at that exact URL, e.g. `http://localhost:5176/sign_in` (not an old bookmark on another port).
3. In **Supabase Dashboard → Authentication → URL Configuration** set:
   - **Site URL:** `http://localhost:5176`
   - **Redirect URLs:** add `http://localhost:5176/**` and `http://localhost:5176/role_selection`
4. Site URL and Vite `server.port` must use the **same port**.

### Redirect not working (other)
- Verify the route `/role_selection` exists in your React Router
- `signInWithGoogle()` uses `window.location.origin` — sign in from the same port you configured in Supabase

## Customization

### Email Template
Edit the HTML in `supabase/functions/send-welcome-email/index.ts` to customize the welcome email content.

### Redirect URL
Modify the `redirectTo` option in `Sign_in.jsx` if you want to redirect to a different page after authentication.

## Security Notes

- Never commit your API keys to version control
- Use environment variables for all sensitive data
- The Edge Function uses Supabase service role key, which has full access - keep it secure
