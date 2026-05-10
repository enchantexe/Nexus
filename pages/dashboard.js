/* ================================================================
   pages/dashboard.js — DASHBOARD  (Supabase edition)
================================================================ */

async function renderDashboard() {
  const user = currentUser();
  if (!user) return;

  setText('card-sessions', getSessionCount(user));

  const notes = await dbGetNotes(user);
  setText('card-notes', notes.length);

  const friends = await dbGetFriends(user);
  setText('card-friends', friends.length);

  const profile = await getProfile(user);
  setText('card-status-val', profile && profile.online !== false ? 'Online' : 'Offline');

  await renderActivity(user);
}

async function addActivity(text) {
  const user = currentUser();
  if (!user) return;
  await dbAddActivity(user, text);
  await renderActivity(user);
}

async function renderActivity(user) {
  const log  = await dbGetActivity(user);
  const list = document.getElementById('dash-activity-list');
  if (!list) return;

  list.innerHTML = log.length
    ? log.map((e, i) =>
        '<div class="activity-item" style="animation-delay:' + (i * 0.04) + 's">' +
          '<div class="activity-dot"></div>' +
          '<span>' + e.text + '</span>' +
          '<span class="activity-time">' + _fmtTime(e.created_at) + '</span>' +
        '</div>'
      ).join('')
    : '<div class="activity-item"><div class="activity-dot"></div><span>No activity yet.</span></div>';
}
