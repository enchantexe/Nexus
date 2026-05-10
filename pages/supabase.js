/* ================================================================
   pages/supabase.js — SUPABASE CLIENT + DB HELPERS
   Replaces all localStorage reads/writes with Supabase Postgres.
   Load this FIRST, before script.js.
================================================================ */

const SUPABASE_URL = 'https://ifomedctijnoeyuztatt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlmb21lZGN0aWpub2V5dXp0YXR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTYzODMsImV4cCI6MjA5Mzk3MjM4M30.N_aXJC7ZE41ISUbTnXkM1oDiVKJNI_pwHQ5W-uIJ1XQ';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── SESSION (still use localStorage just for "who is logged in") ──
function currentUser() { return localStorage.getItem('currentUser'); }

// ── PROFILES ──────────────────────────────────────────────────────

async function getUsers() {
  const { data } = await db.from('profiles').select('*');
  const map = {};
  (data || []).forEach(u => map[u.username] = u);
  return map;
}

async function getProfile(username) {
  const { data } = await db.from('profiles').select('*').eq('username', username).single();
  return data || null;
}

async function saveUsers() { /* no-op — writes go through updateProfile/createUser */ }

async function updateProfile(username, patch) {
  // Map camelCase JS keys → snake_case DB columns
  const mapped = {};
  if (patch.avatar    !== undefined) mapped.avatar     = patch.avatar;
  if (patch.banner    !== undefined) mapped.banner      = patch.banner;
  if (patch.bio       !== undefined) mapped.bio         = patch.bio;
  if (patch.statusMsg !== undefined) mapped.status_msg  = patch.statusMsg;
  if (patch.socials   !== undefined) mapped.socials     = patch.socials;
  if (patch.badges    !== undefined) mapped.badges      = patch.badges;
  if (patch.online    !== undefined) mapped.online      = patch.online;
  if (patch.password  !== undefined) mapped.password    = patch.password;
  await db.from('profiles').update(mapped).eq('username', username);
}

async function createUser(username, password) {
  const { error } = await db.from('profiles').insert({
    username,
    password,
    avatar: '', banner: '', bio: '', status_msg: '',
    socials: { twitter: '', github: '', website: '' },
    badges: [], online: true
  });
  return !error;
}

async function checkLogin(username, password) {
  const { data } = await db.from('profiles')
    .select('*').eq('username', username).eq('password', password).single();
  return data || null;
}

async function userExists(username) {
  const { data } = await db.from('profiles').select('username').eq('username', username).single();
  return !!data;
}

async function renameUser(oldName, newName) {
  // Supabase won't cascade-rename text FK columns automatically,
  // so we copy the row, update child rows, then delete old row.
  const profile = await getProfile(oldName);
  if (!profile) return false;

  // Insert under new name
  const { error } = await db.from('profiles').insert({ ...profile, username: newName });
  if (error) return false;

  // Update child tables
  const tables = [
    { table: 'activity',         col: 'username' },
    { table: 'notes',            col: 'username' },
    { table: 'feed',             col: 'username' },
    { table: 'notifications',    col: 'username' },
    { table: 'friend_requests',  col: 'from_user' },
    { table: 'friend_requests',  col: 'to_user' },
    { table: 'friends',          col: 'user_a' },
    { table: 'friends',          col: 'user_b' },
    { table: 'messages',         col: 'sender' },
    { table: 'messages',         col: 'receiver' },
  ];
  for (const { table, col } of tables) {
    await db.from(table).update({ [col]: newName }).eq(col, oldName);
  }

  await db.from('profiles').delete().eq('username', oldName);
  return true;
}

// ── ACTIVITY ──────────────────────────────────────────────────────

async function dbAddActivity(username, text) {
  await db.from('activity').insert({ username, text });
}

async function dbGetActivity(username) {
  const { data } = await db.from('activity')
    .select('*').eq('username', username)
    .order('created_at', { ascending: false }).limit(20);
  return data || [];
}

