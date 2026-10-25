/**
 * PawTrack Application Controller & Router
 */

class App {
  constructor() {
    this.currentView = 'owner';
    this.views = {
      owner: window.ownerView,
      map: window.publicView,
      cases: window.casesView,
      impounded: window.impoundedView,
      hardware: window.hardwareView,
      sightings: window.sightingsView
    };

    this.init();
  }

  init() {
    this.initTheme();
    this.initLanguage();
    this.initGoogleAuth();
    this.initEventListeners();
    this.initModals();
    this.initSidebar();
    this.initPhotoUpload();
    this.updateGoogleAuthUI();
    this.handleRoute();
    this.checkHardwareScanUrl();
    this.restoreSession();

    // Subscribe to store updates
    window.pawStore.subscribe(() => {
      this.updateGoogleAuthUI();
      this.renderCurrentView();
      this.updateNotifBadge();
    });

    this.updateGoogleAuthUI();
    this.updateNotifBadge();
  }

  // The Supabase session is the source of truth (see initSupabaseAuth); its first auth event
  // confirms or clears the cached profile, so here we only avoid flashing the app to signed-out visitors
  restoreSession() {
    if (!window.pawStore.getGoogleUser()) this.showStartScreenIfNeeded();
  }

  isGuestMode() {
    try {
      return sessionStorage.getItem('pawtrack_guest_mode') === '1';
    } catch (e) {
      return false;
    }
  }

  setGuestMode(enabled) {
    try {
      if (enabled) sessionStorage.setItem('pawtrack_guest_mode', '1');
      else sessionStorage.removeItem('pawtrack_guest_mode');
    } catch (e) {}
  }

  // Signed-out visitors start on the sign-in screen, unless they chose to report a found pet as a guest
  showStartScreenIfNeeded() {
    const signedIn = !!(window.pawStore.getGoogleUser() || {}).name;
    if (signedIn) {
      this.hideStartScreen();
    } else if (!this.isGuestMode()) {
      this.openLoginDialog();
    }
  }

  hideStartScreen() {
    const landing = document.getElementById('auth-landing');
    if (landing) landing.style.display = 'none';
    document.body.classList.remove('auth-locked');
  }

