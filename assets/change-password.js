// Change-password page logic (EXT10, U39/M5: moved out of change-password.html so
// the page's Content-Security-Policy no longer needs 'unsafe-inline' for scripts).
(function(){
  if (window.__sbLoadFailed || !window.supabase) {
    document.getElementById('scriptError').style.display = 'block';
    document.getElementById('scriptError').textContent =
      "This page couldn't load a required file. Check your internet connection and reload the page.";
    document.getElementById('loginStep').style.display = 'block';
    return;
  }

  const SUPABASE_URL = "https://uizrazyehilyzmwttsrn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_n0sEzZK0JMtwgk280a3YXA_zxtnheqj";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // A second, non-persistent client used only to re-check the current password
  // without disturbing the real logged-in session.
  const verifyOnly = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'he_password_check_only',
      lock: (name, acquireTimeout, fn) => fn(),
    },
  });

  const loginStep = document.getElementById('loginStep');
  const changeStep = document.getElementById('changeStep');
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginMsg = document.getElementById('loginMsg');
  const changeForm = document.getElementById('changeForm');
  const changeBtn = document.getElementById('changeBtn');
  const changeMsg = document.getElementById('changeMsg');
  const whoLine = document.getElementById('whoLine');
  const successBox = document.getElementById('successBox');
  const signOutBtn = document.getElementById('signOutBtn');

  let isRecovery = false;
  let changeStepShown = false;

  function showLoginStep(){
    if (changeStepShown) return; // never downgrade out of an already-shown recovery/change step
    loginStep.style.display = 'block';
    changeStep.style.display = 'none';
  }
  function showChangeStep(user, recovery){
    isRecovery = !!recovery;
    changeStepShown = true;
    loginStep.style.display = 'none';
    changeStep.style.display = 'block';
    whoLine.textContent = 'Signed in as ' + (user && user.email ? user.email : 'unknown account');
    document.getElementById('currentPasswordRow').style.display = isRecovery ? 'none' : 'block';
    document.getElementById('changeTitle').textContent = isRecovery ? 'Reset Your Password' : 'Change Password';
    document.getElementById('changeSubtitle').textContent = isRecovery
      ? 'Choose a new password for your account.'
      : 'Set a new password for your account';
  }

  // Fires when this page was opened from a "forgot password" email link —
  // Supabase reads the recovery token out of the URL and signs the person in
  // just enough to set a new password, without them needing to know the old one.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session && session.user) {
      showChangeStep(session.user, true);
    }
  });

  // On load: if already signed in (session persists across pages on this site,
  // or was just established by the recovery link above), skip straight to the
  // change-password form.
  supabase.auth.getSession().then(({ data }) => {
    if (changeStepShown) return;
    if (data && data.session && data.session.user) {
      showChangeStep(data.session.user, false);
    } else {
      showLoginStep();
    }
  }).catch(() => { showLoginStep(); });

  loginForm.addEventListener('submit', async function(e){
    e.preventDefault();
    loginMsg.textContent = '';
    loginMsg.className = 'msg';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in…';

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    loginBtn.disabled = false;
    loginBtn.textContent = 'Log In';

    if (error || !data || !data.user) {
      loginMsg.textContent = 'Could not log in. Check your email and password and try again.';
      loginMsg.className = 'msg error';
      return;
    }

    showChangeStep(data.user, false);
  });

  changeForm.addEventListener('submit', async function(e){
    e.preventDefault();
    changeMsg.textContent = '';
    changeMsg.className = 'msg';
    successBox.style.display = 'none';

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user || !user.email) {
      changeMsg.textContent = 'Your session expired. Please log in again.';
      changeMsg.className = 'msg error';
      showLoginStep();
      return;
    }

    if (!isRecovery && !currentPassword) {
      changeMsg.textContent = 'Enter your current password.';
      changeMsg.className = 'msg error';
      return;
    }
    if (newPassword.length < 8) {
      changeMsg.textContent = 'New password must be at least 8 characters.';
      changeMsg.className = 'msg error';
      return;
    }
    if (newPassword !== confirmPassword) {
      changeMsg.textContent = 'New password and confirmation do not match.';
      changeMsg.className = 'msg error';
      return;
    }

    changeBtn.disabled = true;

    if (!isRecovery) {
      changeBtn.textContent = 'Checking current password…';

      // Verify the current password is correct before allowing the change,
      // without touching the real logged-in session.
      const { error: verifyError } = await verifyOnly.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      try { await verifyOnly.auth.signOut({ scope: 'local' }); } catch (e) { /* ignore */ }

      if (verifyError) {
        changeBtn.disabled = false;
        changeBtn.textContent = 'Change Password';
        changeMsg.textContent = 'Current password is incorrect.';
        changeMsg.className = 'msg error';
        return;
      }
    }
    // In a recovery flow, the emailed link itself already proved this is the
    // account owner — no need to also ask for a password they've forgotten.

    changeBtn.textContent = 'Saving new password…';

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    changeBtn.disabled = false;
    changeBtn.textContent = 'Change Password';

    if (updateError) {
      changeMsg.textContent = 'Something went wrong saving your new password. Please try again.';
      changeMsg.className = 'msg error';
      return;
    }

    changeForm.reset();
    successBox.style.display = 'block';
    successBox.textContent = isRecovery
      ? 'Your password has been set. Use it to log in from now on.'
      : 'Your password has been changed. Use your new password next time you log in.';
    changeMsg.textContent = '';
  });

  signOutBtn.addEventListener('click', async function(){
    try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
    showLoginStep();
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
  });
})();
