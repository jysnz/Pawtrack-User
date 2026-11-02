/**
 * PawTrack Admin Main Controller & Navigation Engine
 * High-performance SPA routing, command palette (Ctrl+K), slideout drawers, and reactive listeners
 */

class AdminApp {
  constructor() {
    this.currentRoute = 'activation';
    this.init();
  }

  init() {
    this.initSeenTracking();
    this.initAdminGate();
    this.initUserMenu();
    this.initEventListeners();
    this.initCommandPalette();
    this.initKeyboardShortcuts();
    this.handleRoute();

    // Subscribe to store updates
    window.adminStore.subscribe((store, reason) => {
      this.renderView(this.currentRoute);
      this.updateSidebarBadges();
      this.updateSyncIndicator();
      if (reason === 'cross_tab_sync' || reason === 'broadcast_sync') {
        this.showToast('Data synchronized live with PawTrack Hub', 'info', 1800);
      }
    });

    this.updateSidebarBadges();
    this.updateSyncIndicator();
    this.initWorkspaceSelector();
    this.initSidebarToggle();
  }

  initWorkspaceSelector() {
    const wsTrigger = document.getElementById('workspace-selector');
    const wsDropdown = document.getElementById('workspace-dropdown');
    const wsLabel = document.getElementById('workspace-selector-label');
    const jurisdictionLabel = document.querySelector('.admin-dropdown-jurisdiction');
    const addJurisdictionBtn = document.getElementById('btn-add-jurisdiction');

    if (!wsTrigger || !wsDropdown) return;

    // Load persisted workspace or default
    const savedWs = localStorage.getItem('pawtrack_active_jurisdiction') || 'pawtrack-metro-manila';
    this.selectedJurisdiction = savedWs;

    // Apply active state on initial load
    const activeBtn = wsDropdown.querySelector(`.workspace-option-btn[data-workspace="${savedWs}"]`);
    if (activeBtn) {
      wsDropdown.querySelectorAll('.workspace-option-btn').forEach(b => b.classList.remove('active'));
      activeBtn.classList.add('active');
      if (wsLabel) wsLabel.textContent = activeBtn.getAttribute('data-name') || savedWs;
      if (jurisdictionLabel) {
        jurisdictionLabel.textContent = activeBtn.getAttribute('data-name') || 'Metro Manila (NCR)';
      }
    }

    // Toggle dropdown
    wsTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('admin-user-dropdown')?.classList.remove('open');
      const isOpen = wsDropdown.classList.toggle('open');
      wsTrigger.classList.toggle('active', isOpen);
      wsTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Keyboard support (Enter/Space on chip)
    wsTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        wsTrigger.click();
      } else if (e.key === 'Escape') {
        wsDropdown.classList.remove('open');
        wsTrigger.classList.remove('active');
        wsTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wsDropdown.contains(e.target) && !wsTrigger.contains(e.target)) {
        wsDropdown.classList.remove('open');
        wsTrigger.classList.remove('active');
        wsTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape anywhere
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wsDropdown.classList.contains('open')) {
        wsDropdown.classList.remove('open');
        wsTrigger.classList.remove('active');
        wsTrigger.setAttribute('aria-expanded', 'false');
        wsTrigger.focus();
      }
    });

    // Option clicks
    wsDropdown.querySelectorAll('.workspace-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wsId = btn.getAttribute('data-workspace');
        const wsName = btn.getAttribute('data-name') || wsId;
        const wsFull = btn.getAttribute('data-full') || wsName;

        wsDropdown.querySelectorAll('.workspace-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.selectedJurisdiction = wsId;
        localStorage.setItem('pawtrack_active_jurisdiction', wsId);

        if (wsLabel) wsLabel.textContent = wsName;
        if (jurisdictionLabel) jurisdictionLabel.textContent = wsName;

        wsDropdown.classList.remove('open');
        wsTrigger.classList.remove('active');
        wsTrigger.setAttribute('aria-expanded', 'false');

        this.showToast(`Switched to ${wsFull}`, 'success', 2400);

        // Re-render current route to reflect active jurisdiction
        if (this.currentRoute) {
          this.renderView(this.currentRoute);
        }
      });
    });

    // Connect LGU Cluster button
    addJurisdictionBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      wsDropdown.classList.remove('open');
      wsTrigger.classList.remove('active');
      wsTrigger.setAttribute('aria-expanded', 'false');

      const clusterName = prompt('Enter New LGU Municipal Cluster Name (e.g., Mandaluyong City Vet Services):');
      if (clusterName && clusterName.trim()) {
        const slug = 'pawtrack-' + clusterName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        this.showToast(`Cluster node "${slug}" registered. Authenticating LGU API bridge...`, 'info', 3000);
      }
    });
  }

  initUserMenu() {
    const avatarTrigger = document.getElementById('admin-avatar-trigger');
    const dropdown = document.getElementById('admin-user-dropdown');
    const configBtn = document.getElementById('menu-btn-config');
    const ownerBtn = document.getElementById('menu-btn-owner-app');
    const accessBtn = document.getElementById('menu-btn-access-requests');
    const logoutBtn = document.getElementById('admin-logout-btn');

    if (!avatarTrigger || !dropdown) return;

    avatarTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('workspace-dropdown')?.classList.remove('open');
      document.getElementById('workspace-selector')?.classList.remove('active');
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== avatarTrigger) {
        dropdown.classList.remove('open');
      }
    });

    configBtn?.addEventListener('click', () => {
      dropdown.classList.remove('open');
      window.location.hash = '#settings';
    });

    ownerBtn?.addEventListener('click', () => {
      dropdown.classList.remove('open');
      this.openOwnerApp();
    });

    accessBtn?.addEventListener('click', () => {
      dropdown.classList.remove('open');
      this.openAccessRequests();
    });

    logoutBtn?.addEventListener('click', () => {
      dropdown.classList.remove('open');
      this.logoutAdmin();
    });
  }

  // The SIGNED_OUT auth event brings the sign-in screen back
  async logoutAdmin() {
    if (!this.supabase) return;
    const wasSignedIn = !!this.currentAdmin;
    const { error } = await this.supabase.auth.signOut({ scope: 'local' });
    if (error) {
      this.showToast(`Sign-out failed: ${this.esc(error.message)}`, 'error');
      return;
    }
    if (wasSignedIn) this.showToast('Signed out of the admin console.', 'info');
  }

  updateSyncIndicator() {
    const el = document.getElementById('live-sync-indicator-text');
    const dot = document.getElementById('live-sync-indicator-dot');
    if (!el) return;

    const status = window.adminStore?.syncStatus || 'connected';
    if (status === 'live_sse' || status === 'connected' || status === 'broadcast_sync' || status === 'synced' || status === 'offline_local') {
      el.textContent = 'Live';
      if (dot) { dot.className = 'pulse-emerald'; dot.style.background = '#10b981'; }
    } else if (status === 'reconnecting') {
      el.textContent = 'Reconnecting…';
      if (dot) { dot.className = ''; dot.style.background = '#f59e0b'; }
    } else {
      el.textContent = 'Live';
      if (dot) { dot.className = 'pulse-emerald'; dot.style.background = '#10b981'; }
    }
  }

  openOwnerApp() {
    // The owner portal is served from the site root, next to /admin
    window.open('/', '_blank');
  }

  // Admin sign-in via Supabase Auth. Console access needs an approved row in admin_accounts, which Row Level
  // Security enforces, so every path below ends in the same place: a signed-in user is looked up and either let in,
  // asked to request access, or told their request is pending.
  //   - Log in: email + password (Turnstile first), or Google
  //   - Request access: details incl. birth date (18+), email + password, then an emailed 6-digit code (admin-signup-otp)
  //   - Signed in without a request (Google, or an existing PawTrack login): the same details form, pre-filled (admin-register)
  initAdminGate() {
    const $ = (id) => document.getElementById(id);
    const screen = $('admin-login-screen');
    const status = $('admin-login-status');
    const tabs = $('admin-tabs');
    const config = window.PAWTRACK_SUPABASE;
    const FRESH_SIGNIN_KEY = 'pawtrack_admin_fresh_signin';
    const MIN_AGE = 18;

    const el = {
      loginForm: $('admin-login-form'), loginEmail: $('admin-login-email'), loginPassword: $('admin-login-password'),
      loginSubmit: $('admin-login-submit'), loginTurnstile: $('admin-login-turnstile'), googleBtn: $('admin-login-google-btn'),
      signupGoogleBtn: $('admin-signup-google-btn'),
      signupForm: $('admin-signup-form'), signupSubmit: $('admin-signup-submit'), signupTurnstile: $('admin-signup-turnstile'),
      signupPassword: $('admin-signup-password'), signupRules: $('admin-signup-rules'),
      otpForm: $('admin-otp-form'), otpInput: $('admin-otp'), otpEmail: $('admin-otp-email'), otpVerify: $('admin-otp-verify-btn'),
      otpResend: $('admin-otp-resend-btn'), otpTurnstile: $('admin-otp-turnstile'), otpBack: $('admin-otp-back-btn'),
      registerForm: $('admin-register-form'), registerTurnstile: $('admin-register-turnstile')
    };
    el.registerSubmit = el.registerForm && el.registerForm.querySelector('button[type="submit"]');

    let session = null;
    let resolveRun = 0;
    let currentPanel = null;
    let pendingSignup = null;
    let resendTimer = null;
    const turnstileIds = {};
    const turnstileTokens = {};

    // Google redirects back with ?code=… (or ?error=…); remember any error, then tidy the URL
    const params = new URLSearchParams(window.location.search);
    let pendingError = params.get('error_description') || params.get('error');

    const setStatus = (message, isError = false) => {
      if (!status) return;
      status.textContent = message || '';
      status.classList.toggle('is-error', !!isError);
    };

    // ---------- Small helpers shared by the forms ----------
    const val = (id) => String(($(id) && $(id).value) || '').trim();

    // Mobile fields show a fixed "+63" prefix and take digits only: a pasted +63… or leading 0 is dropped
    const cleanMobileDigits = (value) => {
      let digits = String(value || '').replace(/\D/g, '');
      if (digits.length > 10 && digits.startsWith('63')) digits = digits.slice(2);
      if (digits.startsWith('0')) digits = digits.slice(1);
      return digits.slice(0, 10);
    };
    const mobileValue = (id) => {
      const digits = cleanMobileDigits(val(id));
      return digits ? `+63${digits}` : '';
    };
    const validMobile = (value) => /^\+639\d{9}$/.test(value);
    screen?.querySelectorAll('input[data-ph-mobile]').forEach(input => {
      input.addEventListener('input', () => {
        const cleaned = cleanMobileDigits(input.value);
        if (input.value !== cleaned) input.value = cleaned;
      });
    });

    const pad = (n) => String(n).padStart(2, '0');
    const toIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const latestBirthDate = () => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - MIN_AGE);
      return toIsoDate(d);
    };
    // Admins must be 18 or older (the server and the database check this again)
    const isAdult = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso >= '1900-01-01' && iso <= latestBirthDate();
    ['admin-signup-birth', 'admin-register-birth'].forEach(id => {
      const input = $(id);
      if (input) { input.max = latestBirthDate(); input.min = '1900-01-01'; }
    });

    const passwordRules = {
      length: (pw) => pw.length >= 10,
      upper: (pw) => /[A-Z]/.test(pw),
      lower: (pw) => /[a-z]/.test(pw),
      number: (pw) => /\d/.test(pw),
      symbol: (pw) => /[^A-Za-z0-9\s]/.test(pw)
    };
    const updatePasswordRules = () => {
      const pw = el.signupPassword ? el.signupPassword.value : '';
      let allMet = true;
      el.signupRules?.querySelectorAll('li[data-rule]').forEach(li => {
        const met = passwordRules[li.dataset.rule](pw);
        li.classList.toggle('is-met', met);
        if (!met) allMet = false;
      });
      return allMet;
    };
    el.signupPassword?.addEventListener('input', updatePasswordRules);

    screen?.querySelectorAll('[data-toggle-for]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = $(btn.dataset.toggleFor);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.setAttribute('aria-pressed', String(show));
      });
    });

    const friendlyAuthError = (error) => {
      const code = (error && error.code) || '';
      const message = (error && error.message) || '';
      if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'Incorrect email or password.';
      if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) return 'Please confirm your email first.';
      if (code === 'captcha_failed' || /captcha/i.test(message)) return 'Security check failed. Please complete it again.';
      if (code === 'over_request_rate_limit' || /rate limit/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
      return message || 'Something went wrong. Please try again.';
    };

    // ---------- Panels ----------
    const showPanel = (name) => {
      currentPanel = name;
      screen?.querySelectorAll('[data-login-panel]').forEach(panel => {
        panel.hidden = panel.dataset.loginPanel !== name;
      });
      const showTabs = name === 'signin' || name === 'signup';
      if (tabs) tabs.hidden = !showTabs;
      tabs?.querySelectorAll('[data-admin-tab]').forEach(tab => {
        tab.setAttribute('aria-selected', String(tab.dataset.adminTab === name));
      });
    };

    const lockConsole = (panel) => {
      document.documentElement.classList.remove('auth-resuming');
      this.currentAdmin = null;
      if (screen) screen.style.display = 'flex';
      document.body.classList.add('auth-locked');
      showPanel(panel);
    };

    const showAccessStatus = (title, message) => {
      lockConsole('status');
      $('admin-access-title').textContent = title;
      $('admin-access-message').textContent = message;
    };

    if (!window.supabase || !config) {
      lockConsole(null);
      setStatus('Sign-in services did not load. Check your connection and refresh.', true);
      return;
    }

    this.supabase = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    // ---------- Turnstile ----------
    const waitForTurnstile = (timeoutMs = 10000) => new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (window.turnstile) return resolve();
        if (Date.now() - started > timeoutMs) return reject(new Error('Security check did not load. Check your connection and refresh.'));
        setTimeout(tick, 100);
      };
      tick();
    });

    // One Turnstile widget per container; its buttons stay disabled until the check passes.
    // Tokens are single-use, so every (re)show resets the widget. `action` binds the token to one server check.
    const renderTurnstile = async (container, buttons, action) => {
      if (!container) return;
      const key = container.id;
      const list = (Array.isArray(buttons) ? buttons : [buttons]).filter(Boolean);
      list.forEach(b => { b.disabled = true; });
      turnstileTokens[key] = null;
      try {
        await waitForTurnstile();
        if (turnstileIds[key] !== undefined) {
          window.turnstile.reset(turnstileIds[key]);
          return;
        }
        turnstileIds[key] = window.turnstile.render(container, {
          sitekey: config.turnstileSiteKey,
          action,
          theme: 'light',
          size: 'flexible',
          callback: (token) => {
            turnstileTokens[key] = token;
            list.forEach(b => { b.disabled = false; });
            if (!pendingError) setStatus('');
          },
          'expired-callback': () => {
            turnstileTokens[key] = null;
            list.forEach(b => { b.disabled = true; });
          },
          'error-callback': () => setStatus('Security check failed to load. Please refresh and try again.', true)
        });
      } catch (err) {
        setStatus(err.message, true);
      }
    };
    const renderSigninTurnstile = () => renderTurnstile(el.loginTurnstile, [el.loginSubmit, el.googleBtn], 'admin-signin');
    const renderSignupTurnstile = () => renderTurnstile(el.signupTurnstile, [el.signupSubmit, el.signupGoogleBtn], 'admin-signup');
    const renderOtpTurnstile = () => renderTurnstile(el.otpTurnstile, null, 'admin-signup');
    const renderRegisterTurnstile = () => renderTurnstile(el.registerTurnstile, el.registerSubmit, 'admin-register');

    const goTab = (name) => {
      pendingError = null;
      setStatus('');
      showPanel(name);
      if (name === 'signup') renderSignupTurnstile(); else renderSigninTurnstile();
    };
    screen?.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', () => goTab(btn.dataset.adminTab));
    });

    // ---------- Pre-fill the details form from what we already know about the signed-in person ----------
    const prefillRegister = (user) => {
      const meta = user.user_metadata || {};
      $('admin-register-email').textContent = user.email;
      let first = String(meta.given_name || '').trim();
      let last = String(meta.family_name || '').trim();
      if (!first && !last) {
        const parts = String(meta.full_name || meta.name || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length === 1) first = parts[0];
        if (parts.length > 1) { last = parts.pop(); first = parts.join(' '); }
      }
      const fill = (id, value) => { const input = $(id); if (input && !input.value && value) input.value = value; };
      fill('admin-register-first', first);
      fill('admin-register-last', last);
      fill('admin-register-phone', cleanMobileDigits(meta.phone));
    };

    const resolveAccess = async () => {
      const run = ++resolveRun;
      const user = session && session.user;

      if (!user) {
        // Someone filling in the request form or entering a code must not be bounced by a background auth event
        if (currentPanel === 'signup' || currentPanel === 'otp') return;
        lockConsole('signin');
        setStatus(pendingError ? `Google sign-in failed: ${pendingError}` : '', !!pendingError);
        pendingError = null;
        renderSigninTurnstile();
        return;
      }

      setStatus('Checking your access…');
      const { data: account, error } = await this.supabase
        .from('admin_accounts')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (run !== resolveRun) return; // a newer auth event took over

      setStatus('');
      if (error) {
        showAccessStatus('Could not check your access', error.message);
        return;
      }

      if (!account) {
        prefillRegister(user);
        lockConsole('register');
        renderRegisterTurnstile();
        return;
      }

      if (account.status === 'approved') {
        const isFresh = sessionStorage.getItem(FRESH_SIGNIN_KEY) === '1';
        sessionStorage.removeItem(FRESH_SIGNIN_KEY);
        this.onAdminSignedIn(account, isFresh);
        // An approved admin sees every row: load the full data from Supabase now
        if (window.adminStore) window.adminStore.syncFromSupabase();
        return;
      }

      if (account.status === 'pending') {
        showAccessStatus('Access request sent', `Thanks, ${account.full_name}. An administrator needs to approve ${account.email} before you can use the console. Check back once you've been told it's approved.`);
      } else if (account.status === 'rejected') {
        showAccessStatus('Access request declined', `The request for ${account.email} was not approved. Contact your PawTrack administrator if you think this is a mistake.`);
      } else {
        showAccessStatus('Access suspended', `Console access for ${account.email} has been suspended. Contact your PawTrack administrator to restore it.`);
      }
    };

    // ---------- Log in: Google ----------
    const startGoogle = async (button, rerender) => {
      button.disabled = true;
      setStatus('Redirecting to Google…');
      sessionStorage.setItem(FRESH_SIGNIN_KEY, '1');
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) {
        sessionStorage.removeItem(FRESH_SIGNIN_KEY);
        setStatus(error.message, true);
        rerender();
      }
    };
    el.googleBtn?.addEventListener('click', () => startGoogle(el.googleBtn, renderSigninTurnstile));
    el.signupGoogleBtn?.addEventListener('click', () => startGoogle(el.signupGoogleBtn, renderSignupTurnstile));

    // ---------- Log in: email + password ----------
    el.loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = val('admin-login-email').toLowerCase();
      const password = el.loginPassword ? el.loginPassword.value : '';
      if (!email || !password) { setStatus('Enter your email and password.', true); return; }
      const captchaToken = turnstileTokens[el.loginTurnstile.id];
      if (!captchaToken) { setStatus('Please complete the security check first.', true); return; }

      el.loginSubmit.disabled = true;
      setStatus('Signing you in…');
      sessionStorage.setItem(FRESH_SIGNIN_KEY, '1');
      const { error } = await this.supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
      if (error) {
        sessionStorage.removeItem(FRESH_SIGNIN_KEY);
        setStatus(friendlyAuthError(error), true);
        renderSigninTurnstile();
        return;
      }
      if (el.loginPassword) el.loginPassword.value = '';
      // onAuthStateChange takes it from here
    });

    // ---------- Request access: details -> emailed code -> pending request ----------
    const callAdminOtp = async (payload) => {
      try {
        const res = await fetch(`${config.url}/functions/v1/admin-signup-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: config.publishableKey },
          body: JSON.stringify(payload)
        });
        let data = {};
        try { data = await res.json(); } catch {}
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: false, status: 0, data: { error: 'No connection. Check your internet and try again.' } };
      }
    };

    // A new code can be requested once a minute
    const startResendCooldown = (seconds) => {
      clearInterval(resendTimer);
      let left = seconds;
      const apply = () => {
        if (!el.otpResend) return;
        el.otpResend.disabled = left > 0;
        el.otpResend.textContent = left > 0 ? `Send again in ${left}s` : 'Send again';
        if (left <= 0) clearInterval(resendTimer);
        left -= 1;
      };
      apply();
      resendTimer = setInterval(apply, 1000);
    };

    el.signupForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = val('admin-signup-first');
      const lastName = val('admin-signup-last');
      const birthDate = val('admin-signup-birth');
      const phone = mobileValue('admin-signup-phone');
      const position = val('admin-signup-position');
      const email = val('admin-signup-email').toLowerCase();
      const password = el.signupPassword ? el.signupPassword.value : '';

      if (firstName.length < 1 || lastName.length < 1) return setStatus('Please enter your first and last name.', true);
      if (!birthDate) return setStatus('Please enter your birth date.', true);
      if (!isAdult(birthDate)) return setStatus(`Admins must be at least ${MIN_AGE} years old.`, true);
      if (!validMobile(phone)) return setStatus('Please enter a valid Philippine mobile number (9XX XXX XXXX).', true);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus('Please enter a valid email address.', true);
      if (!updatePasswordRules()) return setStatus('Your password needs 10+ characters with an uppercase letter, a lowercase letter, a number and a symbol.', true);
      const turnstileToken = turnstileTokens[el.signupTurnstile.id];
      if (!turnstileToken) return setStatus('Please complete the security check first.', true);

      el.signupSubmit.disabled = true;
      setStatus('Sending a verification code to your email…');
      const sent = await callAdminOtp({ action: 'send', email, birth_date: birthDate, turnstileToken });
      if (sent.status === 409) {
        setStatus(sent.data.error || 'This email already has an admin request. Try logging in instead.', true);
        renderSignupTurnstile();
        return;
      }
      if (!sent.ok) {
        setStatus(sent.data.error || 'Could not send the code. Please try again.', true);
        renderSignupTurnstile();
        return;
      }

      pendingSignup = {
        email, password, birth_date: birthDate, phone, position,
        full_name: `${firstName} ${lastName}`.replace(/\s+/g, ' ')
      };
      setStatus('');
      el.otpEmail.textContent = email;
      el.otpInput.value = '';
      showPanel('otp');
      startResendCooldown(sent.data.resendInSeconds || 60);
      renderOtpTurnstile();
      setTimeout(() => el.otpInput?.focus(), 150);
    });

    // Going back keeps the typed details; the password is forgotten only when the page closes
    el.otpBack?.addEventListener('click', () => {
      clearInterval(resendTimer);
      pendingSignup = null;
      goTab('signup');
    });

    el.otpInput?.addEventListener('input', () => {
      el.otpInput.value = el.otpInput.value.replace(/\D/g, '').slice(0, 6);
      if (el.otpInput.value.length === 6) el.otpForm?.requestSubmit();
    });

    el.otpResend?.addEventListener('click', async () => {
      if (!pendingSignup) return;
      const turnstileToken = turnstileTokens[el.otpTurnstile.id];
      if (!turnstileToken) return setStatus('Complete the security check, then tap "Send again".', true);
      el.otpResend.disabled = true;
      setStatus('Sending a new code…');
      const sent = await callAdminOtp({ action: 'send', email: pendingSignup.email, birth_date: pendingSignup.birth_date, turnstileToken });
      renderOtpTurnstile();
      if (!sent.ok) {
        setStatus(sent.data.error || 'Could not send the code. Please try again.', true);
        startResendCooldown(sent.data.retryAfter || 5);
        return;
      }
      el.otpInput.value = '';
      setStatus('A new code is on its way.');
      startResendCooldown(sent.data.resendInSeconds || 60);
      el.otpInput.focus();
    });

    el.otpForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pendingSignup) return goTab('signup');
      const code = val('admin-otp');
      if (!/^\d{6}$/.test(code)) {
        setStatus('Enter the 6-digit code from your email.', true);
        el.otpInput.focus();
        return;
      }
      el.otpVerify.disabled = true;
      setStatus('Verifying…');
      const { email, password, full_name, phone, position, birth_date } = pendingSignup;
      const res = await callAdminOtp({ action: 'verify', email, code, password, full_name, phone, position, birth_date });
      el.otpVerify.disabled = false;
      if (!res.ok) {
        setStatus(res.data.error || 'Something went wrong. Please try again.', true);
        if (res.status === 409) {
          // Already has a PawTrack login: logging in will lead to the pre-filled request form
          clearInterval(resendTimer);
          pendingSignup = null;
          goTab('signin');
          if (el.loginEmail) el.loginEmail.value = email;
          setStatus(res.data.error, true);
          return;
        }
        if (res.data.expired) {
          // The code is spent or the password was refused: start the form again with the details still filled in
          clearInterval(resendTimer);
          pendingSignup = null;
          goTab('signup');
          setStatus(res.data.error, true);
          return;
        }
        el.otpInput.select();
        return;
      }

      // The account and the request exist now: exchange the one-time token for a session
      clearInterval(resendTimer);
      pendingSignup = null;
      el.signupForm?.reset();
      sessionStorage.setItem(FRESH_SIGNIN_KEY, '1');
      let signedIn = false;
      if (res.data.token_hash) {
        const { error } = await this.supabase.auth.verifyOtp({ token_hash: res.data.token_hash, type: 'magiclink' });
        signedIn = !error;
        if (error) console.warn('[Admin] Sign-up session exchange failed:', error.message);
      }
      if (!signedIn) {
        sessionStorage.removeItem(FRESH_SIGNIN_KEY);
        goTab('signin');
        if (el.loginEmail) el.loginEmail.value = email;
        setStatus('Your request was submitted. Log in to check its status.');
      }
      // When signedIn, onAuthStateChange shows the "Access request sent" notice
    });

    // ---------- Signed in without a request yet: details form (pre-filled) ----------
    el.registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = session && session.user;
      if (!user) return resolveAccess();

      const turnstileToken = turnstileTokens[el.registerTurnstile.id];
      if (!turnstileToken) return setStatus('Please complete the security check first.', true);

      const firstName = val('admin-register-first');
      const lastName = val('admin-register-last');
      const birthDate = val('admin-register-birth');
      const phone = mobileValue('admin-register-phone');
      if (!firstName || !lastName) return setStatus('Please enter your first and last name.', true);
      if (!birthDate) return setStatus('Please enter your birth date.', true);
      if (!isAdult(birthDate)) return setStatus(`Admins must be at least ${MIN_AGE} years old.`, true);
      if (!validMobile(phone)) return setStatus('Please enter a valid Philippine mobile number (9XX XXX XXXX).', true);

      if (el.registerSubmit) el.registerSubmit.disabled = true;
      setStatus('Submitting your request…');

      // The admin-register Edge Function verifies Turnstile with Cloudflare, then files the request;
      // the signed-in user's identity, the age rule and the approval status are decided server-side
      const { error } = await this.supabase.functions.invoke('admin-register', {
        body: {
          turnstileToken,
          full_name: `${firstName} ${lastName}`.replace(/\s+/g, ' '),
          birth_date: birthDate,
          position: val('admin-register-position'),
          phone
        }
      });

      if (error) {
        let message = error.message;
        try {
          const details = await error.context.json();
          if (details && details.error) message = details.error;
        } catch {}
        setStatus(`Could not submit your request: ${message}`, true);
        renderRegisterTurnstile();
        return;
      }
      sessionStorage.setItem(FRESH_SIGNIN_KEY, '1');
      resolveAccess();
    });

    screen?.querySelectorAll('[data-login-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.loginAction === 'signout') this.logoutAdmin();
        if (btn.dataset.loginAction === 'recheck') resolveAccess();
      });
    });

    this.supabase.auth.onAuthStateChange((event, newSession) => {
      session = newSession;
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      if (event === 'INITIAL_SESSION' && (params.has('code') || params.has('error'))) {
        ['code', 'error', 'error_code', 'error_description', 'state'].forEach(key => params.delete(key));
        const query = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
      }
      // Deferred: calling Supabase from inside this callback can deadlock the auth client
      setTimeout(resolveAccess, 0);
    });
  }

  onAdminSignedIn(account, isFreshSignIn) {
    this.currentAdmin = account;
    const screen = document.getElementById('admin-login-screen');
    if (screen) screen.style.display = 'none';
    document.body.classList.remove('auth-locked');
    document.documentElement.classList.remove('auth-resuming');

    const name = account.full_name || account.email;
    const initials = name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    document.querySelectorAll('.operator-name, .admin-dropdown-name').forEach(el => { el.textContent = name; });
    document.querySelectorAll('.operator-role, .admin-dropdown-role').forEach(el => { el.textContent = account.position || account.email; });
    document.querySelectorAll('.admin-dropdown-jurisdiction').forEach(el => { el.textContent = account.office || 'Office not assigned yet'; });
    document.querySelectorAll('#admin-avatar-trigger, .admin-dropdown-avatar').forEach(el => { el.textContent = initials; });
    const avatar = document.getElementById('admin-avatar-trigger');
    if (avatar) avatar.title = `${name} (click for menu)`;

    this.startTopbarClock();
    this.refreshAccessRequestCount();
    if (isFreshSignIn) this.showToast(`Signed in as ${this.esc(name)}`, 'success');
  }

  // Topbar greeting by time of day, plus a live date and time. Only text changes, so nothing re-renders.
  startTopbarClock() {
    clearInterval(this._clockTimer);
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      const full = (this.currentAdmin && this.currentAdmin.full_name) || '';
      const first = String(full).trim().split(/\s+/)[0];
      const set = (id, text) => { const el = document.getElementById(id); if (el && el.textContent !== text) el.textContent = text; };
      set('topbar-greeting-hello', first ? `${part}, ${first}` : part);
      set('topbar-clock-date', now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
      set('topbar-clock-time', now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    this._clockTimer = setInterval(tick, 1000);
  }

  esc(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async refreshAccessRequestCount() {
    const badge = document.getElementById('admin-access-count');
    if (!badge || !this.supabase || !this.currentAdmin) return;
    const { count, error } = await this.supabase
      .from('admin_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (error) return;
    badge.textContent = count;
    badge.hidden = !count;
  }

  // Approved admins review console access requests (the database rejects anyone else)
  async openAccessRequests() {
    if (!this.supabase || !this.currentAdmin) return;
    const box = this.openModalContent(`
      <div class="modal-header">
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--ink-primary);">Access Requests</h3>
        <button class="btn btn-sm btn-secondary" onclick="window.adminApp.closeModal()">&times;</button>
      </div>
      <div class="modal-body"><div class="admin-access-list">Loading accounts…</div></div>
    `);
    const list = box.querySelector('.admin-access-list');

    const { data, error } = await this.supabase
      .from('admin_accounts')
      .select('id, email, full_name, office, position, phone, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      list.textContent = `Could not load accounts: ${error.message}`;
      return;
    }

    const order = { pending: 0, approved: 1, suspended: 2, rejected: 3 };
    data.sort((a, b) => order[a.status] - order[b.status]);

    const actionsFor = (acc) => {
      if (acc.id === this.currentAdmin.id) return '<span class="admin-access-status">You</span>';
      const btn = (status, label, cls) => `<button class="btn btn-sm ${cls}" data-access-id="${acc.id}" data-access-status="${status}">${label}</button>`;
      if (acc.status === 'pending') return btn('approved', 'Approve', 'btn-primary') + btn('rejected', 'Reject', 'btn-secondary');
      if (acc.status === 'approved') return btn('suspended', 'Suspend', 'btn-danger');
      return btn('approved', 'Approve', 'btn-secondary');
    };

    list.innerHTML = data.length ? data.map(acc => `
      <div class="admin-access-row">
        <div class="admin-access-info">
          <strong>${this.esc(acc.full_name)}</strong>
          ${this.esc(acc.email)}${acc.phone ? ` · ${this.esc(acc.phone)}` : ''}<br>
          ${this.esc(acc.office || 'Office not assigned')}${acc.position ? ` · ${this.esc(acc.position)}` : ''} · requested ${new Date(acc.created_at).toLocaleDateString()}
        </div>
        <span class="admin-access-status${acc.status === 'pending' ? ' is-pending' : ''}">${acc.status}</span>
        <div class="admin-access-actions">${actionsFor(acc)}</div>
      </div>
    `).join('') : 'No accounts yet.';

    list.querySelectorAll('[data-access-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const { error: updateError } = await this.supabase
          .from('admin_accounts')
          .update({ status: btn.dataset.accessStatus })
          .eq('id', btn.dataset.accessId);
        if (updateError) {
          btn.disabled = false;
          this.showToast(`Could not update access: ${this.esc(updateError.message)}`, 'error');
          return;
        }
        this.showToast(`Access ${btn.dataset.accessStatus}.`, 'success');
        this.refreshAccessRequestCount();
        this.openAccessRequests();
      });
    });
  }

  initEventListeners() {
    // Hash routing
    window.addEventListener('hashchange', () => this.handleRoute());

    // Navigation item clicks
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const route = e.currentTarget.getAttribute('data-route');
        if (route) {
          window.location.hash = '#' + route;
        }
      });
    });

    // Global Search trigger (Ctrl+K)
    document.getElementById('global-search-trigger')?.addEventListener('click', () => {
      this.openCommandPalette();
    });

    // Drawer backdrop click to close
    document.getElementById('app-drawer-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'app-drawer-backdrop') {
        this.closeDrawer();
      }
    });

    // Modal backdrop click to close
    document.getElementById('app-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'app-modal-backdrop') {
        this.closeModal();
      }
    });

    // Open User App direct button
    document.getElementById('btn-open-user-app')?.addEventListener('click', () => {
      this.openOwnerApp();
    });
  }

  initSeenTracking() {
    const store = window.adminStore;
    const pets = store.getPets ? store.getPets() : [];
    const sightings = store.getSightings ? store.getSightings() : [];
    const impoundments = store.getImpoundments ? store.getImpoundments() : [];
    const notifs = store.getNotifications ? store.getNotifications() : [];

    const activeImpounds = impoundments.filter(i => i.status === 'active_impounded').length;
    const unreadNotifs = notifs.filter(n => !n.read).length;

    let saved = null;
    try {
      saved = JSON.parse(sessionStorage.getItem('pawtrack_seen_counts'));
    } catch (e) {
      saved = null;
    }

    if (!saved) {
      this.seenCounts = {
        pets: pets.length,
        sightings: sightings.length,
        impoundments: activeImpounds,
        notifs: unreadNotifs
      };
      try {
        sessionStorage.setItem('pawtrack_seen_counts', JSON.stringify(this.seenCounts));
      } catch (e) {}
    } else {
      this.seenCounts = saved;
    }
  }

  markRouteSeen(route) {
    if (!this.seenCounts) this.initSeenTracking();
    const store = window.adminStore;

    if (route === 'impoundments') {
      const impoundments = store.getImpoundments ? store.getImpoundments() : [];
      this.seenCounts.impoundments = impoundments.filter(i => i.status === 'active_impounded').length;
    } else if (route === 'notifs') {
      const notifs = store.getNotifications ? store.getNotifications() : [];
      this.seenCounts.notifs = notifs.filter(n => !n.read).length;
    }

    try {
      sessionStorage.setItem('pawtrack_seen_counts', JSON.stringify(this.seenCounts));
    } catch (e) {}

    this.updateSidebarBadges();
  }

  handleRoute() {
    const rawHash = (window.location.hash || '#activation').replace('#', '');
    const validRoutes = ['activation', 'breakdown', 'heatmap', 'impoundments', 'terminal', 'shelters', 'rfid', 'notifs', 'settings'];
    this.currentRoute = validRoutes.includes(rawHash) ? rawHash : 'activation';

    // Update active nav state
    document.querySelectorAll('.nav-item').forEach(item => {
      const route = item.getAttribute('data-route');
      if (route === this.currentRoute) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.markRouteSeen(this.currentRoute);
    this.renderView(this.currentRoute);
  }

  renderView(route) {
    const container = document.getElementById('view-container');
    if (!container) return;

    try {
      switch (route) {
        case 'activation':
          if (window.ActivationView) window.ActivationView.render(container);
          break;
        case 'breakdown':
          if (window.BreakdownView) window.BreakdownView.render(container);
          break;
        case 'heatmap':
          if (window.HeatmapView) window.HeatmapView.render(container);
          break;
        case 'impoundments':
          if (window.ImpoundmentsView) window.ImpoundmentsView.render(container);
          break;
        case 'terminal':
          if (window.TerminalView) window.TerminalView.render(container);
          break;
        case 'shelters':
          if (window.SheltersView) window.SheltersView.render(container);
          break;
        case 'rfid':
          if (window.RfidView) window.RfidView.render(container);
          break;
        case 'notifs':
          if (window.NotifsView) window.NotifsView.render(container);
          break;
        case 'settings':
          if (window.SettingsView) window.SettingsView.render(container);
          break;
        default:
          if (window.ActivationView) window.ActivationView.render(container);
      }
    } catch (err) {
      console.error(`Error rendering view ${route}:`, err);
      container.innerHTML = `
        <div class="nock-card" style="padding: 32px; text-align: center;">
          <h3 style="color: var(--color-red); margin-bottom: 8px;">View Render Notice</h3>
          <p style="color: var(--ink-muted); font-size: 13px; margin-bottom: 16px;">${err.message}</p>
          <button class="btn btn-primary" onclick="window.adminApp.renderView('${route}')">Retry</button>
        </div>
      `;
    }
  }

  updateSidebarBadges() {
    if (!this.seenCounts) this.initSeenTracking();
    const store = window.adminStore;
    const pets = store.getPets ? store.getPets() : [];
    const sightings = store.getSightings ? store.getSightings() : [];
    const impoundments = store.getImpoundments ? store.getImpoundments() : [];
    const notifs = store.getNotifications ? store.getNotifications() : [];

    const activeImpounds = impoundments.filter(i => i.status === 'active_impounded').length;
    const unreadNotifs = notifs.filter(n => !n.read).length;

    // Only count items added above the last seen count
    const newImpounds = Math.max(0, activeImpounds - (this.seenCounts.impoundments || 0));
    const newNotifs = Math.max(0, unreadNotifs - (this.seenCounts.notifs || 0));

    const impoundBadge = document.getElementById('badge-impounds-count');
    if (impoundBadge) {
      if (newImpounds > 0 && this.currentRoute !== 'impoundments') {
        impoundBadge.textContent = `+${newImpounds}`;
        impoundBadge.style.display = 'inline-flex';
        impoundBadge.classList.add('danger');
      } else {
        impoundBadge.textContent = '';
        impoundBadge.style.display = 'none';
        impoundBadge.classList.remove('danger');
      }
    }

    const notifBadge = document.getElementById('badge-notifs-count');
    if (notifBadge) {
      if (newNotifs > 0 && this.currentRoute !== 'notifs') {
        notifBadge.textContent = `+${newNotifs}`;
        notifBadge.style.display = 'inline-flex';
      } else {
        notifBadge.textContent = '';
        notifBadge.style.display = 'none';
      }
    }
  }

  // --- Drawer API ---
  openDrawer(htmlContent) {
    const backdrop = document.getElementById('app-drawer-backdrop');
    const panel = document.getElementById('app-drawer-panel');
    if (backdrop && panel) {
      panel.innerHTML = htmlContent;
      backdrop.classList.add('open');
      document.body.classList.add('drawer-open');
    }
    return panel;
  }

  closeDrawer() {
    const backdrop = document.getElementById('app-drawer-backdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      document.body.classList.remove('drawer-open');
    }
  }

  // --- Modal API ---
  openModalContent(htmlContent) {
    const backdrop = document.getElementById('app-modal-backdrop');
    const box = document.getElementById('app-modal-box');
    if (backdrop && box) {
      box.innerHTML = htmlContent;
      backdrop.classList.add('open');
      document.body.classList.add('modal-open');
    }
    return box;
  }

  closeModal() {
    const backdrop = document.getElementById('app-modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      document.body.classList.remove('modal-open');
    }
  }

  // --- Toast Manager ---
  showToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
    if (type === 'success') iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    if (type === 'error') iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    if (type === 'warning') iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

    toast.innerHTML = `
      <span style="display: inline-flex; align-items: center; flex-shrink: 0;">${iconSvg}</span>
      <span style="flex: 1; line-height: 1.35; font-size: 12px;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // --- Command Palette (Ctrl+K) ---
  initCommandPalette() {
    const backdrop = document.getElementById('command-palette-backdrop');
    const input = document.getElementById('command-palette-input');
    const list = document.getElementById('command-palette-list');

    if (!backdrop || !input || !list) return;

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeCommandPalette();
    });

    input.addEventListener('input', (e) => {
      this.filterCommandPalette(e.target.value);
    });
  }

  initSidebarToggle() {
    const collapseBtn = document.getElementById('btn-sidebar-collapse');
    const topbarToggleBtn = document.getElementById('btn-sidebar-topbar-toggle');
    const layout = document.getElementById('app-layout');

    // Restore persisted sidebar hidden state
    const isHidden = localStorage.getItem('pawtrack_sidebar_hidden') === 'true';
    if (isHidden && layout) {
      layout.classList.add('sidebar-hidden');
    }
    this.updateSidebarToggleUI(isHidden);

    collapseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSidebar(true);
    });

    topbarToggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSidebar();
    });
  }

  toggleSidebar(forceHide) {
    const layout = document.getElementById('app-layout');
    if (!layout) return;

    if (forceHide === true) {
      layout.classList.add('sidebar-hidden');
    } else if (forceHide === false) {
      layout.classList.remove('sidebar-hidden');
    } else {
      layout.classList.toggle('sidebar-hidden');
    }

    const isHidden = layout.classList.contains('sidebar-hidden');
    try {
      localStorage.setItem('pawtrack_sidebar_hidden', isHidden ? 'true' : 'false');
    } catch (e) {}

    this.updateSidebarToggleUI(isHidden);
    this.showToast(isHidden ? 'Navigation sidebar hidden (Press Ctrl+B to reveal)' : 'Navigation sidebar visible', 'info', 1400);
  }

  updateSidebarToggleUI(isHidden) {
    const topbarToggleBtn = document.getElementById('btn-sidebar-topbar-toggle');
    if (topbarToggleBtn) {
      topbarToggleBtn.setAttribute('title', isHidden ? 'Show Navigation Sidebar (Ctrl+B)' : 'Hide Navigation Sidebar (Ctrl+B)');
      topbarToggleBtn.setAttribute('aria-label', isHidden ? 'Show Sidebar' : 'Hide Sidebar');
      topbarToggleBtn.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
    }
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ctrl+K: Global search / Command palette
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        this.openCommandPalette();
      }
      // Ctrl+B or Ctrl+\: Toggle Navigation Sidebar
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B' || e.key === '\\')) {
        e.preventDefault();
        this.toggleSidebar();
      }
      if (e.key === 'Escape') {
        this.closeCommandPalette();
        this.closeModal();
        this.closeDrawer();
      }
    });
  }

  openCommandPalette() {
    const backdrop = document.getElementById('command-palette-backdrop');
    const input = document.getElementById('command-palette-input');
    if (backdrop && input) {
      backdrop.classList.add('open');
      input.value = '';
      input.focus();
      this.filterCommandPalette('');
    }
  }

  closeCommandPalette() {
    const backdrop = document.getElementById('command-palette-backdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  filterCommandPalette(query) {
    const list = document.getElementById('command-palette-list');
    if (!list) return;

    const store = window.adminStore;
    const pets = store.getPets();
    const shelters = store.getShelters();
    const q = query.toLowerCase().trim();

    const commands = [
      { label: 'Go to System Activation Dashboard', route: 'activation', cat: 'Navigation' },
      { label: 'Breakdown: Species, Breed, Age, Outcome & Source', route: 'breakdown', cat: 'Navigation' },
      { label: 'View Heatmap Analysis & Lost Pet Hotspots', route: 'heatmap', cat: 'Navigation' },
      { label: 'View Impoundment Queue & 72h SLA', route: 'impoundments', cat: 'Navigation' },
      { label: 'Shelter Terminal: Scan Tag & Log Intake', route: 'terminal', cat: 'Navigation' },
      { label: 'Inspect Shelter Facilities', route: 'shelters', cat: 'Navigation' },
      { label: 'RFID Tag Provisioning & Hardware', route: 'rfid', cat: 'Navigation' },
      { label: 'Dispatch Emergency Broadcast', route: 'notifs', cat: 'Navigation' },
      { label: 'Municipal Settings & JSON Backup', route: 'settings', cat: 'Navigation' },
      { label: 'Log Animal Control Intake', action: 'intake', cat: 'Actions' },
      { label: 'Launch RFID Scanner Simulator', action: 'scanner', cat: 'Actions' },
    ];

    // Append shelters
    shelters.forEach(s => {
      commands.push({
        label: `Facility: ${s.name} (${s.fee})`,
        shelterId: s.id,
        cat: 'Municipal Shelters'
      });
    });

    const filtered = q ? commands.filter(c => c.label.toLowerCase().includes(q)) : commands;

    list.innerHTML = filtered.slice(0, 12).map(item => `
      <div class="command-item" data-route="${item.route || ''}" data-filter="${item.filter || ''}" data-action="${item.action || ''}" data-pet-id="${item.petId || ''}" data-report-id="${item.reportId || ''}">
        <span>${item.label}</span>
        <span class="mono-tag" style="font-size: 9px;">${item.cat}</span>
      </div>
    `).join('');

    // Attach click events to command items
    list.querySelectorAll('.command-item').forEach(el => {
      el.addEventListener('click', () => {
        const route = el.getAttribute('data-route');
        const filter = el.getAttribute('data-filter');
        const action = el.getAttribute('data-action');
        const petId = el.getAttribute('data-pet-id');
        const reportId = el.getAttribute('data-report-id');

        this.closeCommandPalette();

        if (route) {
          window.location.hash = '#' + route;
        } else if (action === 'intake') {
          window.location.hash = '#impoundments';
          setTimeout(() => window.ImpoundmentsView?.openIntakeModal(), 100);
        } else if (action === 'scanner') {
          window.location.hash = '#rfid';
          setTimeout(() => window.RfidView?.openScannerSimulatorModal(), 100);
        }
      });
    });
  }
}

// Global App Instance
function bootstrapAdmin() {
  if (!window.adminApp) {
    window.adminApp = new AdminApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapAdmin);
} else {
  bootstrapAdmin();
}
