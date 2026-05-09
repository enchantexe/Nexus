/* ================================================================
   script.js — CORE
   Shared infrastructure used by every page module:
     - User data model
     - Storage helpers
     - Page navigation (openPage)
     - Sidebar collapse animation
     - Dropdown
     - Toast notifications
     - Global UI refresh
     - Theme / motion / status toggles
     - Account deletion
     - Auto-login on page load
================================================================ */

// ── USER DATA SCHEMA ─────────────────────────────────────────
//
//  users[username] = {
//    password  : string,
//    avatar    : string,   // base64 data-URL or ""
//    banner    : string,   // base64 data-URL or ""
//    bio       : string,
//    statusMsg : string,   // short status line shown on profile
//    socials   : { twitter, github, website },
//    badges    : string[], // selected badge keys
//    online    : boolean,
//    createdAt : number,   // Date.now()
//  }
//
// Additional per-user keys stored separately (large data):
//   activity_{u}     → array of {text, time}
//   notes_{u}        → array of {id, title, body, updatedAt}
//   feed_{u}         → array of {id, text, mood, time}
//   friends_{u}      → array of usernames
//   requests_{u}     → array of usernames (incoming requests)
//   chat_{u}_{v}     → array of {from, text, time}
//   notifs_{u}       → array of {id, text, time, read}
//   sessions_{u}     → number

// ── GLOBAL STATE ─────────────────────────────────────────────
let _sidebarCollapsed = false;
let _dropdownOpen     = false;

// ── STORAGE HELPERS ───────────────────────────────────────────
function getUsers()   { return JSON.parse(localStorage.getItem('users') || '{}'); }
function saveUsers(u) { localStorage.setItem('users', JSON.stringify(u)); }
function currentUser(){ return localStorage.getItem('currentUser'); }

/** Reads the full profile object for `username`. */
function getProfile(username) {
  return getUsers()[username] || null;
}

/** Writes back a partial update to a user's profile. */
function updateProfile(username, patch) {
  const users = getUsers();
  if (!users[username]) return;
  Object.assign(users[username], patch);
  saveUsers(users);
}

// ── PAGE NAVIGATION ───────────────────────────────────────────
/**
 * openPage(pageId)
 * Hides all .page-section elements, shows the one with id=pageId,
 * and updates the active nav item in the sidebar.
 *
 * This is the single authoritative way to change pages.
 *
 * @param {string} pageId  e.g. 'page-dashboard', 'page-profile'
 */
function openPage(pageId) {
  // Hide every section
  document.querySelectorAll('.page-section').forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('active-section');
  });

  // Show target
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.remove('hidden');
    // Force reflow so CSS transition replays
    target.offsetHeight;
    target.classList.add('active-section');
  }

  // Update nav highlights
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
  const navBtn = document.getElementById('nav-' + pageId);
  if (navBtn) navBtn.classList.add('active-nav');

  // Page-specific hooks
  if (pageId === 'page-friends')       renderFriendsPage();
  if (pageId === 'page-chat')          renderChatContacts();
  if (pageId === 'page-notes')         renderNotesList();
  if (pageId === 'page-feed')          renderFeed();
  if (pageId === 'page-notifications') renderNotifications();
  if (pageId === 'page-dashboard')     renderDashboard();

  closeDropdown();
}

// ── SIDEBAR COLLAPSE ──────────────────────────────────────────
/**
 * Toggles the sidebar between full width and icon-only collapsed state.
 * CSS handles the animation via the .collapsed class on <aside>.
 */
function toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', _sidebarCollapsed);
  document.getElementById('main-content').classList.toggle('sidebar-collapsed', _sidebarCollapsed);
  document.getElementById('collapse-btn').querySelector('.collapse-icon').textContent =
    _sidebarCollapsed ? '›' : '‹';
  localStorage.setItem('sidebarCollapsed', _sidebarCollapsed ? '1' : '0');
}

// ── DROPDOWN ──────────────────────────────────────────────────
function toggleDropdown() {
  _dropdownOpen = !_dropdownOpen;
  document.getElementById('dropdown-menu').classList.toggle('hidden', !_dropdownOpen);
  document.getElementById('dropdown-chevron').classList.toggle('open', _dropdownOpen);
}
function closeDropdown() {
  _dropdownOpen = false;
  document.getElementById('dropdown-menu').classList.add('hidden');
  document.getElementById('dropdown-chevron').classList.remove('open');
}
document.addEventListener('click', e => {
  const footer = document.querySelector('.sidebar-footer');
  if (footer && !footer.contains(e.target)) closeDropdown();
});

