/* ================================================================
   pages/social.js — SOCIAL FEATURES
   Friends system, Chat, Activity Feed, Notifications, Notes.
   Depends on: script.js, pages/dashboard.js
================================================================ */

// ╔══════════════════════════════════════════════════════════════╗
// ║  FRIENDS                                                     ║
// ╚══════════════════════════════════════════════════════════════╝

function renderFriendsPage() {
  const user    = currentUser();
  const friends = JSON.parse(localStorage.getItem('friends_'  + user) || '[]');
  const reqs    = JSON.parse(localStorage.getItem('requests_' + user) || '[]');
  const users   = getUsers();

  // ── My friends list
  const fList = document.getElementById('friends-list');
  setText('friends-count', friends.length);
  fList.innerHTML = friends.length
    ? friends.map(f => {
        const p      = users[f] || {};
        const online = p.online !== false;
        return '<div class="user-row">' +
          '<img class="user-row-avatar" src="' + (p.avatar || 'assets/default-avatar.svg') + '">' +
          '<div class="user-row-info">' +
            '<span class="user-row-name">' + f + '</span>' +
            '<span class="user-row-sub ' + (online ? 'online' : '') + '">' + (online ? '● Online' : '○ Offline') + '</span>' +
          '</div>' +
          '<button class="btn-sm danger-outline" onclick="removeFriend(\'' + f + '\')">Remove</button>' +
          '<button class="btn-sm" onclick="openChat(\'' + f + '\')">Chat</button>' +
        '</div>';
      }).join('')
    : '<p class="empty-hint">No friends yet. Search for users above.</p>';

  // ── Incoming requests
  const rList = document.getElementById('friend-requests-list');
  setText('req-count', reqs.length);
  rList.innerHTML = reqs.length
    ? reqs.map(r =>
        '<div class="user-row">' +
          '<img class="user-row-avatar" src="' + ((users[r] || {}).avatar || 'assets/default-avatar.svg') + '">' +
          '<div class="user-row-info"><span class="user-row-name">' + r + '</span></div>' +
          '<button class="btn-sm" onclick="acceptRequest(\'' + r + '\')">Accept</button>' +
          '<button class="btn-sm danger-outline" onclick="declineRequest(\'' + r + '\')">Decline</button>' +
        '</div>'
      ).join('')
    : '<p class="empty-hint">No pending requests.</p>';

  // Reset search
  document.getElementById('user-search-results').innerHTML = '';
  document.getElementById('friend-search').value = '';
}

function searchUsers() {
  const query   = document.getElementById('friend-search').value.trim().toLowerCase();
  const user    = currentUser();
  const users   = getUsers();
  const friends = JSON.parse(localStorage.getItem('friends_' + user) || '[]');
  const sent    = JSON.parse(localStorage.getItem('sent_req_' + user) || '[]');
  const reqs    = JSON.parse(localStorage.getItem('requests_' + user) || '[]');
  const results = document.getElementById('user-search-results');

  if (!query) { results.innerHTML = ''; return; }

  const matches = Object.keys(users).filter(u =>
    u !== user && u.toLowerCase().includes(query)
  );

  results.innerHTML = matches.length
    ? matches.map(u => {
        const p       = users[u];
        const isFriend = friends.includes(u);
        const sentReq  = sent.includes(u);
        const inReqs   = reqs.includes(u);
        let btn;
        if (isFriend)  btn = '<button class="btn-sm" disabled>Friends</button>';
        else if (inReqs) btn = '<button class="btn-sm" onclick="acceptRequest(\'' + u + '\')">Accept</button>';
        else if (sentReq) btn = '<button class="btn-sm" disabled>Requested</button>';
        else           btn = '<button class="btn-sm" onclick="sendFriendRequest(\'' + u + '\')">+ Add</button>';
        return '<div class="user-row">' +
          '<img class="user-row-avatar" src="' + (p.avatar || 'assets/default-avatar.svg') + '">' +
          '<div class="user-row-info"><span class="user-row-name">' + u + '</span>' +
          '<span class="user-row-sub">' + (p.bio ? p.bio.slice(0,40) : 'No bio') + '</span></div>' +
          btn + '</div>';
      }).join('')
    : '<p class="empty-hint">No users found.</p>';
}

