/* ================================================================
   pages/auth.js — AUTH
   Login, signup, logout, toggle mode, password visibility.
   Depends on: script.js
================================================================ */

let loginMode = true;

// ── TOGGLE MODE ───────────────────────────────────────────────
function toggleMode() {
  loginMode = !loginMode;
  document.getElementById('form-title').textContent    = loginMode ? 'Welcome back'            : 'Create account';
  document.getElementById('form-sub').textContent      = loginMode ? 'Sign in to your account' : 'Join in seconds';
  document.getElementById('btn-text').textContent      = loginMode ? 'Sign In'                 : 'Sign Up';
  document.getElementById('switch-text').textContent   = loginMode ? 'New here?'               : 'Have an account?';
  document.getElementById('switch-action').textContent = loginMode ? 'Create account'          : 'Sign in';
  document.getElementById('auth-msg').textContent = '';
  document.getElementById('auth-msg').className   = 'auth-msg';
}

// ── PASSWORD VISIBILITY ───────────────────────────────────────
function togglePw() {
  const pw = document.getElementById('inp-password');
  const ic = document.getElementById('toggle-pw');
  pw.type     = pw.type === 'password' ? 'text' : 'password';
  ic.textContent = pw.type === 'password' ? '👁' : '🔒';
}

// ── FORM SUBMIT ───────────────────────────────────────────────
function submitForm() {
  const username = document.getElementById('inp-username').value.trim();
  const password = document.getElementById('inp-password').value.trim();
  const msg      = document.getElementById('auth-msg');
  const users    = getUsers();

  const setMsg = (text, ok = false) => {
    msg.textContent = text;
    msg.className   = 'auth-msg' + (ok ? ' ok' : '');
  };

  if (username.length < 4 || username.length > 20) return setMsg('Username must be 4–20 characters.');
  if (password.length < 6)                          return setMsg('Password must be at least 6 characters.');

  if (loginMode) {
    if (!users[username])                      return setMsg('User not found.');
    if (users[username].password !== password) return setMsg('Wrong password.');
    login(username);
  } else {
    if (users[username]) return setMsg('Username already taken.');
    users[username] = {
      password,
      avatar    : '',
      banner    : '',
      bio       : '',
      statusMsg : '',
      socials   : { twitter: '', github: '', website: '' },
      badges    : [],
      online    : true,
      createdAt : Date.now()
    };
    saveUsers(users);
    setMsg('Account created! Signing you in…', true);
    setTimeout(() => login(username), 700);
  }
}

// ── LOGIN ─────────────────────────────────────────────────────
function login(username) {
  localStorage.setItem('currentUser', username);

  const key      = 'sessions_' + username;
  const sessions = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, sessions);

  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-shell').classList.add('active');

  refreshUI(username);
  openPage('page-dashboard');
  addActivity('Signed in');
}

// ── LOGOUT ────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('currentUser');
  location.reload();
}