// ── GLOBAL UI REFRESH ─────────────────────────────────────────
/**
 * refreshUI(username)
 * Re-populates every UI slot that shows user identity data:
 * sidebar avatar/name, topbar avatar, profile page fields, etc.
 * Call this after login, after any profile edit, or after username rename.
 */
function refreshUI(username) {
  const profile  = getProfile(username);
  if (!profile) return;

  const avatarSrc = profile.avatar  || 'assets/default-avatar.svg';
  const bannerSrc = profile.banner  || '';

  // Sidebar
  document.getElementById('sidebar-username').textContent = username;
  document.getElementById('sidebar-status').textContent   =
    profile.online !== false ? '● Online' : '○ Offline';
  setImgSrc('sidebar-avatar',  avatarSrc);
  setImgSrc('topbar-avatar',   avatarSrc);
  setImgSrc('feed-compose-avatar', avatarSrc);

  // Profile page
  setText('disp-username',   username);
  setText('disp-bio',        profile.bio       || '—');
  setText('disp-status-msg', profile.statusMsg || '—');
  setText('settings-username', username);
  setImgSrc('profile-avatar-img', avatarSrc);

  // Cover banner
  const cover = document.getElementById('profile-cover');
  if (cover) {
    cover.style.backgroundImage    = bannerSrc ? 'url(' + bannerSrc + ')' : '';
    cover.style.backgroundSize     = 'cover';
    cover.style.backgroundPosition = 'center';
  }

  // Online dot
  const dot = document.getElementById('profile-online-dot');
  if (dot) dot.classList.toggle('online', profile.online !== false);

  // Socials
  renderSocialsDisplay(profile.socials || {});

  // Badges
  renderBadges(profile.badges || []);

  // Settings toggles (restore without writing)
  if (localStorage.getItem('theme')  === 'light')  toggleTheme(true);
  if (localStorage.getItem('motion') === 'reduce') toggleMotion(true);
  const statusOn = profile.online !== false;
  document.getElementById('status-toggle').classList.toggle('on', statusOn);

  // Restore sidebar collapse
  if (localStorage.getItem('sidebarCollapsed') === '1') {
    _sidebarCollapsed = false; // force toggle to flip it
    toggleSidebar();
  }

  // Notification badge
  refreshNotifBadge(username);
}

// ── DOM HELPERS ───────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setImgSrc(id, src) {
  const el = document.getElementById(id);
  if (el) el.src = src;
}
function applyBg(id, src, keep = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (src) {
    el.style.backgroundImage    = 'url(' + src + ')';
    el.style.backgroundSize     = 'cover';
    el.style.backgroundPosition = 'center';
  } else if (!keep) {
    el.style.backgroundImage = '';
  }
}

// ── SETTINGS: THEME ───────────────────────────────────────────
function toggleTheme(silent = false) {
  document.body.classList.toggle('light-mode');
  const on = document.body.classList.contains('light-mode');
  document.getElementById('theme-toggle').classList.toggle('on', on);
  if (!silent) localStorage.setItem('theme', on ? 'light' : 'dark');
}

// ── SETTINGS: MOTION ──────────────────────────────────────────
function toggleMotion(silent = false) {
  document.body.classList.toggle('reduce-motion');
  const on = document.body.classList.contains('reduce-motion');
  document.getElementById('motion-toggle').classList.toggle('on', on);
  if (!silent) localStorage.setItem('motion', on ? 'reduce' : 'normal');
}

// ── SETTINGS: ONLINE STATUS ───────────────────────────────────
function toggleOnlineStatus() {
  const user    = currentUser();
  const profile = getProfile(user);
  const isOn    = profile.online !== false;
  updateProfile(user, { online: !isOn });
  document.getElementById('status-toggle').classList.toggle('on', !isOn);
  refreshUI(user);
  showToast(!isOn ? 'You are now Online' : 'You are now Offline', 'success');
}