function sendFriendRequest(to) {
  const user = currentUser();
  // Add to target's requests
  const reqs = JSON.parse(localStorage.getItem('requests_' + to) || '[]');
  if (!reqs.includes(user)) { reqs.push(user); localStorage.setItem('requests_' + to, JSON.stringify(reqs)); }
  // Track sent
  const sent = JSON.parse(localStorage.getItem('sent_req_' + user) || '[]');
  if (!sent.includes(to))   { sent.push(to);   localStorage.setItem('sent_req_' + user, JSON.stringify(sent)); }

  pushNotif(to, user + ' sent you a friend request');
  refreshNotifBadge(to);
  searchUsers();
  showToast('Friend request sent to ' + to, 'success');
  addActivity('Sent friend request to ' + to);
}

function acceptRequest(from) {
  const user = currentUser();
  // Add to each other's friends
  _addFriend(user, from);
  _addFriend(from, user);
  // Remove from requests
  _removeRequest(user, from);
  // Remove from sender's sent list
  const sent = JSON.parse(localStorage.getItem('sent_req_' + from) || '[]');
  localStorage.setItem('sent_req_' + from, JSON.stringify(sent.filter(x => x !== user)));

  pushNotif(from, user + ' accepted your friend request');
  renderFriendsPage();
  renderDashboard();
  showToast(from + ' is now your friend!', 'success');
  addActivity('Became friends with ' + from);
}

function declineRequest(from) {
  _removeRequest(currentUser(), from);
  renderFriendsPage();
  showToast('Request declined', '');
}

function removeFriend(target) {
  if (!confirm('Remove ' + target + ' from friends?')) return;
  const user = currentUser();
  _removeFriend(user, target);
  _removeFriend(target, user);
  renderFriendsPage();
  renderDashboard();
  showToast(target + ' removed', '');
  addActivity('Removed friend ' + target);
}

