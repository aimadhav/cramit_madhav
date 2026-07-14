import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed' });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return response(401, { error: 'Authentication required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(500, { error: 'Account deletion is not configured' });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.confirmation !== 'DELETE') return response(400, { error: 'Confirmation required' });

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  const user = userData.user;
  if (userError || !user) return response(401, { error: 'Session is invalid or expired' });

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) return response(500, { error: 'Could not verify account ownership' });
  if (profile?.is_admin) {
    return response(409, { error: 'Content administrator accounts must be transferred before deletion.' });
  }

  const { count: ownedDeckCount, error: deckCheckError } = await admin
    .from('decks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (deckCheckError) return response(500, { error: 'Could not verify owned content' });
  if ((ownedDeckCount ?? 0) > 0) {
    return response(409, { error: 'This account owns shared content. Contact support to transfer it before deletion.' });
  }

  const { data: ownedRooms, error: roomLoadError } = await admin
    .from('rooms')
    .select('id')
    .eq('created_by', user.id);
  if (roomLoadError) return response(500, { error: 'Could not load account classes' });

  const roomIds = (ownedRooms ?? []).map((room) => room.id);
  if (roomIds.length > 0) {
    const roomDeletes = await Promise.all([
      admin.from('room_decks').delete().in('room_id', roomIds),
      admin.from('room_memberships').delete().in('room_id', roomIds),
    ]);
    if (roomDeletes.some((result) => result.error)) {
      return response(500, { error: 'Could not delete account classes' });
    }
    const { error: roomDeleteError } = await admin.from('rooms').delete().in('id', roomIds);
    if (roomDeleteError) return response(500, { error: 'Could not delete account classes' });
  }

  const deletes = await Promise.all([
    admin.from('room_memberships').delete().eq('user_id', user.id),
    admin.from('user_active_chapters').delete().eq('user_id', user.id),
    admin.from('user_flashcard_statuses').delete().eq('user_id', user.id),
    admin.from('reviews').delete().eq('user_id', user.id),
    admin.from('study_sessions').delete().eq('user_id', user.id),
  ]);
  if (deletes.some((result) => result.error)) {
    return response(500, { error: 'Could not delete all account data' });
  }

  const { error: profileDeleteError } = await admin.from('users').delete().eq('id', user.id);
  if (profileDeleteError) return response(500, { error: 'Could not delete the account profile' });

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteError) return response(500, { error: 'Could not delete the authentication account' });

  return response(200, { deleted: true });
});
