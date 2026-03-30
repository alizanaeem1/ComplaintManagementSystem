// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, authorization, x-client-info, apikey, content-type, Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    // Some dashboards block creating custom secrets with SUPABASE_ prefix.
    // Support fallback name SERVICE_ROLE_KEY.
    const supabaseServiceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Edge Function env missing: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Supabase expects a raw JWT, but clients may send "Bearer <token>".
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const tokenInfo = {
      segments: token ? token.split('.').length : 0,
      length: token ? token.length : 0,
      envSupabaseUrl: supabaseUrl
    }
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized', tokenInfo }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify JWT via Authorization header. This avoids any mismatch in how `getUser(token)`
    // parses the provided token across supabase-js versions.
    // Verify JWT by calling GoTrue directly.
    // This avoids any auth client/header quirks and returns the exact reason from Supabase auth.
    const verifyUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`
    const verifyRes = await fetch(verifyUrl, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`
      }
    })

    const verifyJson = await verifyRes.json().catch(() => ({}))
    if (!verifyRes.ok) {
      return new Response(
        JSON.stringify({
          error: verifyJson?.message || verifyJson?.error_description || verifyJson?.msg || 'Unauthorized',
          tokenInfo,
          verify: { status: verifyRes.status, body: verifyJson }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = verifyJson?.id || verifyJson?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing user id', tokenInfo }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).single()
    if (profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json()
    const { email, password, full_name, role, department, registration_number } = body
    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'Missing email, password, full_name, or role' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (role !== 'student' && role !== 'staff') {
      return new Response(JSON.stringify({ error: 'Role must be student or staff' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const reg =
      role === 'student' && typeof registration_number === 'string'
        ? registration_number.trim() || null
        : null
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        department: role === 'staff' ? (department || null) : null,
        registration_number: reg
      }
    })

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Safety net: ensure profile row is present with latest registration/department.
    // (Covers edge cases where trigger timing/schema mismatch leaves registration_number empty.)
    const newUserId = newUser.user?.id
    if (newUserId) {
      await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: newUserId,
            role,
            full_name,
            email,
            department: role === 'staff' ? (department || null) : null,
            registration_number: role === 'student' ? reg : null,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        )
    }
    return new Response(JSON.stringify({ id: newUser.user?.id, email: newUser.user?.email }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