// ── SETTINGS: DELETE ACCOUNT ──────────────────────────────────
function deleteAccount() {
  if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return;
  const user  = currentUser();
  const users = getUsers();
  delete users[user];
  saveUsers(users);
  ['activity_','notes_','feed_','notifs_','sessions_'].forEach(p =>
    localStorage.removeItem(p + user)
  );
  // Remove all chat threads involving this user
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('chat_' + user + '_') || k.endsWith('_' + user)) localStorage.removeItem(k);
  });
  localStorage.removeItem('currentUser');
  location.reload();
}

// ── BADGES ────────────────────────────────────────────────────
const BADGES = [
  { key:'verified', icon:'✓', label:'Verified',   color:'#38e5c5' },
  { key:'fire',     icon:'🔥', label:'On Fire',    color:'#f77955' },
  { key:'star',     icon:'⭐', label:'Star User',  color:'#f7c355' },
  { key:'dev',      icon:'⚡', label:'Developer',  color:'#7c5cfc' },
  { key:'og',       icon:'👑', label:'OG Member',  color:'#c655f7' },
  { key:'zen',      icon:'☯',  label:'Zen Mode',   color:'#38a5e5' },
];

function renderBadges(selected) {
  const row = document.getElementById('badges-row');
  if (!row) return;
  row.innerHTML = selected.map(key => {
    const b = BADGES.find(x => x.key === key);
    return b
      ? '<span class="badge-chip" style="--badge-color:' + b.color + '" title="' + b.label + '">' + b.icon + ' ' + b.label + '</span>'
      : '';
  }).join('');
}

function renderBadgePicker() {
  const picker = document.getElementById('badge-picker');
  if (!picker) return;
  const user    = currentUser();
  const profile = getProfile(user);
  const selected = profile ? (profile.badges || []) : [];

  picker.innerHTML = BADGES.map(b =>
    '<div class="badge-option ' + (selected.includes(b.key) ? 'selected' : '') + '" '
    + 'style="--badge-color:' + b.color + '" '
    + 'onclick="toggleBadge(\'' + b.key + '\')">'
    + '<span>' + b.icon + '</span><span>' + b.label + '</span>'
    + '</div>'
  ).join('');
}

function toggleBadge(key) {
  const user    = currentUser();
  const profile = getProfile(user);
  let badges    = profile.badges || [];
  if (badges.includes(key)) {
    badges = badges.filter(k => k !== key);
  } else {
    if (badges.length >= 3) { showToast('Max 3 badges', 'error'); return; }
    badges.push(key);
  }
  updateProfile(user, { badges });
  renderBadgePicker();
  renderBadges(badges);
  showToast('Badge updated', 'success');
}

// ── NOTIFICATION BADGE ────────────────────────────────────────
function refreshNotifBadge(username) {
  const notifs  = JSON.parse(localStorage.getItem('notifs_' + username) || '[]');
  const unread  = notifs.filter(n => !n.read).length;
  const dot     = document.getElementById('notif-dot');
  const badge   = document.getElementById('topbar-notif-badge');
  const fBadge  = document.getElementById('badge-friends');

  if (dot)   dot.classList.toggle('hidden', unread === 0);
  if (badge) {
    badge.classList.toggle('hidden', unread === 0);
    badge.textContent = unread || '';
  }

  // Friend request count
  const reqs   = JSON.parse(localStorage.getItem('requests_' + username) || '[]');
  if (fBadge) {
    fBadge.classList.toggle('hidden', reqs.length === 0);
    fBadge.textContent = reqs.length || '';
  }
}

/** Push a notification for `toUser`. */
function pushNotif(toUser, text) {
  const key   = 'notifs_' + toUser;
  const list  = JSON.parse(localStorage.getItem(key) || '[]');
  list.unshift({ id: Date.now(), text, time: _now(), read: false });
  if (list.length > 30) list.pop();
  localStorage.setItem(key, JSON.stringify(list));
  // If it's for the current user, refresh badge
  if (toUser === currentUser()) refreshNotifBadge(toUser);
}

// ── TOAST ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type) {
  const t     = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// ── TIME HELPER ───────────────────────────────────────────────
function _now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── AUTO LOGIN ────────────────────────────────────────────────
window.onload = () => {
  const user = currentUser();
  if (user && getUsers()[user]) {
    login(user);        // defined in pages/auth.js
  }
};
