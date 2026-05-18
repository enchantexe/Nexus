/* ================================================================
   script.js — CORE  (Supabase edition)
================================================================ */

let _sidebarCollapsed = false;
let _dropdownOpen     = false;

async function openPage(pageId) {
  document.querySelectorAll('.page-section').forEach(s => {
    s.classList.add('hidden'); s.classList.remove('active-section');
  });
  const target = document.getElementById(pageId);
  if (target) { target.classList.remove('hidden'); target.offsetHeight; target.classList.add('active-section'); }

  // Desktop nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
  const navBtn = document.getElementById('nav-' + pageId);
  if (navBtn) navBtn.classList.add('active-nav');

  // Mobile bottom nav highlight
  document.querySelectorAll('.mob-nav-item').forEach(n => n.classList.remove('active-mob-nav'));
  const mobMap = {
    'page-dashboard':'mob-nav-dashboard','page-feed':'mob-nav-feed',
    'page-friends':'mob-nav-friends','page-chat':'mob-nav-chat','page-profile':'mob-nav-profile'
  };
  const mobBtn = document.getElementById(mobMap[pageId]);
  if (mobBtn) mobBtn.classList.add('active-mob-nav');

  if (pageId === 'page-friends')       await renderFriendsPage();
  if (pageId === 'page-chat')          await renderChatContacts();
  if (pageId === 'page-notes')         await renderNotesList();
  if (pageId === 'page-feed')          await renderFeed();
  if (pageId === 'page-notifications') await renderNotifications();
  if (pageId === 'page-dashboard')     await renderDashboard();
  closeDropdown();
}

function toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', _sidebarCollapsed);
  document.getElementById('main-content').classList.toggle('sidebar-collapsed', _sidebarCollapsed);
  document.getElementById('collapse-btn').querySelector('.collapse-icon').textContent = _sidebarCollapsed ? '›' : '‹';
  localStorage.setItem('sidebarCollapsed', _sidebarCollapsed ? '1' : '0');
  const fab = document.getElementById('sidebar-expand-fab');
  if (fab) fab.classList.toggle('hidden', !_sidebarCollapsed);
}

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

