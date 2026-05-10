/* ================================================================
   pages/profile.js — PROFILE PAGE  (Supabase edition)
================================================================ */

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

// ── AVATAR ────────────────────────────────────────────────────
function uploadAvatar(e) { const file = e.target.files[0]; if (file) processAvatarFile(file); }
function avatarDragOver(e) { e.preventDefault(); document.getElementById('profile-avatar').classList.add('drag-over'); }
function avatarDragLeave() { document.getElementById('profile-avatar').classList.remove('drag-over'); }
function avatarDrop(e) {
  e.preventDefault(); document.getElementById('profile-avatar').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processAvatarFile(file);
  else showToast('Please drop an image file.', 'error');
}
function processAvatarFile(file) {
  const reader = new FileReader();
  reader.onload = async ev => {
    const src = ev.target.result; const user = currentUser();
    await updateProfile(user, { avatar: src });
    setImgSrc('profile-avatar-img', src); setImgSrc('sidebar-avatar', src);
    setImgSrc('topbar-avatar', src); setImgSrc('feed-compose-avatar', src);
    showToast('Avatar updated', 'success'); await addActivity('Updated profile avatar');
  };
  reader.readAsDataURL(file);
}

// ── COVER BANNER ──────────────────────────────────────────────
function uploadCover(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const src = ev.target.result; const user = currentUser();
    await updateProfile(user, { banner: src });
    const cover = document.getElementById('profile-cover');
    cover.style.backgroundImage = 'url(' + src + ')'; cover.style.backgroundSize = 'cover';
    showToast('Cover banner updated', 'success'); await addActivity('Changed cover banner');
  };
  reader.readAsDataURL(file);
}

// ── STATUS MESSAGE ────────────────────────────────────────────
async function saveStatusMsg() {
  const val = document.getElementById('inp-status-msg').value.trim(); const user = currentUser();
  await updateProfile(user, { statusMsg: val });
  setText('disp-status-msg', val || '—');
  const profile = await getProfile(user);
  setText('sidebar-status', profile.online !== false ? '● Online' : '○ Offline');
  cancelEdit('status-msg'); showToast('Status updated', 'success'); await addActivity('Updated status message');
}

// ── BIO ───────────────────────────────────────────────────────
async function saveBio() {
  const val = document.getElementById('inp-bio').value.trim(); const user = currentUser();
  await updateProfile(user, { bio: val });
  setText('disp-bio', val || '—');
  cancelEdit('bio'); showToast('Bio saved', 'success'); await addActivity('Updated bio');
}

// ── SOCIAL LINKS ──────────────────────────────────────────────
async function saveSocials() {
  const user = currentUser();
  const socials = {
    twitter: document.getElementById('inp-twitter').value.trim(),
    github:  document.getElementById('inp-github').value.trim(),
    website: document.getElementById('inp-website').value.trim(),
  };
  await updateProfile(user, { socials });
  renderSocialsDisplay(socials);
  cancelEdit('socials'); showToast('Social links updated', 'success'); await addActivity('Updated social links');
}

function renderSocialsDisplay(socials) {
  const disp = document.getElementById('socials-display'); const summary = document.getElementById('disp-socials');
  if (!disp) return;
  const links = [];
  if (socials.twitter) links.push('<a class="social-link twitter" href="https://twitter.com/' + socials.twitter.replace('@','') + '" target="_blank">𝕏 ' + socials.twitter + '</a>');
  if (socials.github)  links.push('<a class="social-link github"  href="https://github.com/'  + socials.github  + '" target="_blank">⎇ ' + socials.github  + '</a>');
  if (socials.website) links.push('<a class="social-link website" href="' + socials.website + '" target="_blank">⬡ ' + socials.website + '</a>');
  disp.innerHTML = links.join('');
  if (summary) summary.textContent = links.length ? links.length + ' link' + (links.length > 1 ? 's' : '') : '—';
}

// ── EDIT USERNAME ─────────────────────────────────────────────
async function saveUsername() {
  const newName = document.getElementById('inp-new-username').value.trim();
  const user    = currentUser();

  if (newName.length < 4 || newName.length > 20) return setFieldMsg('msg-username', 'Must be 4–20 characters.', false);
  if (newName === user) return cancelEdit('username');

  const exists = await userExists(newName);
  if (exists) return setFieldMsg('msg-username', 'Username already taken.', false);

  const ok = await renameUser(user, newName);
  if (!ok) return setFieldMsg('msg-username', 'Rename failed. Try again.', false);

  localStorage.setItem('currentUser', newName);
  cancelEdit('username');
  setFieldMsg('msg-username', '', true);
  await refreshUI(newName);
  showToast('Username updated', 'success');
  await addActivity('Changed username to ' + newName);
}

// ── CHANGE PASSWORD ───────────────────────────────────────────
async function savePassword() {
  const cur  = document.getElementById('inp-cur-password').value.trim();
  const next = document.getElementById('inp-new-password').value.trim();
  const user = currentUser();
  const prof = await getProfile(user);

  if (prof.password !== cur) return setFieldMsg('msg-password', 'Current password is wrong.', false);
  if (next.length < 6)       return setFieldMsg('msg-password', 'New password must be 6+ chars.', false);

  await updateProfile(user, { password: next });
  document.getElementById('inp-cur-password').value = '';
  document.getElementById('inp-new-password').value = '';
  cancelEdit('password');
  setFieldMsg('msg-password', 'Password changed ✓', true);
  showToast('Password updated', 'success');
  await addActivity('Changed password');
  setTimeout(() => setFieldMsg('msg-password', '', true), 3000);
}
