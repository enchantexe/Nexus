/* ================================================================
   pages/auth.js — AUTH  (Supabase edition)
================================================================ */

let loginMode = true;

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

function togglePw() {
  const pw = document.getElementById('inp-password');
  const ic = document.getElementById('toggle-pw');
  pw.type        = pw.type === 'password' ? 'text' : 'password';
  ic.textContent = pw.type === 'password' ? '👁' : '🔒';
}

async function submitForm() {
  const username = document.getElementById('inp-username').value.trim();
  const password = document.getElementById('inp-password').value.trim();
  const msg      = document.getElementById('auth-msg');
  const btn      = document.getElementById('btn-text');

  const setMsg = (text, ok = false) => {
    msg.textContent = text;
    msg.className   = 'auth-msg' + (ok ? ' ok' : '');
  };

  if (username.length < 4 || username.length > 20) return setMsg('Username must be 4–20 characters.');
  if (password.length < 6)                          return setMsg('Password must be at least 6 characters.');

  btn.textContent = '…';

  if (loginMode) {
    const user = await checkLogin(username, password);
    if (!user) { btn.textContent = 'Sign In'; return setMsg('Wrong username or password.'); }
    await login(username);
  } else {
    const exists = await userExists(username);
    if (exists) { btn.textContent = 'Sign Up'; return setMsg('Username already taken.'); }
    const ok = await createUser(username, password);
    if (!ok) { btn.textContent = 'Sign Up'; return setMsg('Could not create account. Try again.'); }
    setMsg('Account created! Signing you in…', true);
    setTimeout(() => login(username), 700);
  }
}

async function login(username) {
  localStorage.setItem('currentUser', username);
  bumpSession(username);

  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-shell').classList.add('active');

  await refreshUI(username);
  await openPage('page-dashboard');
  await dbAddActivity(username, 'Signed in');
}

function logout() {
  localStorage.removeItem('currentUser');
  location.reload();
}