  // Map a server account onto the guardian profile shape the views already use
  toGuardianProfile(user) {
    const cached = window.pawStore.getGoogleUser();
    const sameUser = !!(cached && cached.email === user.email);
    const name = user.name || user.email;
    return {
      id: user.id,
      name,
      shortName: name.split(' ')[0] || name,
      email: user.email,
      phone: user.phone,
      picture: (sameUser && cached.picture) || user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a73e8&color=fff&bold=true&size=128`,
      avatarInitial: (name[0] || 'G').toUpperCase(),
      avatarBg: '#1a73e8',
      area: (sameUser && cached.area) || 'National Capital Region (NCR)',
      backupPhone: (sameUser && cached.backupPhone) || '',
      verified: true,
      emailVerified: true,
      authenticatedAt: new Date().toISOString()
    };
  }

  checkHardwareScanUrl() {
    const searchParams = new URLSearchParams(window.location.search);
    const hasScanParam = searchParams.has('scan') || searchParams.has('nfc') || searchParams.has('rfid') || searchParams.has('tag') || searchParams.has('action') || searchParams.has('hardware_scan');
    const isReportAction = searchParams.get('action') === 'report' || searchParams.get('scan') === '1' || searchParams.get('scan') === 'true' || searchParams.has('nfc') || searchParams.has('rfid') || searchParams.has('tag') || window.location.hash === '#report';

    if (hasScanParam || isReportAction) {
      this.setGuestMode(true);
      const scannedTag = searchParams.get('nfc') || searchParams.get('rfid') || searchParams.get('tag') || '';

      // A tapped pet tag opens the pet's own page instead of the generic report form
      if (scannedTag && window.foundPage) {
        // pawApp (and its Supabase client) is assigned once this constructor returns
        setTimeout(() => window.foundPage.show(scannedTag), 0);
        return;
      }

      window.location.hash = 'owner';

      // Clean query parameters from URL address bar seamlessly
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname + '#owner');
      }

      setTimeout(() => {
        if (window.nfcScanner) window.nfcScanner.playSuccessChirp();
        if (window.reportManager) {
          window.reportManager.openReportModal('found', null, { nfcTag: scannedTag });
        }
      }, 300);
    }
  }

  initLanguage() {
    if (window.pawI18n) {
      window.pawI18n.updateToggleUI();
      window.pawI18n.applyDOMTranslations();
    }
  }

  toggleLanguage() {
    if (window.pawI18n) {
      window.pawI18n.toggleLanguage();
    }
  }

  initTheme() {
    const savedTheme = (window.pawStore && typeof window.pawStore.getTheme === 'function')
      ? window.pawStore.getTheme()
      : (localStorage.getItem('pawtrack_theme') || 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        if (window.pawStore && typeof window.pawStore.setTheme === 'function') {
          window.pawStore.setTheme(next);
        } else {
          localStorage.setItem('pawtrack_theme', next);
        }
        this.updateThemeIcon(next);
      });
    }
  }

  updateThemeIcon(theme) {
    const svg = document.getElementById('theme-btn-svg');
    if (svg) {
      if (theme === 'light') {
        svg.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
      } else {
        svg.innerHTML = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>`;
      }
    }
  }

  initGoogleAuth() {
    const loginBtn = document.getElementById('header-login-btn');
    const userBtn = document.getElementById('header-user-btn');
    const userDropdown = document.getElementById('user-account-dropdown');
    const onetapPrompt = document.getElementById('google-onetap-prompt');
    const onetapClose = document.getElementById('onetap-close-btn');
    const onetapContinue = document.getElementById('onetap-continue-btn');
    const onetapGuest = document.getElementById('onetap-guest-btn');
    const warningModal = document.getElementById('google-required-modal');
    const promptLoginBtn = document.getElementById('prompt-google-login-btn');

    const profileModal = document.getElementById('guardian-profile-modal');
    const settingsModal = document.getElementById('portal-settings-modal');

    const notifBellBtn = document.getElementById('notif-bell-btn');
    const notifDropdown = document.getElementById('notif-dropdown-panel');
    const notifMarkRead = document.getElementById('notif-mark-read-btn');
    const notifClose = document.getElementById('notif-dropdown-close');

    // Click "Log In" Button -> Open "Log in or create an account" Modal
    loginBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notifDropdown) notifDropdown.style.display = 'none';
      if (userDropdown) userDropdown.style.display = 'none';
      if (onetapPrompt) onetapPrompt.style.display = 'none';
      this.openLoginDialog();
    });

    // Click Logged-in User Pill -> Toggle User Account Dropdown
    userBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userDropdown) {
        const isShown = userDropdown.style.display === 'flex';
        userDropdown.style.display = isShown ? 'none' : 'flex';
      }
      if (notifDropdown) notifDropdown.style.display = 'none';
      if (onetapPrompt) onetapPrompt.style.display = 'none';
    });

    // User Dropdown: Guardian Profile Button
    document.getElementById('dropdown-profile-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userDropdown) userDropdown.style.display = 'none';
      this.populateGuardianProfile(false);
      if (profileModal) profileModal.classList.add('active');
    });

    // Guardian Profile: Switch to Edit Mode
    const openGuardianEditMode = (e) => {
      if (e) e.stopPropagation();
      this.populateGuardianProfile(true);
    };
    document.getElementById('guardian-edit-btn')?.addEventListener('click', openGuardianEditMode);
    document.getElementById('guardian-open-edit-footer-btn')?.addEventListener('click', openGuardianEditMode);

    // Guardian Profile: Cancel Edit Mode (Back to View Mode)
    document.getElementById('edit-guardian-cancel-btn')?.addEventListener('click', (e) => {
      if (e) e.stopPropagation();
      this.populateGuardianProfile(false);
    });

    // Guardian Profile: Custom Avatar File Upload Preview
    const avatarFileInput = document.getElementById('edit-guardian-avatar-file');
    avatarFileInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          if (window.notifManager) window.notifManager.showToast('Please select an image under 5MB.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          this.pendingGuardianAvatar = event.target.result;
          const previewEl = document.getElementById('edit-guardian-avatar-preview');
          if (previewEl) {
            previewEl.innerHTML = `<img src="${this.pendingGuardianAvatar}" alt="Preview" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" />`;
          }
        };
        reader.readAsDataURL(file);
      }
    });

    // Guardian Profile: Reset Avatar
    document.getElementById('edit-guardian-avatar-reset')?.addEventListener('click', (e) => {
      if (e) e.stopPropagation();
      this.pendingGuardianAvatar = null;
      const previewEl = document.getElementById('edit-guardian-avatar-preview');
      const editName = document.getElementById('edit-guardian-name-input');
      const nameVal = editName ? editName.value.trim() : 'G';
      if (previewEl) {
        previewEl.innerHTML = '';
        previewEl.textContent = (nameVal[0] || 'G').toUpperCase();
      }
      if (avatarFileInput) avatarFileInput.value = '';
      if (window.notifManager) window.notifManager.showToast('Avatar reset to initial letter.', 'info');
    });

    // Guardian Profile: Save Edit Form
    document.getElementById('guardian-profile-edit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('edit-guardian-name-input');
      const phoneInput = document.getElementById('edit-guardian-phone-input');
      const areaInput = document.getElementById('edit-guardian-area-input');
      const backupInput = document.getElementById('edit-guardian-backup-input');

      const nameVal = nameInput ? nameInput.value.trim() : '';
      const phoneVal = phoneInput ? phoneInput.value.trim() : '';
      const areaVal = areaInput ? areaInput.value.trim() : '';
      const backupVal = backupInput ? backupInput.value.trim() : '';

      if (!nameVal) {
        if (window.notifManager) window.notifManager.showToast('Guardian name cannot be blank.', 'error');
        return;
      }
      if (!phoneVal) {
        if (window.notifManager) window.notifManager.showToast('Rescue contact phone number is required.', 'error');
        return;
      }

      let user = window.pawStore ? window.pawStore.getGoogleUser() : null;
      if (!user) {
        user = {
          email: 'guardian@pawtrack.local',
          verified: true,
          emailVerified: true
        };
      }

      user.name = nameVal;
      user.shortName = nameVal.split(' ')[0] || nameVal;
      user.phone = phoneVal;
      user.area = areaVal || 'National Capital Region (NCR)';
      user.backupPhone = backupVal;
      user.avatarInitial = (nameVal[0] || 'G').toUpperCase();

      if (this.pendingGuardianAvatar !== undefined) {
        user.picture = this.pendingGuardianAvatar;
      }

      if (window.pawStore) {
        window.pawStore.setGoogleUser(user);
      }
      this.updateGoogleAuthUI();
      this.populateGuardianProfile(false);

      if (this.supabase && user.id) {
        this.supabase
          .from('guardians')
          .update({ full_name: nameVal, phone: phoneVal.replace(/[\s\-().]/g, '') })
          .eq('id', user.id)
          .then(({ error }) => {
            if (!error || !window.notifManager) return;
            const message = /phone/i.test(error.message)
              ? 'Saved on this device only: please use a Philippine mobile number, e.g. 0917 123 4567.'
              : 'Could not save your profile to your account; saved on this device only.';
            window.notifManager.showToast(message, 'warning');
          });
      }

      const regOwnerName = document.getElementById('reg-owner-name');
      if (regOwnerName) regOwnerName.value = user.name;

      if (window.notifManager) {
        window.notifManager.showToast('Guardian profile updated successfully.', 'success');
      }
    });

    // User Dropdown: Hardware Specs Button (under Guardian Profile)
    document.getElementById('dropdown-hardware-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userDropdown) userDropdown.style.display = 'none';
      window.location.hash = 'hardware';
    });

    // User Dropdown: Portal Settings Button
    document.getElementById('dropdown-settings-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userDropdown) userDropdown.style.display = 'none';
      if (settingsModal) settingsModal.classList.add('active');
    });

    // User Dropdown: Log Out Button
    document.getElementById('dropdown-logout-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userDropdown) userDropdown.style.display = 'none';
      window.pawStore.setGoogleUser(null);
      if (this.supabase) this.supabase.auth.signOut({ scope: 'local' });
      this.setGuestMode(false);
      this.updateGoogleAuthUI();
      this.openLoginDialog();
      if (window.location.hash && window.location.hash !== '#owner') {
        window.location.hash = '#owner';
      } else {
        this.handleRoute();
      }
      window.notifManager.showToast('Signed out of PawTrack portal.', 'info');
    });

    // Notification Bell: Facebook-style anchored dropdown
    notifBellBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notifDropdown) {
        const isShown = notifDropdown.style.display === 'block';
        notifDropdown.style.display = isShown ? 'none' : 'block';
        if (!isShown) {
          window.notifManager.renderNotifDropdown();
        }
      }
      if (userDropdown) userDropdown.style.display = 'none';
      if (onetapPrompt) onetapPrompt.style.display = 'none';
    });

    // Notification Mark Read
    notifMarkRead?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.pawStore.markAllNotificationsRead();
      window.notifManager.renderNotifDropdown();
      this.updateNotifBadge();
    });

    // Notification Close
    notifClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notifDropdown) notifDropdown.style.display = 'none';
    });

    // Close Google One Tap Prompt
    onetapClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onetapPrompt) onetapPrompt.style.display = 'none';
    });

    // Guardian sign-in (Supabase Auth) is set up in initSupabaseAuth()
    this.initSupabaseAuth();

    const loginOpenTerms = document.getElementById('login-open-terms-btn');
    const loginOpenPrivacy = document.getElementById('login-open-privacy-btn');
    const authLandingClose = document.getElementById('auth-landing-close');
    const authLandingReport = document.getElementById('auth-landing-report-btn');

    authLandingClose?.addEventListener('click', () => this.hideStartScreen());

    // Finders can report a found pet without an account
    authLandingReport?.addEventListener('click', () => {
      this.setGuestMode(true);
      this.hideStartScreen();
      if (window.reportManager) window.reportManager.openReportModal('found');
    });

    // Terms & Privacy Links
    loginOpenTerms?.addEventListener('click', (e) => {
      e.preventDefault();
      window.notifManager.openModal('terms-modal');
    });

    loginOpenPrivacy?.addEventListener('click', (e) => {
      e.preventDefault();
      window.notifManager.openModal('privacy-policy-modal');
    });

    // Sign in with Google (header prompt)
    onetapContinue?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openLoginDialog();
    });

    // Continue as Guest
    onetapGuest?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onetapPrompt) onetapPrompt.style.display = 'none';
      this.setGuestMode(true);
      this.hideStartScreen();
      this.updateGoogleAuthUI();
      window.notifManager.showToast('Continuing in Guest Mode. Pet registration requires login.', 'info');
    });

    // "Sign-in required" prompt
    promptLoginBtn?.addEventListener('click', () => {
      this.openLoginDialog();
    });

    // Click outside to dismiss all floating dropdowns
    document.addEventListener('click', (e) => {
      if (onetapPrompt && !onetapPrompt.contains(e.target) && !e.target.closest('#header-login-btn')) {
        onetapPrompt.style.display = 'none';
      }
      if (userDropdown && !userDropdown.contains(e.target) && !e.target.closest('#header-user-btn')) {
        userDropdown.style.display = 'none';
      }
      if (notifDropdown && !notifDropdown.contains(e.target) && !e.target.closest('#notif-bell-btn')) {
        notifDropdown.style.display = 'none';
      }
    });
  }

  initSupabaseAuth() {
    // -------------------------------------------------------------
    // Guardian Sign-In via Supabase Auth: email + password or Google.
    // Supabase verifies the Turnstile token on password sign-in, sign-up and
    // password reset; the guardians table holds each account's name and phone.
    // -------------------------------------------------------------
    const config = window.PAWTRACK_SUPABASE;
    const loginForm = document.getElementById('login-form');
    const loginTitle = document.getElementById('auth-landing-title');
    const loginSub = document.getElementById('auth-landing-sub');
    const loginNameInput = document.getElementById('login-name');
    const loginEmailInput = document.getElementById('login-email');
    const loginPhoneInput = document.getElementById('login-phone');
    const loginPasswordInput = document.getElementById('login-password');
    const loginPasswordToggle = document.getElementById('login-password-toggle');
    const loginSubmit = document.getElementById('login-submit-btn');
    const loginForgotBtn = document.getElementById('login-forgot-btn');
    const loginModeText = document.getElementById('login-mode-text');
    const loginModeToggle = document.getElementById('login-mode-toggle');
    const loginGoogleBtn = document.getElementById('login-google-btn');
    const loginStatus = document.getElementById('login-auth-status');
    const loginTurnstileEl = document.getElementById('login-turnstile');
    const registerForm = document.getElementById('register-dialog-form');
    const registerEmail = document.getElementById('register-email');
    const registerName = document.getElementById('register-name');
    const registerPhone = document.getElementById('register-phone');
    const registerStatus = document.getElementById('register-auth-status');
    const registerSubmit = document.getElementById('register-submit-btn');
    const resetForm = document.getElementById('reset-password-form');
    const resetInput = document.getElementById('reset-password-input');
    const resetConfirm = document.getElementById('reset-password-confirm');
    const resetStatus = document.getElementById('reset-password-status');
    const resetSubmit = document.getElementById('reset-password-submit');
    const authLanding = document.getElementById('auth-landing');
    const authLandingClose = document.getElementById('auth-landing-close');
    const onetapPrompt = document.getElementById('google-onetap-prompt');
    const warningModal = document.getElementById('google-required-modal');

    const FRESH_SIGNIN_KEY = 'pawtrack_fresh_signin';
    const RECOVERY_KEY = 'pawtrack_password_recovery';
    const OTP_LOG_KEY = 'pawtrack_otp_requests';
    const OTP_MIN_GAP_MS = 60 * 1000;
    const OTP_MAX_PER_WINDOW = 3;
    const OTP_WINDOW_MS = 15 * 60 * 1000;
    const PH_MOBILE = /^(\+?63|0)9\d{9}$/;

    let authMode = 'signin';
    let session = null;
    let resolveRun = 0;
    // True from a verified reset code until the new password is saved: the guardian is not logged in meanwhile
    let recoveryActive = false;
    let loginTurnstileId = null;
    let loginTurnstileToken = null;

    // Email links and Google come back with ?code=… (or ?error=…)
    const authParams = new URLSearchParams(window.location.search);
    const returnedWithCode = authParams.has('code');
    let pendingAuthError = authParams.get('error_description') || authParams.get('error');

    const setStatus = (el, message, isError = false) => {
      if (!el) return;
      el.textContent = message || '';
      el.classList.toggle('is-error', !!isError);
    };

    const normalizePhone = (value) => String(value || '').replace(/[\s\-().]/g, '');

    // Mobile fields show a fixed "+63" prefix and take digits only: a pasted +63… or leading 0 is dropped
    const cleanMobileDigits = (value) => {
      let digits = String(value || '').replace(/\D/g, '');
      if (digits.length > 10 && digits.startsWith('63')) digits = digits.slice(2);
      if (digits.startsWith('0')) digits = digits.slice(1);
      return digits.slice(0, 10);
    };
    const mobileFieldValue = (input) => {
      const digits = cleanMobileDigits(input?.value);
      return digits ? `+63${digits}` : '';
    };
    document.querySelectorAll('input[data-ph-mobile]').forEach(input => {
      input.addEventListener('input', () => {
        const cleaned = cleanMobileDigits(input.value);
        if (input.value !== cleaned) input.value = cleaned;
      });
    });

    const turnstileTheme = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

    // Supabase error codes -> wording a pet owner understands
    const friendlyAuthError = (error) => {
      const code = error && (error.code || '');
      const message = (error && error.message) || '';
      if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'Incorrect email or password.';
      if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) return 'Please confirm your email first. Check your inbox for the link we sent.';
      if (code === 'captcha_failed' || /captcha/i.test(message)) return 'Security check failed. Please complete it again.';
      if (code === 'user_already_exists' || /already registered/i.test(message)) return 'An account with this email already exists. Try logging in instead.';
      if (code === 'weak_password' || /password should/i.test(message)) return 'Please choose a stronger password (at least 8 characters).';
      if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
      return message || 'Something went wrong. Please try again.';
    };

    if (!window.supabase || !config) {
      this.supabase = null;
      this.openLoginDialog = () => {
        if (authLanding) authLanding.style.display = 'flex';
        document.body.classList.add('auth-locked');
        setStatus(loginStatus, 'Sign-in services did not load. Check your connection and refresh.', true);
      };
      return;
    }

    this.supabase = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const waitForTurnstile = (timeoutMs = 10000) => new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (window.turnstile) return resolve();
        if (Date.now() - started > timeoutMs) return reject(new Error('Security check did not load. Check your connection and refresh.'));
        setTimeout(tick, 100);
      };
      tick();
    });

    // Turnstile tokens are single-use, so the widget is reset after every attempt
    const resetLoginTurnstile = () => {
      loginTurnstileToken = null;
      if (window.turnstile && loginTurnstileId !== null) window.turnstile.reset(loginTurnstileId);
    };

    const renderLoginTurnstile = async () => {
      try {
        await waitForTurnstile();
        if (loginTurnstileId !== null) {
          resetLoginTurnstile();
          return;
        }
        loginTurnstileId = window.turnstile.render(loginTurnstileEl, {
          sitekey: config.turnstileSiteKey,
          theme: turnstileTheme(),
          size: 'flexible', // stretches to the card width, matching the Log in button
          callback: (token) => {
            loginTurnstileToken = token;
            if (loginStatus && loginStatus.classList.contains('is-error') && /security check/i.test(loginStatus.textContent)) setStatus(loginStatus, '');
          },
          'expired-callback': () => { loginTurnstileToken = null; },
          'error-callback': () => setStatus(loginStatus, 'Security check failed to load. Please refresh and try again.', true)
        });
      } catch (err) {
        setStatus(loginStatus, err.message, true);
      }
    };

    const requireTurnstileToken = () => {
      if (loginTurnstileToken) return loginTurnstileToken;
      setStatus(loginStatus, 'Please complete the security check below the Log in button.', true);
      return null;
    };

    const setBusy = (busy) => {
      [loginSubmit, loginGoogleBtn, loginForgotBtn, loginModeToggle].forEach(btn => { if (btn) btn.disabled = busy; });
    };

    const setAuthMode = (mode) => {
      authMode = mode;
      const isSignup = mode === 'signup';
      authLanding?.classList.toggle('is-signup', isSignup);
      authLanding?.querySelectorAll('[data-signup-only]').forEach(el => { el.hidden = !isSignup; });
      authLanding?.querySelectorAll('[data-signin-only]').forEach(el => { el.hidden = isSignup; });
      if (loginTitle) loginTitle.textContent = isSignup ? 'Create your account' : 'Welcome back';
      if (loginSub) loginSub.textContent = isSignup
        ? 'Shelters use your name and mobile number to contact you if your pet is found.'
        : 'Sign in to manage your pets and recovery alerts.';
      if (loginSubmit) loginSubmit.textContent = isSignup ? 'Create account' : 'Log in';
      if (loginModeText) loginModeText.textContent = isSignup ? 'Already have an account?' : 'New to PawTrack?';
      if (loginModeToggle) loginModeToggle.textContent = isSignup ? 'Log in' : 'Create an account';
      setStatus(loginStatus, '');
    };

    const completeSignIn = (guardian, user) => {
      window.pawStore.setGoogleUser(this.toGuardianProfile({
        id: guardian.id,
        name: guardian.full_name,
        email: guardian.email,
        phone: guardian.phone,
        picture: guardian.avatar_url || (user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture)) || null
      }));
      this.setGuestMode(false);
      this.updateGoogleAuthUI();
      this.renderCurrentView();
      this.hideStartScreen();
      window.notifManager.closeModal('register-dialog-modal');

      let isFresh = false;
      try {
        isFresh = sessionStorage.getItem(FRESH_SIGNIN_KEY) === '1';
        sessionStorage.removeItem(FRESH_SIGNIN_KEY);
      } catch (e) {}
      if (isFresh) window.notifManager.showToast(`Signed in as ${guardian.full_name}.`, 'success');

      this.syncFoundAlerts();
      if (!this.foundAlertTimer) {
        this.foundAlertTimer = setInterval(() => this.syncFoundAlerts(), 60000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) this.syncFoundAlerts(); });
      }
    };

    // First Google sign-in: ask for the name and phone shelters need
    const openRegisterDialog = (user) => {
      const meta = user.user_metadata || {};
      if (registerEmail) registerEmail.value = user.email || '';
      if (registerName) registerName.value = meta.full_name || meta.name || '';
      if (registerPhone) registerPhone.value = '';
      setStatus(registerStatus, '');
      if (registerSubmit) registerSubmit.disabled = false;
      window.notifManager.openModal('register-dialog-modal');
      setTimeout(() => (registerName && registerName.value ? registerPhone : registerName)?.focus(), 150);
    };

    const resolveGuardian = async () => {
      const run = ++resolveRun;
      const user = session && session.user;

      if (!user) {
        window.pawStore.setGoogleUser(null);
        this.updateGoogleAuthUI();
        this.showStartScreenIfNeeded();
        return;
      }

      const { data: guardian, error } = await this.supabase
        .from('guardians')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (run !== resolveRun) return; // a newer auth event took over

      if (error) {
        // Offline or Supabase unreachable: keep any cached profile rather than signing the guardian out
        console.warn('[Auth] Could not load guardian profile:', error.message);
        if (!window.pawStore.getGoogleUser()) this.showStartScreenIfNeeded();
        return;
      }

      if (guardian) {
        completeSignIn(guardian, user);
        return;
      }

      // Email sign-ups are normally recorded by the database; fall back to the sign-up details if not
      const meta = user.user_metadata || {};
      if (meta.signup_source === 'pawtrack_owner' && meta.full_name && PH_MOBILE.test(normalizePhone(meta.phone))) {
        const { data: created, error: insertError } = await this.supabase
          .from('guardians')
          .insert({ id: user.id, email: user.email, full_name: meta.full_name, phone: normalizePhone(meta.phone) })
          .select('*')
          .single();
        if (!insertError && created) {
          completeSignIn(created, user);
          return;
        }
      }
      openRegisterDialog(user);
    };

    const openLoginDialog = () => {
      if (onetapPrompt) onetapPrompt.style.display = 'none';
      if (warningModal) warningModal.style.display = 'none';
      if (authLanding) authLanding.style.display = 'flex';
      // Guests reached this from inside the app, so they may close it again
      if (authLandingClose) authLandingClose.style.display = this.isGuestMode() ? '' : 'none';
      document.body.classList.add('auth-locked');
      setBusy(false);
      if (pendingAuthError) {
        setStatus(loginStatus, pendingAuthError, true);
        pendingAuthError = null;
      }
      renderLoginTurnstile();
    };
    this.openLoginDialog = openLoginDialog;

    // Browser autofill stays off: the email and password fields are read-only until the guardian focuses them
    authLanding?.querySelectorAll('[data-no-autofill]').forEach(input => {
      input.addEventListener('focus', () => input.removeAttribute('readonly'), { once: true });
      input.addEventListener('pointerdown', () => input.removeAttribute('readonly'), { once: true });
    });

    loginModeToggle?.addEventListener('click', () => {
      setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
      (authMode === 'signup' ? loginNameInput : loginEmailInput)?.focus();
    });

    loginPasswordToggle?.addEventListener('click', () => {
      const show = loginPasswordInput.type === 'password';
      loginPasswordInput.type = show ? 'text' : 'password';
      loginPasswordToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      loginPasswordToggle.setAttribute('aria-pressed', String(show));
    });

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (loginEmailInput?.value || '').trim().toLowerCase();
      const password = loginPasswordInput?.value || '';
      const isSignup = authMode === 'signup';

      if (isSignup && (loginNameInput?.value || '').trim().length < 2) {
        setStatus(loginStatus, 'Please enter your full name.', true);
        loginNameInput?.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus(loginStatus, 'Please enter a valid email address.', true);
        loginEmailInput?.focus();
        return;
      }
      const phone = mobileFieldValue(loginPhoneInput);
      if (isSignup && !PH_MOBILE.test(phone)) {
        setStatus(loginStatus, 'Please enter a valid Philippine mobile number, e.g. 0917 123 4567.', true);
        loginPhoneInput?.focus();
        return;
      }
      if (!password || (isSignup && password.length < 8)) {
        setStatus(loginStatus, isSignup ? 'Please choose a password with at least 8 characters.' : 'Please enter your password.', true);
        loginPasswordInput?.focus();
        return;
      }
      const captchaToken = requireTurnstileToken();
      if (!captchaToken) return;

      setBusy(true);
      try {
        if (isSignup) {
          setStatus(loginStatus, 'Creating your account…');
          const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
              captchaToken,
              emailRedirectTo: window.location.origin + window.location.pathname,
              data: { signup_source: 'pawtrack_owner', full_name: loginNameInput.value.trim(), phone }
            }
          });
          if (error) throw error;
          if (data.session) {
            sessionStorage.setItem(FRESH_SIGNIN_KEY, '1');
            setStatus(loginStatus, '');
          } else {
            setAuthMode('signin');
            if (loginPasswordInput) loginPasswordInput.value = '';
            setStatus(loginStatus, `We sent a confirmation link to ${email}. Open it to activate your account, then log in.`);
          }
        } else {
          setStatus(loginStatus, 'Signing you in…');
          sessionStorage.setItem(FRESH_SIGNIN_KEY, '1');
          const { error } = await this.supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
          if (error) {
            sessionStorage.removeItem(FRESH_SIGNIN_KEY);
            throw error;
          }
          if (loginPasswordInput) loginPasswordInput.value = '';
          setStatus(loginStatus, '');
        }
      } catch (err) {
        setStatus(loginStatus, friendlyAuthError(err), true);
      } finally {
        setBusy(false);
        resetLoginTurnstile();
      }
    });

    // Forgot password: email -> 6-digit code (Supabase emails it through Brevo SMTP) -> set a new password
    const forgotEmailForm = document.getElementById('forgot-email-form');
    const forgotOtpForm = document.getElementById('forgot-otp-form');
    const forgotEmailInput = document.getElementById('forgot-email');
    const forgotOtpInput = document.getElementById('forgot-otp');
    const forgotOtpEmail = document.getElementById('forgot-otp-email');
    const forgotSendBtn = document.getElementById('forgot-send-btn');
    const forgotVerifyBtn = document.getElementById('forgot-verify-btn');
    const forgotResendBtn = document.getElementById('forgot-resend-btn');
    const forgotStatus = document.getElementById('forgot-status');
    const forgotTurnstileEl = document.getElementById('forgot-turnstile');
    let forgotTurnstileId = null;
    let forgotTurnstileToken = null;

    const forgotTitle = document.getElementById('forgot-title');
    const forgotBackBtn = document.getElementById('forgot-back-btn');
    const forgotModal = document.getElementById('forgot-password-modal');

    const showForgotStep = (step) => {
      if (forgotEmailForm) forgotEmailForm.hidden = step !== 'email';
      if (forgotOtpForm) forgotOtpForm.hidden = step !== 'otp';
      if (forgotBackBtn) forgotBackBtn.hidden = step !== 'otp';
      if (forgotTitle) forgotTitle.textContent = step === 'otp' ? 'Check your email' : 'Forgot your password?';
      document.querySelectorAll('#forgot-steps li').forEach(li => {
        const order = ['email', 'otp', 'password'];
        const idx = order.indexOf(li.dataset.step);
        const current = order.indexOf(step);
        li.classList.toggle('is-active', idx === current);
        li.classList.toggle('is-done', idx < current);
        const badge = li.querySelector('span');
        if (badge) badge.textContent = idx < current ? '\u2713' : String(idx + 1);
      });
      setStatus(forgotStatus, '');
    };

    // Buttons show a spinner while a request is in flight
    const setBtnLoading = (btn, loading) => {
      if (!btn) return;
      btn.classList.toggle('is-loading', loading);
      btn.disabled = loading;
    };

    const resetForgotTurnstile = () => {
      forgotTurnstileToken = null;
      if (window.turnstile && forgotTurnstileId !== null) window.turnstile.reset(forgotTurnstileId);
    };

    const renderForgotTurnstile = async () => {
      try {
        await waitForTurnstile();
        if (forgotTurnstileId !== null) {
          resetForgotTurnstile();
          return;
        }
        forgotTurnstileId = window.turnstile.render(forgotTurnstileEl, {
          sitekey: config.turnstileSiteKey,
          theme: turnstileTheme(),
          size: 'flexible',
          callback: (token) => { forgotTurnstileToken = token; },
          'expired-callback': () => { forgotTurnstileToken = null; },
          'error-callback': () => setStatus(forgotStatus, 'Security check failed to load. Please refresh and try again.', true)
        });
      } catch (err) {
        setStatus(forgotStatus, err.message, true);
      }
    };

    // Rate limit for code requests from this browser: 1 per minute, 3 per 15 minutes.
    // Supabase enforces its own limits server-side.
    const readOtpLog = () => {
      try {
        const log = JSON.parse(localStorage.getItem(OTP_LOG_KEY) || '[]');
        return Array.isArray(log) ? log.filter(t => Date.now() - t < OTP_WINDOW_MS) : [];
      } catch (err) { return []; }
    };
    const otpWaitMs = () => {
      const log = readOtpLog();
      if (!log.length) return 0;
      let wait = Math.max(0, OTP_MIN_GAP_MS - (Date.now() - log[log.length - 1]));
      if (log.length >= OTP_MAX_PER_WINDOW) wait = Math.max(wait, OTP_WINDOW_MS - (Date.now() - log[0]));
      return wait;
    };
    const recordOtpRequest = () => {
      try { localStorage.setItem(OTP_LOG_KEY, JSON.stringify([...readOtpLog(), Date.now()])); } catch (err) {}
    };
    const formatWait = (ms) => {
      const secs = Math.ceil(ms / 1000);
      return secs > 90 ? `${Math.ceil(secs / 60)} minutes` : `${secs} seconds`;
    };

    let otpCooldownTimer = null;
    const tickOtpCooldown = () => {
      clearInterval(otpCooldownTimer);
      const apply = () => {
        const wait = otpWaitMs();
        if (forgotSendBtn && !forgotSendBtn.classList.contains('is-loading')) {
          forgotSendBtn.disabled = wait > 0;
          forgotSendBtn.textContent = wait > 0 ? `Send code again in ${formatWait(wait)}` : 'Send code';
        }
        if (forgotResendBtn) {
          forgotResendBtn.disabled = wait > 0;
          forgotResendBtn.textContent = wait > 0 ? `Send again in ${Math.ceil(wait / 1000)}s` : 'Send again';
        }
        if (wait <= 0) clearInterval(otpCooldownTimer);
      };
      apply();
      otpCooldownTimer = setInterval(apply, 1000);
    };

    loginForgotBtn?.addEventListener('click', () => {
      if (forgotEmailInput) forgotEmailInput.value = (loginEmailInput?.value || '').trim();
      if (forgotOtpInput) forgotOtpInput.value = '';
      showForgotStep('email');
      window.notifManager.openModal('forgot-password-modal');
      tickOtpCooldown();
      renderForgotTurnstile();
      setTimeout(() => forgotEmailInput?.focus(), 150);
    });

    forgotOtpInput?.addEventListener('input', () => {
      forgotOtpInput.value = forgotOtpInput.value.replace(/\D/g, '').slice(0, 6);
      if (forgotOtpInput.value.length === 6) forgotOtpForm?.requestSubmit();
    });

    forgotBackBtn?.addEventListener('click', () => {
      showForgotStep('email');
      setTimeout(() => forgotEmailInput?.focus(), 50);
    });

    // Escape and a click on the dim backdrop close the forgot-password dialog
    forgotModal?.addEventListener('mousedown', (e) => {
      if (e.target === forgotModal) window.notifManager.closeModal('forgot-password-modal');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && forgotModal?.classList.contains('active')) window.notifManager.closeModal('forgot-password-modal');
    });

    forgotResendBtn?.addEventListener('click', () => {
      showForgotStep('email');
      resetForgotTurnstile();
      setStatus(forgotStatus, 'Complete the security check, then tap "Send code" again.');
    });

    forgotEmailForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (forgotEmailInput?.value || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus(forgotStatus, 'Enter a valid email address.', true);
        forgotEmailInput?.focus();
        return;
      }
      const wait = otpWaitMs();
      if (wait > 0) {
        setStatus(forgotStatus, `Too many code requests. Please try again in ${formatWait(wait)}.`, true);
        tickOtpCooldown();
        return;
      }
      if (!forgotTurnstileToken) {
        setStatus(forgotStatus, 'Please complete the security check first.', true);
        return;
      }

      setBtnLoading(forgotSendBtn, true);
      setStatus(forgotStatus, 'Sending code…');
      recordOtpRequest();
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, { captchaToken: forgotTurnstileToken });
      resetForgotTurnstile();
      setBtnLoading(forgotSendBtn, false);
      tickOtpCooldown();
      if (error) {
        const limited = error.status === 429 || /rate.?limit|too many|seconds/i.test(`${error.code || ''} ${error.message || ''}`);
        setStatus(forgotStatus, limited ? 'Too many code requests. Please wait a minute and try again.' : friendlyAuthError(error), true);
        return;
      }
      if (forgotOtpEmail) forgotOtpEmail.textContent = email;
      showForgotStep('otp');
      setTimeout(() => forgotOtpInput?.focus(), 100);
    });

    forgotOtpForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (forgotOtpEmail?.textContent || '').trim();
      const token = (forgotOtpInput?.value || '').trim();
      if (!/^\d{6}$/.test(token)) {
        setStatus(forgotStatus, 'Enter the 6-digit code from your email.', true);
        forgotOtpInput?.focus();
        return;
      }

      setBtnLoading(forgotVerifyBtn, true);
      setStatus(forgotStatus, 'Verifying…');
      // Verifying creates a temporary session; hold the login back until the new password is saved
      recoveryActive = true;
      try { sessionStorage.setItem(RECOVERY_KEY, '1'); } catch (err) {}
      const { error } = await this.supabase.auth.verifyOtp({ email, token, type: 'recovery' });
      setBtnLoading(forgotVerifyBtn, false);
      if (error) {
        recoveryActive = false;
        try { sessionStorage.removeItem(RECOVERY_KEY); } catch (err) {}
        setStatus(forgotStatus, 'That code is incorrect or has expired. Check the code or send a new one.', true);
        forgotOtpInput?.select();
        return;
      }
      if (forgotOtpInput) forgotOtpInput.value = '';
      setStatus(forgotStatus, '');
      window.notifManager.closeModal('forgot-password-modal');
      openResetPasswordModal();
    });

    loginGoogleBtn?.addEventListener('click', async () => {
      if (!requireTurnstileToken()) return;
      setBusy(true);
      setStatus(loginStatus, 'Redirecting to Google…');
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
        setBusy(false);
        resetLoginTurnstile();
        setStatus(loginStatus, friendlyAuthError(error), true);
      }
    });

    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = session && session.user;
      const name = (registerName?.value || '').trim();
      const phone = mobileFieldValue(registerPhone);

      if (!user) {
        window.notifManager.closeModal('register-dialog-modal');
        openLoginDialog();
        return;
      }
      if (name.length < 2) {
        setStatus(registerStatus, 'Please enter your full name.', true);
        registerName?.focus();
        return;
      }
      if (!PH_MOBILE.test(phone)) {
        setStatus(registerStatus, 'Please enter a valid Philippine mobile number, e.g. 0917 123 4567.', true);
        registerPhone?.focus();
        return;
      }

      if (registerSubmit) registerSubmit.disabled = true;
      setStatus(registerStatus, 'Creating your account…');
      const meta = user.user_metadata || {};
      const { data: guardian, error } = await this.supabase
        .from('guardians')
        .insert({ id: user.id, email: user.email, full_name: name, phone, avatar_url: meta.avatar_url || meta.picture || null })
        .select('*')
        .single();
      if (registerSubmit) registerSubmit.disabled = false;
      if (error) {
        setStatus(registerStatus, `Could not create your account: ${error.message}`, true);
        return;
      }
      setStatus(registerStatus, '');
      completeSignIn(guardian, user);
      window.notifManager.showToast(`Welcome to PawTrack, ${guardian.full_name}!`, 'success');
    });

    // Live password requirements for the reset form
    const passwordRules = {
      length: (pw) => pw.length >= 8,
      upper: (pw) => /[A-Z]/.test(pw),
      lower: (pw) => /[a-z]/.test(pw),
      number: (pw) => /\d/.test(pw),
      symbol: (pw) => /[^A-Za-z0-9\s]/.test(pw),
      match: (pw, confirm) => pw.length > 0 && pw === confirm
    };

    const updatePasswordRules = () => {
      const pw = resetInput?.value || '';
      const confirm = resetConfirm?.value || '';
      let allMet = true;
      document.querySelectorAll('#reset-password-rules li[data-rule]').forEach(li => {
        const met = passwordRules[li.dataset.rule](pw, confirm);
        li.classList.toggle('is-met', met);
        if (!met) allMet = false;
      });
      if (resetSubmit) resetSubmit.disabled = !allMet;
      return allMet;
    };
    resetInput?.addEventListener('input', updatePasswordRules);
    resetConfirm?.addEventListener('input', updatePasswordRules);

    document.querySelectorAll('[data-toggle-for]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.toggleFor);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.setAttribute('aria-pressed', String(show));
      });
    });

    // Leaving the set-password step abandons the reset: end the temporary session
    document.getElementById('reset-cancel-btn')?.addEventListener('click', async () => {
      await this.supabase.auth.signOut({ scope: 'local' });
      recoveryActive = false;
      try { sessionStorage.removeItem(RECOVERY_KEY); } catch (err) {}
      session = null;
      window.notifManager.closeModal('reset-password-modal');
      window.pawStore.setGoogleUser(null);
      this.updateGoogleAuthUI();
      window.notifManager.showToast('Password reset cancelled.', 'info');
    });

    const openResetPasswordModal = () => {
      if (resetInput) resetInput.value = '';
      if (resetConfirm) resetConfirm.value = '';
      updatePasswordRules();
      setStatus(resetStatus, '');
      window.notifManager.openModal('reset-password-modal');
      setTimeout(() => resetInput?.focus(), 150);
    };

    resetForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!updatePasswordRules()) {
        setStatus(resetStatus, 'Please meet all the password requirements.', true);
        return;
      }
      const password = resetInput.value;
      setBtnLoading(resetSubmit, true);
      setStatus(resetStatus, 'Updating your password…');
      const { error } = await this.supabase.auth.updateUser({ password });
      setBtnLoading(resetSubmit, false);
      if (error) {
        updatePasswordRules();
        setStatus(resetStatus, friendlyAuthError(error), true);
        return;
      }

      // Password saved: end the recovery session and make the guardian log in with the new password
      const email = session?.user?.email || '';
      await this.supabase.auth.signOut({ scope: 'local' });
      recoveryActive = false;
      try { sessionStorage.removeItem(RECOVERY_KEY); } catch (err) {}
      session = null;
      if (resetInput) resetInput.value = '';
      if (resetConfirm) resetConfirm.value = '';
      setStatus(resetStatus, '');
      window.notifManager.closeModal('reset-password-modal');
      window.pawStore.setGoogleUser(null);
      this.updateGoogleAuthUI();
      setAuthMode('signin');
      openLoginDialog();
      if (loginEmailInput) loginEmailInput.value = email;
      if (loginPasswordInput) loginPasswordInput.value = '';
      window.notifManager.openModal('password-updated-modal');
      setTimeout(() => document.getElementById('password-updated-login-btn')?.focus(), 150);
    });

    // Password updated: continue to the log-in form with the email filled in
    document.getElementById('password-updated-login-btn')?.addEventListener('click', () => {
      window.notifManager.closeModal('password-updated-modal');
      loginPasswordInput?.removeAttribute('readonly');
      setTimeout(() => loginPasswordInput?.focus(), 100);
    });

    this.supabase.auth.onAuthStateChange((event, newSession) => {
      session = newSession;
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;

      // A reset-code session must not log the guardian in: keep the set-new-password step in front
      let pendingRecovery = false;
      try { pendingRecovery = sessionStorage.getItem(RECOVERY_KEY) === '1'; } catch (err) {}
      if (recoveryActive || (pendingRecovery && newSession)) {
        recoveryActive = true;
        if (event === 'INITIAL_SESSION' && newSession) openResetPasswordModal();
        return;
      }

      if (event === 'INITIAL_SESSION' && (returnedWithCode || authParams.has('error'))) {
        if (returnedWithCode && !newSession && !pendingAuthError) {
          pendingAuthError = 'That link was opened in a different browser or has expired. If you just confirmed your email, log in with your password.';
        }
        ['code', 'error', 'error_code', 'error_description', 'state'].forEach(key => authParams.delete(key));
        const query = authParams.toString();
        window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
      }

      if (event === 'PASSWORD_RECOVERY') {
        recoveryActive = true;
        try { sessionStorage.setItem(RECOVERY_KEY, '1'); } catch (err) {}
        openResetPasswordModal();
        return;
      }
      // Deferred: calling Supabase from inside this callback can deadlock the auth client
      setTimeout(resolveGuardian, 0);
    });
  }

  updateGoogleAuthUI() {
    const user = window.pawStore ? window.pawStore.getGoogleUser() : null;
    const loginBtn = document.getElementById('header-login-btn');
    const userBtn = document.getElementById('header-user-btn');
    const nameEl = document.getElementById('header-user-name');
    const avatarCircle = document.getElementById('header-avatar-circle');
    const dropdownName = document.getElementById('dropdown-user-name');
    const dropdownEmail = document.getElementById('dropdown-user-email');
    const dropdownAvatar = document.getElementById('dropdown-avatar-circle');

    const modalName = document.getElementById('guardian-modal-name');
    const modalEmail = document.getElementById('guardian-modal-email');
    const modalAvatar = document.getElementById('guardian-modal-avatar');

    const isLoggedIn = !!(user && user.name);

    if (isLoggedIn) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userBtn) userBtn.style.display = 'inline-flex';
      const short = user.shortName || user.name || 'User';
      const initial = user.avatarInitial || (user.name ? user.name[0].toUpperCase() : 'G');

      if (nameEl) nameEl.textContent = short;
      if (dropdownName) dropdownName.textContent = user.name || 'Google User';
      if (dropdownEmail) dropdownEmail.textContent = user.email || 'user@gmail.com';

      if (modalName) modalName.textContent = user.name || 'Google User';
      if (modalEmail) modalEmail.textContent = user.email || 'user@gmail.com';

      // Render profile picture in avatar containers
      const renderAvatar = (el) => {
        if (!el) return;
        if (user.picture) {
          el.innerHTML = `<img src="${user.picture}" alt="${user.name || 'User'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;" onerror="this.style.display='none'; this.parentElement.textContent='${initial}';" />`;
        } else {
          el.textContent = initial;
        }
      };

      renderAvatar(avatarCircle);
      renderAvatar(dropdownAvatar);
      renderAvatar(modalAvatar);

      const modalPhone = document.getElementById('guardian-modal-phone');
      const modalArea = document.getElementById('guardian-modal-area');
      const modalBackupPhone = document.getElementById('guardian-modal-backup-phone');

      if (modalPhone) modalPhone.textContent = user.phone || '+63 917 555 3829';
      if (modalArea) modalArea.textContent = user.area || 'National Capital Region (NCR)';
      if (modalBackupPhone) modalBackupPhone.textContent = user.backupPhone || 'None set';

      const regOwnerName = document.getElementById('reg-owner-name');
      if (regOwnerName && !regOwnerName.value) {
        regOwnerName.value = user.name;
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (userBtn) userBtn.style.display = 'none';
    }

    // Role Navigation Tabs: When logged out, only Home ('owner') and Report Pet ('report') are visible
    document.querySelectorAll('.role-tab-btn').forEach(btn => {
      const view = btn.dataset.view;
      if (view === 'owner' || view === 'report') {
        btn.style.display = '';
      } else {
        btn.style.display = isLoggedIn ? '' : 'none';
      }
    });
  }

  populateGuardianProfile(editMode = false) {
    const user = window.pawStore ? window.pawStore.getGoogleUser() : null;
    const viewSection = document.getElementById('guardian-profile-view-mode');
    const editSection = document.getElementById('guardian-profile-edit-form');
    const modalTitle = document.getElementById('guardian-modal-header-title');

    const name = (user && user.name) ? user.name : 'Dariushdave01';
    const email = (user && user.email) ? user.email : 'dariushdave01@gmail.com';
    const phone = (user && user.phone) ? user.phone : '+63 917 555 3829';
    const area = (user && user.area) ? user.area : 'National Capital Region (NCR)';
    const backupPhone = (user && user.backupPhone) ? user.backupPhone : '';
    const initial = (user && user.avatarInitial) || (name ? name[0].toUpperCase() : 'D');
    const picture = user && user.picture ? user.picture : null;

    // View Mode elements
    const viewName = document.getElementById('guardian-modal-name');
    const viewEmail = document.getElementById('guardian-modal-email');
    const viewPhone = document.getElementById('guardian-modal-phone');
    const viewArea = document.getElementById('guardian-modal-area');
    const viewBackup = document.getElementById('guardian-modal-backup-phone');
    const viewAvatar = document.getElementById('guardian-modal-avatar');
    const petCount = document.getElementById('profile-pet-count');

    if (viewName) viewName.textContent = name;
    if (viewEmail) viewEmail.textContent = email;
    if (viewPhone) viewPhone.textContent = phone;
    if (viewArea) viewArea.textContent = area;
    if (viewBackup) viewBackup.textContent = backupPhone || 'None set';
    if (petCount && window.pawStore) {
      const pets = window.pawStore.getPets();
      petCount.textContent = `${pets.length} Registered Pet${pets.length === 1 ? '' : 's'}`;
    }

    const renderAvatarBox = (boxEl, pic, init) => {
      if (!boxEl) return;
      if (pic) {
        boxEl.innerHTML = `<img src="${pic}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;" onerror="this.style.display='none'; this.parentElement.textContent='${init}';" />`;
      } else {
        boxEl.textContent = init;
      }
    };

    renderAvatarBox(viewAvatar, picture, initial);

    // Edit Mode Inputs
    const editName = document.getElementById('edit-guardian-name-input');
    const editPhone = document.getElementById('edit-guardian-phone-input');
    const editArea = document.getElementById('edit-guardian-area-input');
    const editBackup = document.getElementById('edit-guardian-backup-input');
    const editAvatarPreview = document.getElementById('edit-guardian-avatar-preview');

    if (editName) editName.value = name;
    if (editPhone) editPhone.value = phone;
    if (editArea) editArea.value = area;
    if (editBackup) editBackup.value = backupPhone;
    renderAvatarBox(editAvatarPreview, picture, initial);

    this.pendingGuardianAvatar = undefined;

    // Toggle view vs edit
    if (editMode) {
      if (viewSection) viewSection.style.display = 'none';
      if (editSection) editSection.style.display = 'block';
      if (modalTitle) modalTitle.textContent = 'Edit Guardian Profile';
      setTimeout(() => editName?.focus(), 100);
    } else {
      if (viewSection) viewSection.style.display = 'block';
      if (editSection) editSection.style.display = 'none';
      if (modalTitle) modalTitle.textContent = 'Pet Guardian Profile';
    }
  }

  initEventListeners() {
    window.addEventListener('hashchange', () => this.handleRoute());

    window.addEventListener('resize', () => {
      if ((this.currentView === 'owner' || this.currentView === 'map') && window.publicView && window.publicView.map) {
        window.publicView.map.invalidateSize();
      }
    });

    document.querySelectorAll('.role-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetView = e.currentTarget.dataset.view;
        if (targetView === 'report') {
          // Report Pet triggers modal directly, not a router view change
          return;
        }

        const user = window.pawStore ? window.pawStore.getGoogleUser() : null;
        const isLoggedIn = !!(user && user.name);

        if (!isLoggedIn && targetView !== 'owner') {
          e.preventDefault();
          const warningModal = document.getElementById('google-required-modal');
          const onetapPrompt = document.getElementById('google-onetap-prompt');
          if (warningModal) {
            warningModal.style.display = 'flex';
          } else if (onetapPrompt) {
            onetapPrompt.style.display = 'block';
          }
          if (window.notifManager && typeof window.notifManager.showToast === 'function') {
            window.notifManager.showToast('Please sign in to access this section.', 'info');
          }
          return;
        }

        window.location.hash = targetView;
      });
    });

    // Global mobile stat card tap tooltip bubble
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.stat-card');
      if (card && window.innerWidth <= 768) {
        const label = card.getAttribute('data-label') || card.getAttribute('title') || card.querySelector('.stat-label')?.textContent;
        if (label) {
          const oldTooltip = document.querySelector('.stat-bubble-tooltip');
          if (oldTooltip) oldTooltip.remove();

          const tooltip = document.createElement('div');
          tooltip.className = 'stat-bubble-tooltip';
          tooltip.innerHTML = `${label}<div class="stat-bubble-arrow"></div>`;
          document.body.appendChild(tooltip);

          const rect = card.getBoundingClientRect();
          tooltip.style.left = `${rect.left + rect.width / 2}px`;
          tooltip.style.top = `${rect.top - 10}px`;

          setTimeout(() => {
            tooltip.classList.add('fade-out');
            setTimeout(() => tooltip.remove(), 250);
          }, 1800);
        }
      }
    });

    // Hardware collar scan global event listener
    document.addEventListener('pawtrack:hardware-scan', (e) => {
      const tag = e.detail?.nfcTag || 'NFC-882194';
      if (window.nfcScanner && typeof window.nfcScanner.scanAndReportTag === 'function') {
        window.nfcScanner.scanAndReportTag(tag);
      } else {
        window.location.hash = 'owner';
        setTimeout(() => {
          if (window.reportManager) {
            window.reportManager.openReportModal('found', null, { nfcTag: tag });
          }
        }, 200);
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  handleRoute() {
    let hash = window.location.hash.replace('#', '');
    const user = window.pawStore ? window.pawStore.getGoogleUser() : null;
    const isLoggedIn = !!(user && user.name);

    // If logged out, only 'owner' (Home) is accessible. Any other view redirects to 'owner'.
    if (!isLoggedIn && hash && hash !== 'owner') {
      window.location.hash = 'owner';
      const warningModal = document.getElementById('google-required-modal');
      const onetapPrompt = document.getElementById('google-onetap-prompt');
      if (warningModal) {
        warningModal.style.display = 'flex';
      } else if (onetapPrompt) {
        onetapPrompt.style.display = 'block';
      }
      if (window.notifManager && typeof window.notifManager.showToast === 'function') {
        window.notifManager.showToast('Please sign in to access this section.', 'info');
      }
      return;
    }

    if (hash === 'map') {
      hash = 'owner';
    }

    if (!hash || !this.views[hash]) {
      hash = 'owner';
    }

    this.currentView = hash;

    document.querySelectorAll('.role-tab-btn').forEach(btn => {
      if (btn.dataset.view === hash) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.renderCurrentView();
  }

  renderCurrentView() {
    const container = document.getElementById('app-viewport');
    if (!container) return;

    if (this.views[this.currentView]) {
      this.views[this.currentView].render(container);
    }
  }

  // Pulls "your pet was found" alerts that finders sent from the tap page (stored in Supabase) into the notification list
  async syncFoundAlerts() {
    if (!this.supabase || !window.pawStore || !window.pawStore.getGoogleUser()) return;
    const { data, error } = await this.supabase
      .from('notifications')
      .select('id, title, message, pet_name, location, created_at')
      .eq('type', 'sighting_verification')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !data) return;

    const known = new Set(window.pawStore.getNotifications().map((n) => n.id));
    const fresh = data.filter((row) => !known.has('sb-' + row.id)).reverse(); // oldest first so the newest ends on top
    fresh.forEach((row) => {
      const phone = (row.message.match(/Finder phone: ([^.]+)/) || [])[1] || '';
      const note = (row.message.match(/Message: "([^"]*)"/) || [])[1] || '';
      const pet = window.pawStore.getPets().find((p) => p.name === row.pet_name);
      window.pawStore.addNotification({
        id: 'sb-' + row.id,
        title: row.title,
        message: row.message,
        type: 'pet_found_match',
        petId: pet ? pet.id : undefined,
        petName: row.pet_name,
        nfcTag: pet ? pet.nfcTag : undefined,
        finderName: 'Community Good Samaritan',
        finderPhone: phone.trim(),
        finderNotes: note,
        location: row.location,
        timestamp: row.created_at
      });
    });
    if (fresh.length && window.notifManager) {
      window.notifManager.showToast(`${fresh[fresh.length - 1].title}`, 'success', 7000);
    }
  }

  updateNotifBadge() {
    const notifs = window.pawStore.getNotifications();
    const unread = notifs.filter(n => !n.read).length;
    const badge = document.getElementById('notif-count-badge');
    const dropdownCount = document.getElementById('notif-dropdown-count');

    if (badge) {
      if (unread > 0) {
        badge.innerText = unread;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (dropdownCount) {
      dropdownCount.innerText = unread;
      dropdownCount.style.display = unread > 0 ? 'inline-block' : 'none';
    }
  }

  // Sidebar drawer (mobile/tablet): hamburger opens it; backdrop, Escape, or navigating closes it
  initSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const backdrop = document.getElementById('sidebar-backdrop');
    const sidebar = document.getElementById('app-sidebar');

    const setOpen = (open) => {
      document.body.classList.toggle('sidebar-open', open);
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    toggleBtn?.addEventListener('click', () => setOpen(!document.body.classList.contains('sidebar-open')));
    backdrop?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
    window.addEventListener('hashchange', () => setOpen(false));
    sidebar?.querySelectorAll('.role-tab-btn, .brand-logo').forEach(link => {
      link.addEventListener('click', () => setOpen(false));
    });
  }

  initModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // Register Pet Form Submission
    const regForm = document.getElementById('register-pet-form');
    if (regForm) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!window.pawStore.isLoggedIn()) {
          const onetap = document.getElementById('google-onetap-prompt');
          if (onetap) onetap.style.display = 'block';
          const warningModal = document.getElementById('google-required-modal');
          if (warningModal) warningModal.style.display = 'flex';
          if (window.notifManager) {
            window.notifManager.showToast('Please sign in with Google to complete pet registration.', 'warning', 3500);
          }
          return;
        }

        const name = (document.getElementById('reg-pet-name')?.value || '').trim() || 'Pet';
        const species = document.getElementById('reg-pet-species')?.value || 'Dog';
        const breed = (document.getElementById('reg-pet-breed')?.value || '').trim() || 'Mixed';
        const gender = document.getElementById('reg-pet-gender')?.value || 'Male';
        const color = (document.getElementById('reg-pet-color')?.value || '').trim() || 'Brown';

        const ageValue = parseInt(document.getElementById('reg-pet-age')?.value, 10);
        const ageUnit = document.getElementById('reg-pet-age-unit')?.value === 'months' ? 'months' : 'years';
        if (!Number.isFinite(ageValue) || ageValue < 0 || ageValue > 50) {
          window.notifManager.showToast("Please enter your pet's age (0 to 50).", 'warning', 3500);
          document.getElementById('reg-pet-age')?.focus();
          return;
        }
        const ageMonths = ageUnit === 'years' ? ageValue * 12 : ageValue;
        const age = `${ageValue} ${ageValue === 1 ? ageUnit.slice(0, -1) : ageUnit}`;

        const user = window.pawStore.getGoogleUser();
        const ownerName = document.getElementById('reg-owner-name')?.value || (user ? user.name : 'Pet Guardian');
        const ownerPhone = document.getElementById('reg-owner-phone')?.value || '+63 917 555 3829';
        const ownerEmail = (user ? user.email : 'guardian@pawtrack.com');
        const ownerAddress = document.getElementById('reg-owner-address')?.value || 'Metro Manila, Philippines';

        const defaultPhotos = {
          Dog: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80',
          Cat: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
          Other: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80'
        };

        // Step 2: the pet is only saved once an NFC tag has been scanned and linked to it
        document.getElementById('register-pet-modal')?.classList.remove('active');
        window.nfcLink.open({
          name,
          species,
          breed,
          gender,
          color,
          age,
          ageMonths,
          photoUrl: document.getElementById('reg-pet-photo')?.value || defaultPhotos[species] || defaultPhotos.Dog,
          owner: { name: ownerName, phone: ownerPhone, email: ownerEmail, address: ownerAddress }
        });
      });
    }

    // Report Lost Form Submission
    const lostForm = document.getElementById('report-lost-form');
    if (lostForm) {
      lostForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const petId = document.getElementById('report-lost-pet-id')?.value || lostForm.dataset.petId;
        const location = document.getElementById('report-lost-location')?.value || 'Quezon City, Metro Manila';
        const notes = document.getElementById('report-lost-notes')?.value || '';

        if (petId) {
          const pet = window.pawStore.getPetById(petId);
          window.pawStore.updatePetStatus(petId, 'lost', { lastSeenLocation: location, lostNotes: notes });

          window.pawStore.addNotification({
            type: 'broadcast',
            title: `Missing Pet Alert: "${pet ? pet.name : 'Pet'}"`,
            message: `Guardian reported ${pet ? pet.name : 'pet'} (${pet ? pet.nfcTag : 'NFC'}) missing near ${location}. All municipal scanners and responder patrols alerted.`,
            petId
          });

          window.notifManager.closeModal('report-lost-modal');
          lostForm.reset();

          if (window.notifManager) {
            window.notifManager.showToast(`Missing Alert Broadcasted for "${pet ? pet.name : 'Pet'}". Pinned to Incident Map.`, 'danger', 4500);
          }
        }
      });
    }

    // Report Found Stray Pet Form Submission
    const foundForm = document.getElementById('found-pet-form');
    if (foundForm) {
      foundForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const species = document.getElementById('found-species')?.value || 'Dog';
        const breed = document.getElementById('found-breed')?.value || 'Aspin / Mixed';
        const location = document.getElementById('found-location')?.value || 'Metro Manila';
        const nfc = (document.getElementById('found-nfc')?.value || '').trim().toUpperCase();
        const phone = document.getElementById('found-phone')?.value || '';

        let matchedPet = null;
        if (nfc) {
          matchedPet = window.pawStore.getPetByNFC(nfc);
        }

        // Create Sighting Record
        const sighting = {
          species,
          breed,
          location,
          reporterPhone: phone,
          reporterName: 'Community Resident',
          dateTimeSeen: new Date().toISOString(),
          photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=400&q=80',
          matchedPetId: matchedPet ? matchedPet.id : null,
          confidenceScore: matchedPet ? 98 : 88
        };

        // Run AI Multi-Trait Comparison
        const aiMatches = window.pawStore.runAiPetMatch(sighting);
        const topMatch = aiMatches[0];

        if (topMatch && topMatch.confidenceScore >= 75) {
          sighting.matchedPetId = topMatch.pet.id;
          sighting.confidenceScore = topMatch.confidenceScore;
          window.pawStore.addSighting(sighting);

          window.pawStore.addNotification({
            type: 'broadcast',
            title: `AI Sighting Match (${topMatch.confidenceScore}%): "${topMatch.pet.name}"`,
            message: `A community sighting in ${location} matched missing pet ${topMatch.pet.name} with ${topMatch.confidenceScore}% confidence.`,
            petId: topMatch.pet.id
          });

          if (window.notifManager) {
            window.notifManager.showToast(`AI Match Found! ${topMatch.confidenceScore}% similarity with missing pet "${topMatch.pet.name}". Guardian notified.`, 'success', 6000);
          }
        } else {
          window.pawStore.addSighting(sighting);
          window.pawStore.addNotification({
            type: 'broadcast',
            title: `Community Stray Sighting: ${species} (${breed})`,
            message: `Sighted near ${location}. Tag UID: ${nfc || 'None'}. Finder: ${phone || 'Community Member'}.`
          });

          if (window.notifManager) {
            window.notifManager.showToast('Community sighting pinned to Incident Map & Recovery Feed.', 'success', 4000);
          }
        }

        window.notifManager.closeModal('found-pet-modal');
        foundForm.reset();
      });
    }

    // Claiming Document Verification Form Submission
    const claimDocForm = document.getElementById('claiming-verification-form');
    if (claimDocForm) {
      claimDocForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const modal = document.getElementById('claiming-verification-modal');
        const impoundId = modal ? modal.dataset.impoundId : null;
        const petName = modal ? modal.dataset.petName : 'Pet';

        const govIdCheck = document.getElementById('claim-doc-govid')?.checked;
        const vaccineCheck = document.getElementById('claim-doc-vaccine')?.checked;
        const nfcCheck = document.getElementById('claim-doc-nfc')?.checked;
        const receiptNo = document.getElementById('claim-doc-receipt')?.value || 'OR-' + Math.floor(100000 + Math.random() * 900000);

        if (!govIdCheck || !vaccineCheck || !nfcCheck) {
          if (window.notifManager) {
            window.notifManager.showToast('Please verify and check all mandatory redemption credentials.', 'warning');
          }
          return;
        }

        const documents = {
          govIdVerified: true,
          vaccineBookVerified: true,
          nfcPassVerified: true,
          feeReceiptNo: receiptNo,
          verifiedAt: new Date().toISOString()
        };

        if (impoundId) {
          window.pawStore.verifyClaimDocuments(impoundId, documents, receiptNo);
        }

        if (modal) modal.classList.remove('active');
        claimDocForm.reset();

        if (window.notifManager) {
          window.notifManager.showToast(`Claim verified! Pet "${petName}" successfully released to guardian.`, 'success', 5000);
        }
      });
    }
  }

  initPhotoUpload() {
    const fileInput = document.getElementById('reg-pet-photo-file');
    const hiddenInput = document.getElementById('reg-pet-photo');
    const dropZone = document.getElementById('reg-photo-upload-zone');
    const promptBox = document.getElementById('reg-photo-prompt');
    const previewBox = document.getElementById('reg-photo-preview');
    const previewImg = document.getElementById('reg-photo-preview-img');

    if (!fileInput || !hiddenInput) return;

    const handleFile = (file) => {
      if (!file || !file.type.startsWith('image/')) {
        if (window.notifManager) window.notifManager.showToast('Please select a valid image file (PNG, JPG, WEBP).', 'warning');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        if (window.notifManager) window.notifManager.showToast('Image is too large. Please select a photo under 8MB.', 'warning');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        hiddenInput.value = dataUrl;
        if (previewImg) previewImg.src = dataUrl;
        if (promptBox) promptBox.style.display = 'none';
        if (previewBox) previewBox.style.display = 'block';
      };
      reader.readAsDataURL(file);
    };

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    });

    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('dragover');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('dragover');
        }, false);
      });

      dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files[0]) {
          handleFile(dt.files[0]);
        }
      }, false);
    }
  }

  clearPhotoUpload() {
    const fileInput = document.getElementById('reg-pet-photo-file');
    const hiddenInput = document.getElementById('reg-pet-photo');
    const promptBox = document.getElementById('reg-photo-prompt');
    const previewBox = document.getElementById('reg-photo-preview');
    const previewImg = document.getElementById('reg-photo-preview-img');

    if (fileInput) fileInput.value = '';
    if (hiddenInput) hiddenInput.value = '';
    if (previewImg) previewImg.src = '';
    if (promptBox) promptBox.style.display = 'flex';
    if (previewBox) previewBox.style.display = 'none';
  }

  openLightbox(url, title = 'Pet Photo', caption = '') {
    const modal = document.getElementById('image-lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const t = document.getElementById('lightbox-title');
    const c = document.getElementById('lightbox-caption');

    if (modal && img) {
      img.src = url || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80';
      if (t) t.textContent = title;
      if (c) c.textContent = caption || 'Registered PawTrack Transponder Pass';
      modal.classList.add('active');
      if (window.lucide) window.lucide.createIcons({ root: modal });
    }
  }

  closeLightbox() {
    const modal = document.getElementById('image-lightbox-modal');
    if (modal) modal.classList.remove('active');
  }
}

// Escape closes the full-size photo viewer first, without also closing a dialog underneath it
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const viewer = document.getElementById('image-lightbox-modal');
  if (viewer && viewer.classList.contains('active')) {
    e.stopImmediatePropagation();
    if (window.pawApp) window.pawApp.closeLightbox();
    else viewer.classList.remove('active');
  }
}, true);

function bootstrapOwnerApp() {
  if (!window.pawApp) {
    window.pawApp = new App();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapOwnerApp);
} else {
  bootstrapOwnerApp();
}
