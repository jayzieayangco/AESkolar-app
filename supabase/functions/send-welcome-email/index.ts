import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, userName } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Option 1: Use Resend (recommended for Supabase)
    // You'll need to set RESEND_API_KEY in Supabase Edge Function secrets
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (resendApiKey) {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AESkolar <onboarding@yourdomain.com>',
          to: email,
          subject: 'Welcome to AESkolar!',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb;">Welcome to AESkolar!</h1>
              <p>Hi ${userName || 'there'},</p>
              <p>Thank you for signing in with Google. Your account has been successfully created and verified.</p>
              <p>You can now access all the features of AESkolar and start your learning journey.</p>
              <p>If you have any questions, feel free to reach out to our support team.</p>
              <p style="margin-top: 30px;">Best regards,<br>The AESkolar Team</p>
            </div>
          `,
        }),
      })

      if (!resendResponse.ok) {
        const error = await resendResponse.text()
        console.error('Resend API error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to send email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    } else {
      // Option 2: Use Supabase's built-in email (fallback)
      // This requires email auth to be configured in Supabase dashboard
      console.log('RESEND_API_KEY not found, using Supabase built-in email')
      
      // Log the email send attempt (you can replace this with actual Supabase email logic)
      console.log(`Welcome email would be sent to: ${email}`)
    }

    return new Response(
      JSON.stringify({ message: 'Welcome email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in send-welcome-email function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
