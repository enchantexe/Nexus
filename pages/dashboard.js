/* ================================================================
   pages/dashboard.js — DASHBOARD
   Activity log, stat cards.
   Depends on: script.js
================================================================ */

// ── RENDER DASHBOARD ──────────────────────────────────────────
function renderDashboard() {
  const user = currentUser();
  if (!user) return;

  // Stat cards
  const sessions = localStorage.getItem('sessions_' + user) || 1;
  setText('card-sessions', sessions);

  const notes = JSON.parse(localStorage.getItem('notes_' + user) || '[]');
  setText('card-notes', notes.length);

  const friends = JSON.parse(localStorage.getItem('friends_' + user) || '[]');
  setText('card-friends', friends.length);

  const profile = getProfile(user);
  setText('card-status-val', profile && profile.online !== false ? 'Online' : 'Offline');

  renderActivity(user);
}

// ── ACTIVITY LOG ─────────────────────────────────────────────
function addActivity(text) {
  const user = currentUser();
  if (!user) return;
  const key = 'activity_' + user;
  const log = JSON.parse(localStorage.getItem(key) || '[]');
  log.unshift({ text, time: _now() });
  if (log.length > 20) log.pop();
  localStorage.setItem(key, JSON.stringify(log));
  renderActivity(user);
}

function renderActivity(user) {
  const log  = JSON.parse(localStorage.getItem('activity_' + user) || '[]');
  const list = document.getElementById('dash-activity-list');
  if (!list) return;

  list.innerHTML = log.length
    ? log.map((e, i) =>
        '<div class="activity-item" style="animation-delay:' + (i * 0.04) + 's">' +
          '<div class="activity-dot"></div>' +
          '<span>' + e.text + '</span>' +
          '<span class="activity-time">' + e.time + '</span>' +
        '</div>'
      ).join('')
    : '<div class="activity-item"><div class="activity-dot"></div><span>No activity yet.</span></div>';
}
