/* ================================================================
   pages/social.js — SOCIAL FEATURES  (Supabase edition)
   Friends, Chat, Feed, Notifications, Notes.
================================================================ */

// ╔══════════════════════════════════════════════════════════════╗
// ║  FRIENDS                                                     ║
// ╚══════════════════════════════════════════════════════════════╝

async function renderFriendsPage() {
  const user    = currentUser();
  const friends = await dbGetFriends(user);
  const reqs    = await dbGetFriendRequests(user);

  // Build a quick profile map for display
  const allUsers = await Promise.all([...friends, ...reqs].map(u => getProfile(u)));
  const profileMap = {};
  allUsers.forEach(p => { if (p) profileMap[p.username] = p; });

  const fList = document.getElementById('friends-list');
  setText('friends-count', friends.length);
  fList.innerHTML = friends.length
    ? friends.map(f => {
        const p = profileMap[f] || {};
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

  const rList = document.getElementById('friend-requests-list');
  setText('req-count', reqs.length);
  rList.innerHTML = reqs.length
    ? reqs.map(r =>
        '<div class="user-row">' +
          '<img class="user-row-avatar" src="' + ((profileMap[r] || {}).avatar || 'assets/default-avatar.svg') + '">' +
          '<div class="user-row-info"><span class="user-row-name">' + r + '</span></div>' +
          '<button class="btn-sm" onclick="acceptRequest(\'' + r + '\')">Accept</button>' +
          '<button class="btn-sm danger-outline" onclick="declineRequest(\'' + r + '\')">Decline</button>' +
        '</div>'
      ).join('')
    : '<p class="empty-hint">No pending requests.</p>';

  document.getElementById('user-search-results').innerHTML = '';
  document.getElementById('friend-search').value = '';
}

async function searchUsers() {
  const query   = document.getElementById('friend-search').value.trim().toLowerCase();
  const user    = currentUser();
  const results = document.getElementById('user-search-results');
  if (!query) { results.innerHTML = ''; return; }

  const { data } = await db.from('profiles').select('username, avatar, bio, online')
    .ilike('username', '%' + query + '%').neq('username', user).limit(20);

  const friends = await dbGetFriends(user);
  const reqs    = await dbGetFriendRequests(user);

  results.innerHTML = (data && data.length)
    ? data.map(u => {
        const isFriend  = friends.includes(u.username);
        const inReqs    = reqs.includes(u.username);
        let sentBtn;
        // Check sent async would be slow; optimistic UI — show Add unless already friend/request
        if (isFriend)   sentBtn = '<button class="btn-sm" disabled>Friends</button>';
        else if (inReqs) sentBtn = '<button class="btn-sm" onclick="acceptRequest(\'' + u.username + '\')">Accept</button>';
        else            sentBtn = '<button class="btn-sm" onclick="sendFriendRequest(\'' + u.username + '\')">+ Add</button>';
        return '<div class="user-row">' +
          '<img class="user-row-avatar" src="' + (u.avatar || 'assets/default-avatar.svg') + '">' +
          '<div class="user-row-info"><span class="user-row-name">' + u.username + '</span>' +
          '<span class="user-row-sub">' + (u.bio ? u.bio.slice(0,40) : 'No bio') + '</span></div>' +
          sentBtn + '</div>';
      }).join('')
    : '<p class="empty-hint">No users found.</p>';
}

async function sendFriendRequest(to) {
  const user = currentUser();
  await dbSendFriendRequest(user, to);
  await pushNotif(to, user + ' sent you a friend request');
  await searchUsers();
  showToast('Friend request sent to ' + to, 'success');
  await addActivity('Sent friend request to ' + to);
}

async function acceptRequest(from) {
  const user = currentUser();
  await dbAddFriend(user, from);
  await dbRemoveFriendRequest(from, user);
  await pushNotif(from, user + ' accepted your friend request');
  await renderFriendsPage();
  await renderDashboard();
  showToast(from + ' is now your friend!', 'success');
  await addActivity('Became friends with ' + from);
}

async function declineRequest(from) {
  await dbRemoveFriendRequest(from, currentUser());
  await renderFriendsPage();
  showToast('Request declined', '');
}

async function removeFriend(target) {
  if (!confirm('Remove ' + target + ' from friends?')) return;
  const user = currentUser();
  await dbRemoveFriend(user, target);
  await renderFriendsPage();
  await renderDashboard();
  showToast(target + ' removed', '');
  await addActivity('Removed friend ' + target);
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  CHAT                                                        ║
// ╚══════════════════════════════════════════════════════════════╝

let _activeChatPartner = null;

async function renderChatContacts() {
  const user    = currentUser();
  const friends = await dbGetFriends(user);
  const list    = document.getElementById('chat-contact-list');

  if (!friends.length) {
    list.innerHTML = '<p class="empty-hint" style="padding:16px">Add friends to start chatting.</p>';
    return;
  }

  const profiles = await Promise.all(friends.map(f => getProfile(f)));
  const profileMap = {};
  profiles.forEach(p => { if (p) profileMap[p.username] = p; });

  // Get last message for each friend
  const rows = await Promise.all(friends.map(async f => {
    const msgs = await dbGetMessages(user, f);
    const last = msgs[msgs.length - 1];
    const p    = profileMap[f] || {};
    const online = p.online !== false;
    return '<div class="contact-row ' + (f === _activeChatPartner ? 'active-contact' : '') + '" onclick="openChat(\'' + f + '\')">' +
      '<div class="contact-avatar-wrap">' +
        '<img class="contact-avatar" src="' + (p.avatar || 'assets/default-avatar.svg') + '">' +
        '<span class="contact-online-dot ' + (online ? 'online' : '') + '"></span>' +
      '</div>' +
      '<div class="contact-info">' +
        '<span class="contact-name">' + f + '</span>' +
        '<span class="contact-last">' + (last ? last.text.slice(0,28) + (last.text.length > 28 ? '…' : '') : 'No messages yet') + '</span>' +
      '</div>' +
    '</div>';
  }));
  list.innerHTML = rows.join('');
}

function filterChats(q) {
  document.querySelectorAll('.contact-row').forEach(r => {
    const name = r.querySelector('.contact-name').textContent.toLowerCase();
    r.style.display = name.includes(q.toLowerCase()) ? '' : 'none';
  });
}

async function openChat(partner) {
  _activeChatPartner = partner;
  const p = await getProfile(partner) || {};

  document.getElementById('chat-empty').classList.add('hidden');
  document.getElementById('chat-window').classList.remove('hidden');

  document.getElementById('chat-header').innerHTML =
    '<img style="width:34px;height:34px;border-radius:50%;object-fit:cover" src="' + (p.avatar || 'assets/default-avatar.svg') + '">' +
    '<div>' +
      '<div style="font-weight:600;font-size:14px">' + partner + '</div>' +
      '<div style="font-size:12px;color:var(--text3)">' + (p.online !== false ? '● Online' : '○ Offline') + '</div>' +
    '</div>';

  await renderMessages();
  await renderChatContacts();
}

async function renderMessages() {
  if (!_activeChatPartner) return;
  const user = currentUser();
  const msgs = await dbGetMessages(user, _activeChatPartner);
  const box  = document.getElementById('chat-messages');
  box.innerHTML = msgs.map(m =>
    '<div class="msg-bubble ' + (m.sender === user ? 'mine' : 'theirs') + '">' +
      _escHtml(m.text) +
      '<span class="msg-time">' + _fmtTime(m.created_at) + '</span>' +
    '</div>'
  ).join('');
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text || !_activeChatPartner) return;
  const user = currentUser();
  await dbSendMessage(user, _activeChatPartner, text);
  input.value = '';
  await renderMessages();
  await renderChatContacts();
  await pushNotif(_activeChatPartner, user + ': ' + text.slice(0, 50));
  await addActivity('Sent a message to ' + _activeChatPartner);
}

function _escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  ACTIVITY FEED                                               ║
// ╚══════════════════════════════════════════════════════════════╝

async function postFeed() {
  const input = document.getElementById('feed-input');
  const mood  = document.getElementById('feed-mood');
  const text  = input.value.trim();
  if (!text) return;
  const user = currentUser();
  await dbPostFeed(user, text, mood.value);
  input.value = ''; mood.value = '';
  await renderFeed();
  await addActivity('Posted to feed');
  showToast('Posted!', 'success');
}

async function renderFeed() {
  const user    = currentUser();
  const friends = await dbGetFriends(user);
  const sources = [user, ...friends];
  const list    = document.getElementById('feed-list');

  const posts = await dbGetFeed(sources);

  list.innerHTML = posts.length
    ? posts.map(post => {
        const avatar = (post.profiles && post.profiles.avatar) || 'assets/default-avatar.svg';
        return '<div class="feed-post">' +
          '<img class="feed-avatar" src="' + avatar + '" alt="">' +
          '<div class="feed-body">' +
            '<div class="feed-meta">' +
              '<span class="feed-author">' + post.username + '</span>' +
              (post.mood ? '<span class="feed-mood">' + post.mood + '</span>' : '') +
              '<span class="feed-time">' + _fmtTime(post.created_at) + '</span>' +
              (post.username === user ? '<button class="feed-delete" onclick="deleteFeedPost(\'' + post.id + '\')">✕</button>' : '') +
            '</div>' +
            '<p class="feed-text">' + _escHtml(post.text) + '</p>' +
          '</div>' +
        '</div>';
      }).join('')
    : '<div class="feed-empty">Nothing here yet. Post something or add friends!</div>';
}

async function deleteFeedPost(id) {
  await dbDeleteFeedPost(id);
  await renderFeed();
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  NOTIFICATIONS                                               ║
// ╚══════════════════════════════════════════════════════════════╝

async function renderNotifications() {
  const user = currentUser();
  const list = await dbGetNotifs(user);
  const el   = document.getElementById('notifications-list');

  await dbMarkNotifsRead(user);
  await refreshNotifBadge(user);

  el.innerHTML = list.length
    ? list.map(n =>
        '<div class="notif-item">' +
          '<div class="notif-dot"></div>' +
          '<span class="notif-text">' + n.text + '</span>' +
          '<span class="notif-time">' + _fmtTime(n.created_at) + '</span>' +
        '</div>'
      ).join('')
    : '<div class="notif-empty">No notifications yet.</div>';
}

async function clearNotifications() {
  const user = currentUser();
  await dbClearNotifs(user);
  await refreshNotifBadge(user);
  await renderNotifications();
  showToast('Notifications cleared', '');
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  NOTES                                                       ║
// ╚══════════════════════════════════════════════════════════════╝

let _activeNoteId = null;

async function renderNotesList() {
  const notes = await dbGetNotes(currentUser());
  const list  = document.getElementById('notes-list');
  list.innerHTML = notes.length
    ? notes.map(n =>
        '<div class="note-row ' + (n.id === _activeNoteId ? 'active-note' : '') + '" onclick="openNote(\'' + n.id + '\')">' +
          '<span class="note-row-title">' + (n.title || 'Untitled') + '</span>' +
          '<span class="note-row-preview">' + (n.body || '').slice(0, 40) + '</span>' +
        '</div>'
      ).join('')
    : '<p class="empty-hint" style="padding:16px">No notes yet. Hit "+ New Note".</p>';
}

async function newNote() {
  const note = await dbCreateNote(currentUser());
  if (!note) return;
  _activeNoteId = note.id;
  await openNote(note.id);
  await renderNotesList();
  await renderDashboard();
}

async function openNote(id) {
  _activeNoteId = id;
  const notes = await dbGetNotes(currentUser());
  const note  = notes.find(n => n.id === id);
  if (!note) return;

  document.getElementById('note-editor-empty').classList.add('hidden');
  document.getElementById('note-editor-active').classList.remove('hidden');
  document.getElementById('note-title-input').value = note.title;
  document.getElementById('note-body-input').value  = note.body;
  document.getElementById('note-saved-indicator').textContent = '';
  await renderNotesList();
}

async function saveNote() {
  if (!_activeNoteId) return;
  const title = document.getElementById('note-title-input').value.trim();
  const body  = document.getElementById('note-body-input').value;
  await dbSaveNote(_activeNoteId, title, body);
  await renderNotesList();
  await renderDashboard();
  document.getElementById('note-saved-indicator').textContent = '✓ Saved';
  setTimeout(() => { const el = document.getElementById('note-saved-indicator'); if (el) el.textContent = ''; }, 2000);
}

async function deleteNote() {
  if (!_activeNoteId || !confirm('Delete this note?')) return;
  await dbDeleteNote(_activeNoteId);
  _activeNoteId = null;
  document.getElementById('note-editor-empty').classList.remove('hidden');
  document.getElementById('note-editor-active').classList.add('hidden');
  await renderNotesList();
  await renderDashboard();
  showToast('Note deleted', '');
}

let _noteSaveTimer = null;
document.addEventListener('input', e => {
  if (e.target.id === 'note-title-input' || e.target.id === 'note-body-input') {
    clearTimeout(_noteSaveTimer);
    _noteSaveTimer = setTimeout(saveNote, 1200);
  }
});
