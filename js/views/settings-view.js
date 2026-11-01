/**
 * PawTrack Settings
 * Account details (name, email, phone, password), language, appearance, legal links and log out.
 * Changing the email sends a 6-digit code to the NEW address; changing the password reuses the
 * forgot-password dialog (code emailed to the account address, then a new password).
 */

class SettingsView {
  constructor() {
    this.emailInit = false;
    this.pendingEmail = '';
    this.lastEmailCode = 0;
    this.resendTimer = null;
    this.turnstileId = null;
    this.turnstileToken = null;
  }

  t(key, fallback) {
    return window.pawI18n ? window.pawI18n.t(key, fallback) : fallback;
  }

  esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // "Dela Cruz, Jayson D." (Last, First) or "Jayson D. Dela Cruz" (First Last) -> { first, last }
  splitName(full) {
    const name = String(full || '').trim().replace(/\s+/g, ' ');
    if (!name) return { first: '', last: '' };
    if (name.includes(',')) {
      const i = name.indexOf(',');
      return { first: name.slice(i + 1).trim(), last: name.slice(0, i).trim() };
    }
    const words = name.split(' ');
    if (words.length === 1) return { first: name, last: '' };
    return { first: words.slice(0, -1).join(' '), last: words[words.length - 1] };
  }

