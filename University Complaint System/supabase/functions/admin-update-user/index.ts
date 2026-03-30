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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Edge Function env missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const verifyUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`
    const verifyRes = await fetch(verifyUrl, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` }
    })
    const verifyJson = await verifyRes.json().catch(() => ({}))
    if (!verifyRes.ok) {
      return new Response(JSON.stringify({ error: verifyJson?.message || 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminUserId = verifyJson?.id || verifyJson?.user?.id
    if (!adminUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: adminProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', adminUserId).single()
    if (adminProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { user_id, full_name, email, registration_number, department, new_password } = body
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: targetProfile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user_id)
      .single()
    if (pErr || !targetProfile) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (targetProfile.role !== 'student' && targetProfile.role !== 'staff') {
      return new Response(JSON.stringify({ error: 'Can only edit students and faculty' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: ures, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(user_id)
    if (getUserErr || !ures?.user) {
      return new Response(JSON.stringify({ error: getUserErr?.message || 'Auth user not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const user = ures.user
    const prevMeta = user.user_metadata || {}
    const nextMeta = { ...prevMeta }

    if (typeof full_name === 'string') {
      const n = full_name.trim()
      nextMeta.full_name = n || null
    }
    if (targetProfile.role === 'staff' && typeof department === 'string') {
      nextMeta.department = department.trim() || null
      nextMeta.registration_number = null
    }
    if (targetProfile.role === 'student' && typeof registration_number === 'string') {
      nextMeta.registration_number = registration_number.trim() || null
      nextMeta.department = null
    }

    const authUpdate = { user_metadata: nextMeta }
    if (typeof email === 'string' && email.trim()) {
      authUpdate.email = email.trim()
    }
    if (typeof new_password === 'string' && new_password.length >= 6) {
      authUpdate.password = new_password
    }

    const { error: upAuthErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate)
    if (upAuthErr) {
      return new Response(JSON.stringify({ error: upAuthErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const profilePatch = {
      updated_at: new Date().toISOString()
    }
    if (typeof full_name === 'string') profilePatch.full_name = full_name.trim() || null
    if (typeof email === 'string' && email.trim()) profilePatch.email = email.trim()

    if (targetProfile.role === 'staff') {
      if (typeof department === 'string') profilePatch.department = department.trim() || null
      profilePatch.registration_number = null
    } else {
      if (typeof registration_number === 'string') {
        profilePatch.registration_number = registration_number.trim() || null
      }
      profilePatch.department = null
    }

    const { error: upProfErr } = await supabaseAdmin.from('profiles').update(profilePatch).eq('id', user_id)
    if (upProfErr) {
      return new Response(JSON.stringify({ error: upProfErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
