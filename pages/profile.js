/* ================================================================
   pages/profile.js — PROFILE PAGE
   Avatar (click + drag & drop), cover banner, bio, status msg,
   social links, badges, edit username, change password.
   Depends on: script.js, pages/dashboard.js
================================================================ */

// ── GENERIC EDIT HELPERS ──────────────────────────────────────
function startEdit(field) {
  document.getElementById('edit-' + field).classList.remove('hidden');
  const first = document.getElementById('edit-' + field).querySelector('input, textarea');
  if (first) first.focus();
}
function cancelEdit(field) {
  document.getElementById('edit-' + field).classList.add('hidden');
}
function setFieldMsg(id, text, ok) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = 'field-msg' + (ok ? ' ok' : '');
}

// ── AVATAR UPLOAD ─────────────────────────────────────────────
function uploadAvatar(e) {
  const file = e.target.files[0];
  if (file) processAvatarFile(file);
}
function avatarDragOver(e) {
  e.preventDefault();
  document.getElementById('profile-avatar').classList.add('drag-over');
}
function avatarDragLeave() {
  document.getElementById('profile-avatar').classList.remove('drag-over');
}
function avatarDrop(e) {
  e.preventDefault();
  document.getElementById('profile-avatar').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processAvatarFile(file);
  else showToast('Please drop an image file.', 'error');
}
function processAvatarFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const src  = ev.target.result;
    const user = currentUser();
    updateProfile(user, { avatar: src });
    setImgSrc('profile-avatar-img', src);
    setImgSrc('sidebar-avatar', src);
    setImgSrc('topbar-avatar',  src);
    setImgSrc('feed-compose-avatar', src);
    showToast('Avatar updated', 'success');
    addActivity('Updated profile avatar');
  };
  reader.readAsDataURL(file);
}

// ── COVER BANNER ──────────────────────────────────────────────
function uploadCover(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const src  = ev.target.result;
    const user = currentUser();
    updateProfile(user, { banner: src });
    const cover = document.getElementById('profile-cover');
    cover.style.backgroundImage = 'url(' + src + ')';
    cover.style.backgroundSize  = 'cover';
    showToast('Cover banner updated', 'success');
    addActivity('Changed cover banner');
  };
  reader.readAsDataURL(file);
}

// ── STATUS MESSAGE ────────────────────────────────────────────
function saveStatusMsg() {
  const val  = document.getElementById('inp-status-msg').value.trim();
  const user = currentUser();
  updateProfile(user, { statusMsg: val });
  setText('disp-status-msg', val || '—');
  setText('sidebar-status', getProfile(user).online !== false ? '● Online' : '○ Offline');
  cancelEdit('status-msg');
  showToast('Status updated', 'success');
  addActivity('Updated status message');
}

// ── BIO ───────────────────────────────────────────────────────
function saveBio() {
  const val  = document.getElementById('inp-bio').value.trim();
  const user = currentUser();
  updateProfile(user, { bio: val });
  setText('disp-bio', val || '—');
  cancelEdit('bio');
  showToast('Bio saved', 'success');
  addActivity('Updated bio');
}

// ── SOCIAL LINKS ──────────────────────────────────────────────
function saveSocials() {
  const user    = currentUser();
  const socials = {
    twitter : document.getElementById('inp-twitter').value.trim(),
    github  : document.getElementById('inp-github').value.trim(),
    website : document.getElementById('inp-website').value.trim(),
  };
  updateProfile(user, { socials });
  renderSocialsDisplay(socials);
  cancelEdit('socials');
  showToast('Social links updated', 'success');
  addActivity('Updated social links');
}

function renderSocialsDisplay(socials) {
  const disp = document.getElementById('socials-display');
  const summary = document.getElementById('disp-socials');
  if (!disp) return;

  const links = [];
  if (socials.twitter) links.push('<a class="social-link twitter" href="https://twitter.com/' + socials.twitter.replace('@','') + '" target="_blank">𝕏 ' + socials.twitter + '</a>');
  if (socials.github)  links.push('<a class="social-link github"  href="https://github.com/'  + socials.github  + '" target="_blank">⎇ ' + socials.github  + '</a>');
  if (socials.website) links.push('<a class="social-link website" href="' + socials.website + '" target="_blank">⬡ ' + socials.website + '</a>');

  disp.innerHTML       = links.join('');
  if (summary) summary.textContent = links.length ? links.length + ' link' + (links.length > 1 ? 's' : '') : '—';
}

// ── EDIT USERNAME ─────────────────────────────────────────────
function saveUsername() {
  const newName = document.getElementById('inp-new-username').value.trim();
  const users   = getUsers();
  const user    = currentUser();

  if (newName.length < 4 || newName.length > 20)
    return setFieldMsg('msg-username', 'Must be 4–20 characters.', false);
  if (users[newName] && newName !== user)
    return setFieldMsg('msg-username', 'Username already taken.', false);

  // Migrate user record under new key
  users[newName] = users[user];
  delete users[user];

  // Migrate all per-user localStorage keys
  ['activity_','notes_','feed_','notifs_','sessions_','friends_','requests_'].forEach(p => {
    const v = localStorage.getItem(p + user);
    if (v != null) { localStorage.setItem(p + newName, v); localStorage.removeItem(p + user); }
  });
  // Migrate chat threads
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('chat_' + user + '_')) {
      const partner = k.replace('chat_' + user + '_', '');
      localStorage.setItem('chat_' + newName + '_' + partner, localStorage.getItem(k));
      localStorage.removeItem(k);
    }
  });

  saveUsers(users);
  localStorage.setItem('currentUser', newName);

  cancelEdit('username');
  setFieldMsg('msg-username', '', true);
  refreshUI(newName);
  showToast('Username updated', 'success');
  addActivity('Changed username to ' + newName);
}

// ── CHANGE PASSWORD ───────────────────────────────────────────
function savePassword() {
  const cur  = document.getElementById('inp-cur-password').value.trim();
  const next = document.getElementById('inp-new-password').value.trim();
  const user = currentUser();
  const prof = getProfile(user);

  if (prof.password !== cur)  return setFieldMsg('msg-password', 'Current password is wrong.', false);
  if (next.length < 6)         return setFieldMsg('msg-password', 'New password must be 6+ chars.', false);

  updateProfile(user, { password: next });
  document.getElementById('inp-cur-password').value = '';
  document.getElementById('inp-new-password').value = '';
  cancelEdit('password');
  setFieldMsg('msg-password', 'Password changed ✓', true);
  showToast('Password updated', 'success');
  addActivity('Changed password');
  setTimeout(() => setFieldMsg('msg-password', '', true), 3000);
}