function _addFriend(a, b) {
  const list = JSON.parse(localStorage.getItem('friends_' + a) || '[]');
  if (!list.includes(b)) { list.push(b); localStorage.setItem('friends_' + a, JSON.stringify(list)); }
}
function _removeFriend(a, b) {
  const list = JSON.parse(localStorage.getItem('friends_' + a) || '[]');
  localStorage.setItem('friends_' + a, JSON.stringify(list.filter(x => x !== b)));
}
function _removeRequest(user, from) {
  const reqs = JSON.parse(localStorage.getItem('requests_' + user) || '[]');
  localStorage.setItem('requests_' + user, JSON.stringify(reqs.filter(x => x !== from)));
  refreshNotifBadge(user);
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  CHAT                                                        ║
// ╚══════════════════════════════════════════════════════════════╝

let _activeChatPartner = null;

function renderChatContacts() {
  const user    = currentUser();
  const friends = JSON.parse(localStorage.getItem('friends_' + user) || '[]');
  const users   = getUsers();
  const list    = document.getElementById('chat-contact-list');

  list.innerHTML = friends.length
    ? friends.map(f => {
        const msgs    = JSON.parse(localStorage.getItem(_chatKey(user, f)) || '[]');
        const last    = msgs[msgs.length - 1];
        const profile = users[f] || {};
        const online  = profile.online !== false;
        return '<div class="contact-row ' + (f === _activeChatPartner ? 'active-contact' : '') + '" onclick="openChat(\'' + f + '\')">' +
          '<div class="contact-avatar-wrap">' +
            '<img class="contact-avatar" src="' + (profile.avatar || 'assets/default-avatar.svg') + '">' +
            '<span class="contact-online-dot ' + (online ? 'online' : '') + '"></span>' +
          '</div>' +
          '<div class="contact-info">' +
            '<span class="contact-name">' + f + '</span>' +
            '<span class="contact-last">' + (last ? last.text.slice(0,28) + (last.text.length > 28 ? '…' : '') : 'No messages yet') + '</span>' +
          '</div>' +
        '</div>';
      }).join('')
    : '<p class="empty-hint" style="padding:16px">Add friends to start chatting.</p>';
}

function filterChats(q) {
  const rows = document.querySelectorAll('.contact-row');
  rows.forEach(r => {
    const name = r.querySelector('.contact-name').textContent.toLowerCase();
    r.style.display = name.includes(q.toLowerCase()) ? '' : 'none';
  });
}

function openChat(partner) {
  _activeChatPartner = partner;
  const users = getUsers();
  const p     = users[partner] || {};

  document.getElementById('chat-empty').classList.add('hidden');
  document.getElementById('chat-window').classList.remove('hidden');

  document.getElementById('chat-header').innerHTML =
    '<img class="contact-avatar" src="' + (p.avatar || 'assets/default-avatar.svg') + '">' +
    '<div><span class="contact-name">' + partner + '</span>' +
    '<span class="contact-sub ' + (p.online !== false ? 'online' : '') + '">' +
    (p.online !== false ? '● Online' : '○ Offline') + '</span></div>';

  renderMessages();
  renderChatContacts();
  document.getElementById('chat-input').focus();

  // Also open chat page if not already there
  openPage('page-chat');
}

function renderMessages() {
  const user = currentUser();
  const msgs = JSON.parse(localStorage.getItem(_chatKey(user, _activeChatPartner)) || '[]');
  const box  = document.getElementById('chat-messages');

  box.innerHTML = msgs.map(m =>
    '<div class="msg-bubble ' + (m.from === user ? 'mine' : 'theirs') + '">' +
      '<span class="msg-text">' + _escHtml(m.text) + '</span>' +
      '<span class="msg-time">' + m.time + '</span>' +
    '</div>'
  ).join('');

  box.scrollTop = box.scrollHeight;
}

function sendMessage() {
  const input   = document.getElementById('chat-input');
  const text    = input.value.trim();
  if (!text || !_activeChatPartner) return;

  const user    = currentUser();
  const key     = _chatKey(user, _activeChatPartner);
  const msgs    = JSON.parse(localStorage.getItem(key) || '[]');
  msgs.push({ from: user, text, time: _now() });
  localStorage.setItem(key, JSON.stringify(msgs));

  // Mirror to the partner's perspective (same sorted key)
  input.value = '';
  renderMessages();
  renderChatContacts();
  pushNotif(_activeChatPartner, user + ': ' + text.slice(0, 50));
  addActivity('Sent a message to ' + _activeChatPartner);
}

/** Canonical chat key: always sorted alphabetically so both users share one thread */
function _chatKey(a, b) {
  return 'chat_' + [a, b].sort().join('_');
}

function _escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  ACTIVITY FEED                                               ║
// ╚══════════════════════════════════════════════════════════════╝

function postFeed() {
  const input = document.getElementById('feed-input');
  const mood  = document.getElementById('feed-mood');
  const text  = input.value.trim();
  if (!text) return;

  const user  = currentUser();
  const key   = 'feed_' + user;
  const posts = JSON.parse(localStorage.getItem(key) || '[]');
  posts.unshift({ id: Date.now(), text, mood: mood.value, time: _now() });
  if (posts.length > 50) posts.pop();
  localStorage.setItem(key, JSON.stringify(posts));

  input.value = '';
  mood.value  = '';
  renderFeed();
  addActivity('Posted to feed');
  showToast('Posted!', 'success');
}

function renderFeed() {
  const user    = currentUser();
  const users   = getUsers();
  const friends = JSON.parse(localStorage.getItem('friends_' + user) || '[]');
  const sources = [user, ...friends];
  const list    = document.getElementById('feed-list');

  // Gather all posts from self + friends, sort by id (newest first)
  let all = [];
  sources.forEach(u => {
    const posts = JSON.parse(localStorage.getItem('feed_' + u) || '[]');
    const p     = users[u] || {};
    posts.forEach(post => all.push({ ...post, author: u, avatar: p.avatar || 'assets/default-avatar.svg' }));
  });
  all.sort((a, b) => b.id - a.id);

  list.innerHTML = all.length
    ? all.map(post =>
        '<div class="feed-post">' +
          '<img class="feed-avatar" src="' + post.avatar + '" alt="">' +
          '<div class="feed-body">' +
            '<div class="feed-meta">' +
              '<span class="feed-author">' + post.author + '</span>' +
              (post.mood ? '<span class="feed-mood">' + post.mood + '</span>' : '') +
              '<span class="feed-time">' + post.time + '</span>' +
              (post.author === user ? '<button class="feed-delete" onclick="deleteFeedPost(' + post.id + ')">✕</button>' : '') +
            '</div>' +
            '<p class="feed-text">' + _escHtml(post.text) + '</p>' +
          '</div>' +
        '</div>'
      ).join('')
    : '<div class="feed-empty">Nothing here yet. Post something or add friends!</div>';
}

function deleteFeedPost(id) {
  const user  = currentUser();
  const key   = 'feed_' + user;
  const posts = JSON.parse(localStorage.getItem(key) || '[]').filter(p => p.id !== id);
  localStorage.setItem(key, JSON.stringify(posts));
  renderFeed();
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  NOTIFICATIONS                                               ║
// ╚══════════════════════════════════════════════════════════════╝

function renderNotifications() {
  const user  = currentUser();
  const key   = 'notifs_' + user;
  const list  = JSON.parse(localStorage.getItem(key) || '[]');
  const el    = document.getElementById('notifications-list');

  // Mark all as read
  list.forEach(n => n.read = true);
  localStorage.setItem(key, JSON.stringify(list));
  refreshNotifBadge(user);

  el.innerHTML = list.length
    ? list.map(n =>
        '<div class="notif-item">' +
          '<div class="notif-dot"></div>' +
          '<span class="notif-text">' + n.text + '</span>' +
          '<span class="notif-time">' + n.time + '</span>' +
        '</div>'
      ).join('')
    : '<div class="notif-empty">No notifications yet.</div>';
}

function clearNotifications() {
  const user = currentUser();
  localStorage.setItem('notifs_' + user, '[]');
  refreshNotifBadge(user);
  renderNotifications();
  showToast('Notifications cleared', '');
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  NOTES                                                       ║
// ╚══════════════════════════════════════════════════════════════╝

let _activeNoteId = null;

function getNotes() {
  return JSON.parse(localStorage.getItem('notes_' + currentUser()) || '[]');
}
function saveNotes(notes) {
  localStorage.setItem('notes_' + currentUser(), JSON.stringify(notes));
}

function renderNotesList() {
  const notes = getNotes();
  const list  = document.getElementById('notes-list');
  list.innerHTML = notes.length
    ? notes.map(n =>
        '<div class="note-row ' + (n.id === _activeNoteId ? 'active-note' : '') + '" onclick="openNote(' + n.id + ')">' +
          '<span class="note-row-title">' + (n.title || 'Untitled') + '</span>' +
          '<span class="note-row-preview">' + (n.body || '').slice(0, 40) + '</span>' +
        '</div>'
      ).join('')
    : '<p class="empty-hint" style="padding:16px">No notes yet. Hit "+ New Note".</p>';
}

function newNote() {
  const notes = getNotes();
  const note  = { id: Date.now(), title: '', body: '', updatedAt: Date.now() };
  notes.unshift(note);
  saveNotes(notes);
  openNote(note.id);
  renderNotesList();
  renderDashboard();
}

function openNote(id) {
  _activeNoteId = id;
  const note = getNotes().find(n => n.id === id);
  if (!note) return;

  document.getElementById('note-editor-empty').classList.add('hidden');
  document.getElementById('note-editor-active').classList.remove('hidden');
  document.getElementById('note-title-input').value = note.title;
  document.getElementById('note-body-input').value  = note.body;
  document.getElementById('note-saved-indicator').textContent = '';
  renderNotesList();
}

function saveNote() {
  if (!_activeNoteId) return;
  const title = document.getElementById('note-title-input').value.trim();
  const body  = document.getElementById('note-body-input').value;
  const notes = getNotes().map(n =>
    n.id === _activeNoteId ? { ...n, title, body, updatedAt: Date.now() } : n
  );
  saveNotes(notes);
  renderNotesList();
  renderDashboard();
  document.getElementById('note-saved-indicator').textContent = '✓ Saved';
  setTimeout(() => {
    const el = document.getElementById('note-saved-indicator');
    if (el) el.textContent = '';
  }, 2000);
}

function deleteNote() {
  if (!_activeNoteId || !confirm('Delete this note?')) return;
  saveNotes(getNotes().filter(n => n.id !== _activeNoteId));
  _activeNoteId = null;
  document.getElementById('note-editor-empty').classList.remove('hidden');
  document.getElementById('note-editor-active').classList.add('hidden');
  renderNotesList();
  renderDashboard();
  showToast('Note deleted', '');
}

// Auto-save on typing (debounced)
let _noteSaveTimer = null;
document.addEventListener('input', e => {
  if (e.target.id === 'note-title-input' || e.target.id === 'note-body-input') {
    clearTimeout(_noteSaveTimer);
    _noteSaveTimer = setTimeout(saveNote, 1200);
  }
});