  // ─────────────────────────────────────────────────
  // PAGE
  // ─────────────────────────────────────────────────
  render(container) {
    const t = (k, d) => this.t(k, d);
    const user = (window.pawStore && window.pawStore.getGoogleUser()) || {};
    const lang = window.pawI18n ? window.pawI18n.getLang() : 'en';
    const theme = window.pawApp ? window.pawApp.getThemePreference() : 'dark';
    const parts = this.splitName(user.name);
    const initial = user.avatarInitial || (user.name ? user.name[0].toUpperCase() : 'G');
    const avatar = user.picture
      ? `<img src="${this.esc(user.picture)}" alt="" onerror="this.remove()" />`
      : this.esc(initial);

    const seg = (name, current, options) => `
      <div class="settings-seg" role="radiogroup">
        ${options.map((o) => `
          <button type="button" class="settings-seg-btn${o.value === current ? ' is-active' : ''}" role="radio" aria-checked="${o.value === current}" data-pref-${name}="${o.value}">
            ${o.icon ? `<i data-lucide="${o.icon}"></i>` : ''}<span>${o.label}</span>
          </button>`).join('')}
      </div>`;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>${t('settings.title', 'Settings')}</h1>
          <div class="view-subtitle">${t('settings.subtitle', 'Manage your account, language and appearance.')}</div>
        </div>
      </div>

      <div class="settings-page">
        <section class="glass-card settings-card">
          <div class="settings-card-head">
            <div class="settings-avatar">${avatar}</div>
            <div class="settings-card-head-text">
              <h2>${t('settings.account', 'Account')}</h2>
              <p>${t('settings.accountSub', 'Your sign-in and contact details.')}</p>
            </div>
          </div>

          <form class="settings-row" id="settings-name-form" novalidate>
            <div class="settings-row-label">
              <label for="settings-first-input">${t('settings.name', 'Name')}</label>
              <span>${t('settings.nameHint', 'Shelters and finders see this name when they contact you.')}</span>
            </div>
            <div class="settings-row-control settings-name-control">
              <input type="text" id="settings-first-input" value="${this.esc(parts.first)}" maxlength="50" autocomplete="given-name" placeholder="${t('settings.firstName', 'First name')}" aria-label="${t('settings.firstName', 'First name')}" />
              <input type="text" id="settings-last-input" value="${this.esc(parts.last)}" maxlength="50" autocomplete="family-name" placeholder="${t('settings.lastName', 'Last name')}" aria-label="${t('settings.lastName', 'Last name')}" />
              <button type="submit" class="btn btn-primary btn-sm" id="settings-name-save" disabled>${t('settings.save', 'Save')}</button>
            </div>
          </form>

          <div class="settings-row">
            <div class="settings-row-label">
              <label>${t('settings.email', 'Email')}</label>
              <span>${t('settings.emailHint', 'A code is sent to your new email to confirm the change.')}</span>
            </div>
            <div class="settings-row-control">
              <span class="settings-value" id="settings-email-value">${this.esc(user.email || '')}</span>
              <button type="button" class="btn btn-outline btn-sm" id="settings-email-btn">${t('settings.change', 'Change')}</button>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-row-label">
              <label>${t('settings.phone', 'Mobile number')}</label>
              <span>${t('settings.phoneHint', 'Shelters use this number to reach you.')}</span>
            </div>
            <div class="settings-row-control">
              <span class="settings-value">${this.esc(user.phone || t('settings.notSet', 'Not set'))}</span>
              <button type="button" class="btn btn-outline btn-sm" id="settings-phone-btn">${t('settings.edit', 'Edit')}</button>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-row-label">
              <label>${t('settings.password', 'Password')}</label>
              <span>${t('settings.passwordHint', "We'll email a 6-digit code to confirm it's you.")}</span>
            </div>
            <div class="settings-row-control">
              <span class="settings-value settings-dots" aria-hidden="true">••••••••</span>
              <button type="button" class="btn btn-outline btn-sm" id="settings-password-btn">${t('settings.change', 'Change')}</button>
            </div>
          </div>
        </section>

        <section class="glass-card settings-card">
          <div class="settings-card-head">
            <div class="settings-card-icon"><i data-lucide="sliders-horizontal"></i></div>
            <div class="settings-card-head-text">
              <h2>${t('settings.preferences', 'Preferences')}</h2>
              <p>${t('settings.preferencesSub', 'Choose how PawTrack looks and which language it uses.')}</p>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-row-label">
              <label>${t('settings.language', 'Language')}</label>
              <span>${t('settings.languageHint', 'Changes the language of the whole app.')}</span>
            </div>
            <div class="settings-row-control">
              ${seg('lang', lang, [
                { value: 'en', label: 'English', icon: 'languages' },
                { value: 'fil', label: 'Tagalog', icon: 'languages' }
              ])}
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-row-label">
              <label>${t('settings.appearance', 'Appearance')}</label>
              <span>${t('settings.appearanceHint', 'System default follows your device setting.')}</span>
            </div>
            <div class="settings-row-control">
              ${seg('theme', theme, [
                { value: 'light', label: t('settings.themeLight', 'Light'), icon: 'sun' },
                { value: 'dark', label: t('settings.themeDark', 'Dark'), icon: 'moon' },
                { value: 'system', label: t('settings.themeSystem', 'System default'), icon: 'monitor' }
              ])}
            </div>
          </div>
        </section>

        <section class="glass-card settings-card">
          <div class="settings-card-head">
            <div class="settings-card-icon"><i data-lucide="scale"></i></div>
            <div class="settings-card-head-text">
              <h2>${t('settings.legal', 'Legal')}</h2>
              <p>${t('settings.legalSub', 'How PawTrack works and how your data is handled.')}</p>
            </div>
          </div>
          <button type="button" class="settings-link-row" data-legal="terms">
            <i data-lucide="file-text"></i><span>${t('settings.terms', 'Terms and Conditions')}</span><i data-lucide="chevron-right"></i>
          </button>
          <button type="button" class="settings-link-row" data-legal="privacy">
            <i data-lucide="shield-check"></i><span>${t('settings.privacy', 'Privacy Policy')}</span><i data-lucide="chevron-right"></i>
          </button>
        </section>

        <button type="button" class="settings-logout-btn" id="settings-logout-btn">
          <i data-lucide="log-out"></i><span>${t('settings.logout', 'Log out')}</span>
        </button>
      </div>
    `;

    this.attach(container, user);
    if (window.lucide) window.lucide.createIcons({ root: container });
  }

  attach(container, user) {
    // Name
    const nameForm = container.querySelector('#settings-name-form');
    const firstInput = container.querySelector('#settings-first-input');
    const lastInput = container.querySelector('#settings-last-input');
    const nameSave = container.querySelector('#settings-name-save');
    const original = this.splitName(user.name);
    const syncSave = () => {
      const first = firstInput.value.trim();
      const last = lastInput.value.trim();
      nameSave.disabled = !first || (first === original.first && last === original.last);
    };
    firstInput?.addEventListener('input', syncSave);
    lastInput?.addEventListener('input', syncSave);
    nameForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveName(firstInput.value.trim(), lastInput.value.trim(), nameSave);
    });

    // Email, phone, password
    container.querySelector('#settings-email-btn')?.addEventListener('click', () => this.openEmailChange());
    container.querySelector('#settings-phone-btn')?.addEventListener('click', () => {
      window.notifManager.showToast(this.t('settings.phoneSoon', 'Changing your mobile number is coming soon.'), 'info');
    });
    container.querySelector('#settings-password-btn')?.addEventListener('click', () => this.openPasswordChange(user));

    // Language and appearance
    container.querySelectorAll('[data-pref-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.pawI18n && window.pawI18n.getLang() !== btn.dataset.prefLang) window.pawI18n.setLang(btn.dataset.prefLang, true);
      });
    });
    container.querySelectorAll('[data-pref-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.pawApp.setThemePreference(btn.dataset.prefTheme);
        container.querySelectorAll('[data-pref-theme]').forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-checked', String(on));
        });
      });
    });

    // Legal and log out
    container.querySelectorAll('[data-legal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.pawApp && window.pawApp.openLegalDocs) window.pawApp.openLegalDocs(btn.dataset.legal);
        else window.notifManager.openModal(btn.dataset.legal === 'privacy' ? 'privacy-policy-modal' : 'terms-modal');
      });
    });
    container.querySelector('#settings-logout-btn')?.addEventListener('click', () => window.pawApp.logOut());
  }

  // ─────────────────────────────────────────────────
  // NAME
  // ─────────────────────────────────────────────────
  async saveName(first, last, button) {
    const notify = (msg, type) => window.notifManager.showToast(msg, type);
    // "Last, First" keeps a multi-word last name like "Dela Cruz" separable from the first name
    const name = last && first ? `${last}, ${first}` : '';
    if (!first || !last) {
      notify(this.t('settings.nameShort', 'Please enter your first and last name.'), 'error');
      return;
    }
    const user = window.pawStore.getGoogleUser();
    if (!user) return;

    button.disabled = true;
    const sb = window.pawApp.supabase;
    if (sb && user.id) {
      const { error } = await sb.from('guardians').update({ full_name: name }).eq('id', user.id);
      if (error) {
        button.disabled = false;
        notify(this.t('settings.nameSaveFailed', 'Could not save your name. Please try again.'), 'error');
        return;
      }
    }
    user.name = name;
    user.shortName = window.pawApp.firstNameOf(name) || name;
    user.avatarInitial = (name[0] || 'G').toUpperCase();
    window.pawStore.setGoogleUser(user);
    window.pawApp.updateGoogleAuthUI();
    notify(this.t('settings.nameSaved', 'Your name was updated.'), 'success');
  }

  // ─────────────────────────────────────────────────
  // PASSWORD: the forgot-password dialog, locked to the signed-in email
  // ─────────────────────────────────────────────────
  openPasswordChange(user) {
    if (!user.email || typeof window.pawApp.openForgotPassword !== 'function') {
      window.notifManager.showToast(this.t('settings.unavailable', 'This is not available right now. Please refresh and try again.'), 'error');
      return;
    }
    window.pawApp.openForgotPassword(user.email, true);
  }

  // ─────────────────────────────────────────────────
  // EMAIL: code goes to the NEW address
  // ─────────────────────────────────────────────────
  openEmailChange() {
    this.initEmailModal();
    const input = document.getElementById('change-email-input');
    const otp = document.getElementById('change-email-otp');
    if (input) input.value = '';
    if (otp) otp.value = '';
    this.pendingEmail = '';
    this.showEmailStep('email');
    window.notifManager.openModal('change-email-modal');
    this.tickResend();
    this.renderTurnstile();
    setTimeout(() => input?.focus(), 150);
  }

  showEmailStep(step) {
    document.getElementById('change-email-form').hidden = step !== 'email';
    document.getElementById('change-email-otp-form').hidden = step !== 'otp';
    document.getElementById('change-email-back-btn').hidden = step !== 'otp';
    const order = ['email', 'otp'];
    document.querySelectorAll('#change-email-steps li').forEach((li) => {
      const idx = order.indexOf(li.dataset.step);
      const current = order.indexOf(step);
      li.classList.toggle('is-active', idx === current);
      li.classList.toggle('is-done', idx < current);
      const badge = li.querySelector('span');
      if (badge) badge.textContent = idx < current ? '✓' : String(idx + 1);
    });
    this.setEmailStatus('');
  }

  setEmailStatus(message, isError = false) {
    const el = document.getElementById('change-email-status');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', !!isError);
  }

  setLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
  }

  // Security check on the email step. Tokens are single-use, so the widget resets after every attempt.
  // Note: Supabase Auth does not verify a captcha token on "update user", so this check runs in the browser only.
  async renderTurnstile() {
    const el = document.getElementById('change-email-turnstile');
    const key = window.PAWTRACK_SUPABASE && window.PAWTRACK_SUPABASE.turnstileSiteKey;
    if (!el || !key) return;
    try {
      const started = Date.now();
      while (!window.turnstile) {
        if (Date.now() - started > 10000) throw new Error('timeout');
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.turnstileId !== null) {
        this.resetTurnstile();
        return;
      }
      this.turnstileId = window.turnstile.render(el, {
        sitekey: key,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
        size: 'flexible',
        callback: (token) => { this.turnstileToken = token; },
        'expired-callback': () => { this.turnstileToken = null; },
        'error-callback': () => this.setEmailStatus(this.t('settings.securityFailed', 'Security check failed to load. Please refresh and try again.'), true)
      });
    } catch (err) {
      this.setEmailStatus(this.t('settings.securityFailed', 'Security check failed to load. Please refresh and try again.'), true);
    }
  }

  resetTurnstile() {
    this.turnstileToken = null;
    if (window.turnstile && this.turnstileId !== null) window.turnstile.reset(this.turnstileId);
  }

  // Supabase also limits how often a code can be sent; this keeps the button honest
  tickResend() {
    clearInterval(this.resendTimer);
    const resend = document.getElementById('change-email-resend-btn');
    const apply = () => {
      const wait = Math.max(0, 60000 - (Date.now() - this.lastEmailCode));
      if (resend) {
        resend.disabled = wait > 0;
        resend.textContent = wait > 0
          ? `${this.t('settings.sendAgainIn', 'Send again in')} ${Math.ceil(wait / 1000)}s`
          : this.t('settings.sendAgain', 'Send again');
      }
      if (wait <= 0) clearInterval(this.resendTimer);
    };
    apply();
    this.resendTimer = setInterval(apply, 1000);
  }

  async sendEmailCode(email, button) {
    const sb = window.pawApp.supabase;
    if (!sb) {
      this.setEmailStatus(this.t('settings.unavailable', 'This is not available right now. Please refresh and try again.'), true);
      return false;
    }
    this.setLoading(button, true);
    this.setEmailStatus(this.t('settings.sending', 'Sending code…'));
    const { error } = await sb.auth.updateUser({ email });
    this.setLoading(button, false);
    if (error) {
      const taken = error.code === 'email_exists' || /already (been )?registered|already exists/i.test(error.message || '');
      const limited = error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit' || /rate limit/i.test(error.message || '');
      this.setEmailStatus(
        taken ? this.t('settings.emailTaken', 'That email is already used by another account.')
          : limited ? this.t('settings.tooMany', 'Too many attempts. Please wait a minute and try again.')
          : (error.message || this.t('settings.genericError', 'Something went wrong. Please try again.')),
        true
      );
      return false;
    }
    this.lastEmailCode = Date.now();
    this.tickResend();
    return true;
  }

  initEmailModal() {
    if (this.emailInit) return;
    this.emailInit = true;

    const form = document.getElementById('change-email-form');
    const otpForm = document.getElementById('change-email-otp-form');
    const emailInput = document.getElementById('change-email-input');
    const otpInput = document.getElementById('change-email-otp');
    const sendBtn = document.getElementById('change-email-send-btn');
    const verifyBtn = document.getElementById('change-email-verify-btn');
    const resendBtn = document.getElementById('change-email-resend-btn');
    const modal = document.getElementById('change-email-modal');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim().toLowerCase();
      const current = ((window.pawStore.getGoogleUser() || {}).email || '').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        this.setEmailStatus(this.t('settings.emailInvalid', 'Enter a valid email address.'), true);
        emailInput.focus();
        return;
      }
      if (email === current) {
        this.setEmailStatus(this.t('settings.emailSame', 'That is already your email.'), true);
        return;
      }
      if (!this.turnstileToken) {
        this.setEmailStatus(this.t('settings.securityRequired', 'Please complete the security check first.'), true);
        return;
      }
      const sent = await this.sendEmailCode(email, sendBtn);
      this.resetTurnstile();
      if (sent) {
        this.pendingEmail = email;
        document.getElementById('change-email-target').textContent = email;
        this.showEmailStep('otp');
        setTimeout(() => otpInput.focus(), 100);
      }
    });

    otpInput.addEventListener('input', () => {
      otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 6);
      if (otpInput.value.length === 6) otpForm.requestSubmit();
    });

    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = otpInput.value.trim();
      if (!/^\d{6}$/.test(token)) {
        this.setEmailStatus(this.t('settings.codeFormat', 'Enter the 6-digit code from your email.'), true);
        otpInput.focus();
        return;
      }
      this.setLoading(verifyBtn, true);
      this.setEmailStatus(this.t('settings.verifying', 'Verifying…'));
      const { error } = await window.pawApp.supabase.auth.verifyOtp({ email: this.pendingEmail, token, type: 'email_change' });
      this.setLoading(verifyBtn, false);
      if (error) {
        this.setEmailStatus(this.t('settings.codeInvalid', 'That code is incorrect or has expired. Check the code or send a new one.'), true);
        otpInput.select();
        return;
      }
      this.finishEmailChange(this.pendingEmail);
    });

    resendBtn.addEventListener('click', () => {
      if (this.pendingEmail) this.sendEmailCode(this.pendingEmail, null);
    });

    document.getElementById('change-email-back-btn').addEventListener('click', () => {
      this.showEmailStep('email');
      setTimeout(() => emailInput.focus(), 50);
    });

    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) window.notifManager.closeModal('change-email-modal');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) window.notifManager.closeModal('change-email-modal');
    });
  }

  finishEmailChange(email) {
    const user = window.pawStore.getGoogleUser();
    if (user) {
      user.email = email;
      window.pawStore.setGoogleUser(user);
    }
    window.pawApp.updateGoogleAuthUI();
    window.notifManager.closeModal('change-email-modal');
    window.notifManager.showToast(this.t('settings.emailChanged', 'Your email was changed.'), 'success');
    const value = document.getElementById('settings-email-value');
    if (value) value.textContent = email;
  }
}

window.settingsView = new SettingsView();