// ── SESSIONS (simple counter stored in profiles extra col) ────────
// We track sessions as a plain localStorage number since it's cosmetic.
function getSessionCount(username) {
  return parseInt(localStorage.getItem('sessions_' + username) || '0');
}
function bumpSession(username) {
  const n = getSessionCount(username) + 1;
  localStorage.setItem('sessions_' + username, n);
  return n;
}

// ── NOTES ─────────────────────────────────────────────────────────

async function dbGetNotes(username) {
  const { data } = await db.from('notes')
    .select('*').eq('username', username)
    .order('updated_at', { ascending: false });
  return data || [];
}

async function dbCreateNote(username) {
  const { data } = await db.from('notes')
    .insert({ username, title: '', body: '' })
    .select().single();
  return data;
}

async function dbSaveNote(id, title, body) {
  await db.from('notes')
    .update({ title, body, updated_at: new Date().toISOString() })
    .eq('id', id);
}

async function dbDeleteNote(id) {
  await db.from('notes').delete().eq('id', id);
}

// ── FEED ──────────────────────────────────────────────────────────

async function dbPostFeed(username, text, mood) {
  await db.from('feed').insert({ username, text, mood });
}

async function dbGetFeed(usernames) {
  if (!usernames.length) return [];
  const { data } = await db.from('feed')
    .select('*, profiles(avatar)')
    .in('username', usernames)
    .order('created_at', { ascending: false })
    .limit(50);
  return data || [];
}

async function dbDeleteFeedPost(id) {
  await db.from('feed').delete().eq('id', id);
}

// ── FRIENDS ───────────────────────────────────────────────────────

async function dbGetFriends(username) {
  const { data } = await db.from('friends')
    .select('user_b').eq('user_a', username);
  return (data || []).map(r => r.user_b);
}

async function dbAddFriend(a, b) {
  await db.from('friends').upsert([{ user_a: a, user_b: b }, { user_a: b, user_b: a }]);
}

async function dbRemoveFriend(a, b) {
  await db.from('friends').delete().or(`and(user_a.eq.${a},user_b.eq.${b}),and(user_a.eq.${b},user_b.eq.${a})`);
}

async function dbSendFriendRequest(from, to) {
  await db.from('friend_requests').upsert({ from_user: from, to_user: to });
}

async function dbGetFriendRequests(username) {
  const { data } = await db.from('friend_requests')
    .select('from_user').eq('to_user', username);
  return (data || []).map(r => r.from_user);
}

async function dbRemoveFriendRequest(from, to) {
  await db.from('friend_requests').delete()
    .eq('from_user', from).eq('to_user', to);
}

async function dbHasSentRequest(from, to) {
  const { data } = await db.from('friend_requests')
    .select('id').eq('from_user', from).eq('to_user', to).single();
  return !!data;
}

// ── MESSAGES ──────────────────────────────────────────────────────

async function dbGetMessages(userA, userB) {
  const { data } = await db.from('messages')
    .select('*')
    .or(`and(sender.eq.${userA},receiver.eq.${userB}),and(sender.eq.${userB},receiver.eq.${userA})`)
    .order('created_at', { ascending: true });
  return data || [];
}

async function dbSendMessage(sender, receiver, text) {
  await db.from('messages').insert({ sender, receiver, text });
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────

async function dbPushNotif(toUser, text) {
  await db.from('notifications').insert({ username: toUser, text });
}

async function dbGetNotifs(username) {
  const { data } = await db.from('notifications')
    .select('*').eq('username', username)
    .order('created_at', { ascending: false }).limit(30);
  return data || [];
}

async function dbMarkNotifsRead(username) {
  await db.from('notifications').update({ read: true }).eq('username', username);
}

async function dbClearNotifs(username) {
  await db.from('notifications').delete().eq('username', username);
}

async function dbUnreadNotifCount(username) {
  const { count } = await db.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('username', username).eq('read', false);
  return count || 0;
}

async function dbUnreadFriendRequestCount(username) {
  const { count } = await db.from('friend_requests')
    .select('*', { count: 'exact', head: true })
    .eq('to_user', username);
  return count || 0;
}