async function refreshUI(username) {
  const profile = await getProfile(username);
  if (!profile) return;
  const avatarSrc = profile.avatar || 'assets/default-avatar.svg';
  const bannerSrc = profile.banner || '';
  document.getElementById('sidebar-username').textContent = username;
  document.getElementById('sidebar-status').textContent = profile.online !== false ? '● Online' : '○ Offline';
  setImgSrc('sidebar-avatar', avatarSrc); setImgSrc('topbar-avatar', avatarSrc); setImgSrc('feed-compose-avatar', avatarSrc);
  setText('disp-username', username);
  setText('disp-bio', profile.bio || '—');
  setText('disp-status-msg', profile.status_msg || '—');
  setText('settings-username', username);
  setImgSrc('profile-avatar-img', avatarSrc);
  const cover = document.getElementById('profile-cover');
  if (cover) { cover.style.backgroundImage = bannerSrc ? 'url(' + bannerSrc + ')' : ''; cover.style.backgroundSize = 'cover'; cover.style.backgroundPosition = 'center'; }
  const dot = document.getElementById('profile-online-dot');
  if (dot) dot.classList.toggle('online', profile.online !== false);
  renderSocialsDisplay(profile.socials || {});
  renderBadges(profile.badges || []);
  if (localStorage.getItem('theme') === 'light') toggleTheme(true);
  if (localStorage.getItem('motion') === 'reduce') toggleMotion(true);
  document.getElementById('status-toggle').classList.toggle('on', profile.online !== false);
  if (localStorage.getItem('sidebarCollapsed') === '1') { _sidebarCollapsed = false; toggleSidebar(); }
  await refreshNotifBadge(username);
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setImgSrc(id, src) { const el = document.getElementById(id); if (el) el.src = src; }

function toggleTheme(silent = false) {
  document.body.classList.toggle('light-mode');
  const on = document.body.classList.contains('light-mode');
  document.getElementById('theme-toggle').classList.toggle('on', on);
  if (!silent) localStorage.setItem('theme', on ? 'light' : 'dark');
}
function toggleMotion(silent = false) {
  document.body.classList.toggle('reduce-motion');
  const on = document.body.classList.contains('reduce-motion');
  document.getElementById('motion-toggle').classList.toggle('on', on);
  if (!silent) localStorage.setItem('motion', on ? 'reduce' : 'normal');
}
async function toggleOnlineStatus() {
  const user = currentUser(); const profile = await getProfile(user); const isOn = profile.online !== false;
  await updateProfile(user, { online: !isOn });
  document.getElementById('status-toggle').classList.toggle('on', !isOn);
  await refreshUI(user);
  showToast(!isOn ? 'You are now Online' : 'You are now Offline', 'success');
}
async function deleteAccount() {
  if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return;
  const user = currentUser();
  await db.from('messages').delete().or(`sender.eq.${user},receiver.eq.${user}`);
  await db.from('profiles').delete().eq('username', user);
  localStorage.removeItem('currentUser');
  location.reload();
}

const BADGES = [
  { key:'verified', icon:'✓', label:'Verified', color:'#38e5c5' },
  { key:'fire', icon:'🔥', label:'On Fire', color:'#f77955' },
  { key:'star', icon:'⭐', label:'Star User', color:'#f7c355' },
  { key:'dev', icon:'⚡', label:'Developer', color:'#7c5cfc' },
  { key:'og', icon:'👑', label:'OG Member', color:'#c655f7' },
  { key:'zen', icon:'☯', label:'Zen Mode', color:'#38a5e5' },
];
function renderBadges(selected) {
  const row = document.getElementById('badges-row'); if (!row) return;
  row.innerHTML = (selected || []).map(key => { const b = BADGES.find(x => x.key === key); return b ? '<span class="badge-chip" style="--badge-color:' + b.color + '" title="' + b.label + '">' + b.icon + ' ' + b.label + '</span>' : ''; }).join('');
}
async function renderBadgePicker() {
  const picker = document.getElementById('badge-picker'); if (!picker) return;
  const profile = await getProfile(currentUser()); const selected = profile ? (profile.badges || []) : [];
  picker.innerHTML = BADGES.map(b => '<div class="badge-option ' + (selected.includes(b.key) ? 'selected' : '') + '" style="--badge-color:' + b.color + '" onclick="toggleBadge(\'' + b.key + '\')"><span>' + b.icon + '</span><span>' + b.label + '</span></div>').join('');
}
async function toggleBadge(key) {
  const user = currentUser(); const profile = await getProfile(user); let badges = profile.badges || [];
  if (badges.includes(key)) { badges = badges.filter(k => k !== key); } else { if (badges.length >= 3) { showToast('Max 3 badges', 'error'); return; } badges.push(key); }
  await updateProfile(user, { badges }); renderBadgePicker(); renderBadges(badges); showToast('Badge updated', 'success');
}

async function refreshNotifBadge(username) {
  const unread = await dbUnreadNotifCount(username);
  const reqCount = await dbUnreadFriendRequestCount(username);
  const dot = document.getElementById('notif-dot'); const badge = document.getElementById('topbar-notif-badge'); const fBadge = document.getElementById('badge-friends');
  if (dot) dot.classList.toggle('hidden', unread === 0);
  if (badge) { badge.classList.toggle('hidden', unread === 0); badge.textContent = unread || ''; }
  if (fBadge) { fBadge.classList.toggle('hidden', reqCount === 0); fBadge.textContent = reqCount || ''; }
}
async function pushNotif(toUser, text) {
  await dbPushNotif(toUser, text);
  if (toUser === currentUser()) await refreshNotifBadge(toUser);
}

let _toastTimer = null;
function showToast(msg, type) {
  const t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer); _toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}
function _now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function _fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

window.onload = async () => {
  const user = currentUser();
  if (user) { const profile = await getProfile(user); if (profile) { await login(user); return; } localStorage.removeItem('currentUser'); }
};
