/**
 * PawTrack Admin — Settings
 * The signed-in admin's own account: a profile summary, editable personal details, and the read-only account facts.
 * (Nothing about the impound facility lives here; that is on the Shelters and Impoundments pages.)
 */

window.SettingsView = {
  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  },

  day(v) {
    if (!v) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  },

  render(container) {
    const account = window.adminApp && window.adminApp.currentAdmin;
    const esc = (v) => this.esc(v);

    let body = '';
    if (account) {
      const name = account.full_name || account.email || '';
      const status = ({
        approved: ['Approved', 'status-safe'],
        pending: ['Pending review', 'status-impounded'],
        suspended: ['Suspended', 'status-lost'],
        rejected: ['Declined', 'status-lost']
      })[account.status] || [account.status || 'Unknown', 'status-impounded'];
      const FF = window.FacilityForm;
      const mobile = account.phone && FF ? FF.phone.digits(account.phone) : '';
      const lock = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

      body = `
        <div class="acct-layout">
          <aside class="nock-card acct-profile" aria-label="Profile summary">
            <div class="acct-avatar" id="acct-avatar" aria-hidden="true">${esc(this.initials(name))}</div>
            <div class="acct-profile-name" id="acct-profile-name">${esc(name)}</div>
            <div class="acct-profile-role" id="acct-profile-role">${esc(account.position || 'No position set')}</div>
            <span class="status-pill ${status[1]}">${esc(status[0])}</span>
            <dl class="acct-profile-facts">
              <div><dt>Email</dt><dd>${esc(account.email)}</dd></div>
              <div><dt>Member since</dt><dd>${esc(this.day(account.created_at))}</dd></div>
            </dl>
            <button class="btn btn-secondary acct-signout" id="btn-account-signout">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              Sign out
            </button>
          </aside>

          <div class="acct-main">
            <form class="nock-card" id="account-form" novalidate>
              <div class="nock-card-head">
                <span class="nock-card-title">Personal details</span>
                <span class="nock-card-right">Shown to other admins</span>
              </div>
              <div class="acct-fields">
                <div class="form-group acct-wide">
                  <label class="form-label" for="acct-name">Full name *</label>
                  <input type="text" class="form-control" id="acct-name" name="full_name" value="${esc(account.full_name)}" maxlength="120" autocomplete="name" aria-describedby="acct-name-err" />
                  <div class="acct-err" id="acct-name-err" role="alert" hidden></div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="acct-position">Position</label>
                  <input type="text" class="form-control" id="acct-position" name="position" value="${esc(account.position || '')}" maxlength="120" autocomplete="organization-title" placeholder="e.g. Head Veterinarian" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="acct-phone">Mobile number</label>
                  <div class="fm-phone-row">
                    <span class="fm-phone-prefix" aria-hidden="true">+63</span>
                    <input type="tel" class="form-control" id="acct-phone" name="phone" value="${esc(mobile)}" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="917 123 4567" aria-describedby="acct-phone-err" />
                  </div>
                  <div class="acct-err" id="acct-phone-err" role="alert" hidden></div>
                </div>
              </div>
              <div class="acct-savebar" id="acct-savebar">
                <span class="acct-dirty" id="acct-dirty" aria-live="polite">All changes saved</span>
                <div class="acct-savebar-actions">
                  <button type="button" class="btn btn-secondary" id="btn-discard-account" disabled>Discard</button>
                  <button type="submit" class="btn btn-primary" id="btn-save-account" disabled>Save changes</button>
                </div>
              </div>
            </form>

            <section class="nock-card" id="acct-appearance" aria-label="Appearance">
              <div class="nock-card-head">
                <span class="nock-card-title">Appearance</span>
                <span class="nock-card-right">Saved on this device</span>
              </div>
              <div class="acct-sec-row">
                <span class="acct-sec-label">Theme</span>
                <div class="acct-sec-info"><b>Light, dark or match your device</b><small>Dark mode is easier on the eyes at night. The loading screen follows it too.</small></div>
                <div class="theme-seg" role="group" aria-label="Theme">
                  <button type="button" class="theme-opt" data-theme-pref="light" aria-pressed="false"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>Light</button>
                  <button type="button" class="theme-opt" data-theme-pref="dark" aria-pressed="false"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>Dark</button>
                  <button type="button" class="theme-opt" data-theme-pref="system" aria-pressed="false"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>System</button>
                </div>
              </div>
            </section>

            <section class="nock-card" id="acct-security" aria-label="Sign-in and security">
              <div class="nock-card-head">
                <span class="nock-card-title">Sign-in &amp; security</span>
                <span class="nock-card-right">Confirmed with a code sent to your email</span>
              </div>
              <div class="acct-sec-row">
                <span class="acct-sec-label">Email</span>
                <div class="acct-sec-info"><b id="acct-sec-email">${esc(account.email)}</b><small id="acct-sec-email-help">The address you sign in with and receive codes at.</small></div>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-change-email" disabled>Change email</button>
              </div>
              <div class="acct-sec-row">
                <span class="acct-sec-label">Password</span>
                <div class="acct-sec-info"><b aria-label="Hidden password">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</b><small id="acct-sec-pw-help">Choose a strong password you don't use anywhere else.</small></div>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-change-password" disabled>Change password</button>
              </div>
            </section>

            <section class="nock-card" aria-label="Account">
              <div class="nock-card-head">
                <span class="nock-card-title">Account</span>
                <span class="nock-card-right acct-lock">${lock} Can't be changed here</span>
              </div>
              <dl class="acct-facts">
                <div><dt>Birth date</dt><dd>${esc(this.day(account.birth_date))}</dd></div>
                <div><dt>Member since</dt><dd>${esc(this.day(account.created_at))}</dd></div>
                <div><dt>Sign-in method</dt><dd id="acct-provider">Checking…</dd></div>
              </dl>
            </section>
          </div>
        </div>`;
    } else {
      body = '<div class="nock-card"><div class="dash-empty"><div class="dash-empty-title">Not signed in</div>Sign in to see your account.</div></div>';
    }

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-titles">
          <h1>Settings</h1>
          <div class="subtitle"><span>Your account</span></div>
        </div>
      </div>
      ${body}
    `;

    this.bindAccount(container);
  },

  // Edit name, position and mobile number in place; the rest of the account is read-only
  bindAccount(container) {
    const form = container.querySelector('#account-form');
    if (!form) return;
    const app = window.adminApp;
    const FF = window.FacilityForm;
    let account = app.currentAdmin;

    const el = {
      name: form.elements.full_name,
      position: form.elements.position,
      phone: form.elements.phone,
      save: container.querySelector('#btn-save-account'),
      discard: container.querySelector('#btn-discard-account'),
      dirty: container.querySelector('#acct-dirty'),
      bar: container.querySelector('#acct-savebar')
    };
    const errOf = { name: container.querySelector('#acct-name-err'), phone: container.querySelector('#acct-phone-err') };

    // Mobile only, digits only, +63 is the fixed prefix
    if (FF) FF.phone.bind(el.phone);

    const saved = () => ({
      name: account.full_name || '',
      position: account.position || '',
      phone: account.phone && FF ? FF.phone.digits(account.phone) : ''
    });
    const current = () => ({ name: el.name.value.trim(), position: el.position.value.trim(), phone: el.phone.value });
    const isDirty = () => { const a = saved(), b = current(); return a.name !== b.name || a.position !== b.position || a.phone !== b.phone; };

    const problems = () => ({
      name: current().name.length < 2 ? 'Enter your full name (at least 2 characters).' : '',
      phone: el.phone.value !== '' && !/^9\d{9}$/.test(el.phone.value) ? 'Enter a 10-digit mobile number starting with 9.' : ''
    });
    const showError = (key, input, message) => {
      errOf[key].textContent = message;
      errOf[key].hidden = !message;
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    };
    const touched = { name: false, phone: false };
    const validate = (force) => {
      const p = problems();
      showError('name', el.name, (touched.name || force) ? p.name : '');
      showError('phone', el.phone, (touched.phone || force) ? p.phone : '');
      return !p.name && !p.phone;
    };

    // The profile card on the left follows what is being typed
    const paintProfile = () => {
      const c = current();
      const nameNow = c.name || account.email;
      container.querySelector('#acct-profile-name').textContent = nameNow;
      container.querySelector('#acct-avatar').textContent = this.initials(nameNow);
      container.querySelector('#acct-profile-role').textContent = c.position || 'No position set';
    };

    const refresh = () => {
      const dirty = isDirty();
      el.save.disabled = !dirty;
      el.discard.disabled = !dirty;
      el.bar.classList.toggle('is-dirty', dirty);
      el.dirty.textContent = dirty ? 'You have unsaved changes' : 'All changes saved';
    };

    form.addEventListener('input', () => { paintProfile(); validate(false); refresh(); });
    el.name.addEventListener('blur', () => { touched.name = true; validate(false); });
    el.phone.addEventListener('blur', () => { touched.phone = true; validate(false); });

    el.discard.addEventListener('click', () => {
      const s = saved();
      el.name.value = s.name; el.position.value = s.position; el.phone.value = s.phone;
      touched.name = touched.phone = false;
      paintProfile(); validate(false); refresh();
    });

    const save = async () => {
      touched.name = touched.phone = true;
      if (!validate(true)) {
        (problems().name ? el.name : el.phone).focus();
        return;
      }
      if (!isDirty()) return;
      el.save.disabled = true;
      el.discard.disabled = true;
      el.save.textContent = 'Saving…';
      const c = current();
      const patch = { full_name: c.name, position: c.position || null, phone: c.phone ? '+63' + c.phone : null };
      const { data, error } = await app.supabase.from('admin_accounts').update(patch).eq('id', account.id).select('*').maybeSingle();
      if (error || !data) {
        el.save.textContent = 'Save changes';
        refresh();
        app.showToast(`Could not save your account: ${(error && error.message) || 'please try again.'}`, 'error');
        return;
      }
      account = data;
      app.currentAdmin = data;
      app.updateAccountLabels();
      paintProfile();
      refresh();
      el.save.textContent = 'Saved ✓';
      el.save.classList.add('is-saved');
      setTimeout(() => { el.save.classList.remove('is-saved'); el.save.textContent = 'Save changes'; refresh(); }, 1600);
      app.showToast('Your account was updated.', 'success', 1800);
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); save(); });

    container.querySelector('#btn-account-signout')?.addEventListener('click', () => app.logoutAdmin());

    // Theme choice (light / dark / system)
    container.querySelectorAll('[data-theme-pref]').forEach((b) => b.addEventListener('click', () => app.setThemePreference(b.getAttribute('data-theme-pref'))));
    app.applyTheme();

    // How this account signs in (the auth service knows; the account row does not)
    const setProvider = (text) => { const p = container.querySelector('#acct-provider'); if (p) p.textContent = text; };
    if (app.supabase && app.supabase.auth) {
      app.supabase.auth.getUser().then(({ data }) => {
        const provider = data && data.user && data.user.app_metadata && data.user.app_metadata.provider;
        setProvider(provider === 'google' ? 'Google' : provider === 'email' ? 'Email and password' : (provider || '—'));
        const emailBtn = container.querySelector('#btn-change-email');
        const pwBtn = container.querySelector('#btn-change-password');
        const isEmailAccount = provider === 'email';
        if (emailBtn) {
          emailBtn.disabled = false;
          emailBtn.addEventListener('click', () => this.openSecurityModal('email', { google: !isEmailAccount }));
          if (!isEmailAccount) {
            const h = container.querySelector('#acct-sec-email-help');
            if (h) h.textContent = 'Used for codes and for email sign-in. Signing in with Google keeps working.';
          }
        }
        if (pwBtn) {
          pwBtn.disabled = false;
          if (!isEmailAccount) {
            // Google sign-in has no password yet: let the admin add one (confirmed by an emailed code)
            pwBtn.textContent = 'Set a password';
            const h = container.querySelector('#acct-sec-pw-help'); if (h) h.textContent = 'You sign in with Google. Add a password to also sign in with your email.';
          }
          pwBtn.addEventListener('click', () => this.openSecurityModal('password', { google: !isEmailAccount }));
        }
      }).catch(() => setProvider('—'));
    } else {
      setProvider('—');
    }
  },

  // Calls the server function that sends and checks the emailed codes. Resolves { ok, data }.
  async callOtp(body) {
    const sb = window.adminApp && window.adminApp.supabase;
    const offline = { ok: false, data: { error: 'No connection. Check your internet and try again.' } };
    if (!sb) return offline;
    try {
      const { data, error } = await sb.functions.invoke('admin-account-otp', { body });
      if (error) {
        let payload = {};
        try { payload = await error.context.json(); } catch (e) { /* no body */ }
        return payload && payload.error ? { ok: false, data: payload } : offline;
      }
      return { ok: true, data: data || {} };
    } catch (e) {
      return offline;
    }
  },

  // Change email / change password: ask for the change, then enter the 6-digit code that was emailed
  openSecurityModal(kind, opts = {}) {
    const app = window.adminApp;
    const setting = kind === 'password' && !!opts.google;   // Google account adding its first password
    const esc = (v) => this.esc(v);
    const isEmail = kind === 'email';
    const currentEmail = (app.currentAdmin && app.currentAdmin.email) || '';
    let target = isEmail ? '' : currentEmail;   // where the code goes
    let timer = null;

    const eye = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const iconMail = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
    const iconLock = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
    // A puppy tosses an envelope into a mailbox while the code is being sent
    const petMail = `
      <svg class="pet-mail" viewBox="0 0 280 160" role="img" aria-label="A puppy tossing an envelope into a mailbox">
        <ellipse cx="140" cy="148" rx="122" ry="7" fill="rgba(120,90,60,.13)"/>
        <g class="pm-trail" fill="#e0a06a"><circle cx="124" cy="84" r="2.6"/><circle cx="142" cy="68" r="2.6"/><circle cx="164" cy="60" r="2.6"/><circle cx="186" cy="64" r="2.6"/></g>
        <g class="pm-box">
          <rect x="214" y="98" width="8" height="48" rx="3" fill="#a67c52"/>
          <path d="M196 100 V80 a22 22 0 0 1 44 0 V100 Z" fill="#4f7cc4"/>
          <rect x="194" y="97" width="48" height="7" rx="3.5" fill="#3d63a0"/>
          <rect x="209" y="82" width="18" height="3.5" rx="1.75" fill="#27467c"/>
          <g class="pm-flag"><rect x="239" y="58" width="3" height="28" rx="1.5" fill="#8d3a2c"/><rect x="242" y="58" width="15" height="10" rx="2.5" fill="#d6492f"/></g>
        </g>
        <g class="pm-sparks" fill="#f5b942"><path d="M205 50l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M243 40l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/><path d="M178 36l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z"/></g>
        <g class="pm-dog">
          <path class="pm-tail" d="M40 114 q-20 -4 -20 -26" stroke="#c97c3c" stroke-width="9" stroke-linecap="round" fill="none"/>
          <ellipse cx="74" cy="118" rx="36" ry="26" fill="#e8a15b"/>
          <ellipse cx="50" cy="141" rx="12" ry="7" fill="#d98d44"/>
          <ellipse cx="92" cy="141" rx="12" ry="7" fill="#d98d44"/>
          <ellipse cx="80" cy="124" rx="19" ry="15" fill="#f7dcb8"/>
          <g class="pm-paw"><rect x="94" y="100" width="16" height="30" rx="8" fill="#e8a15b"/><ellipse cx="102" cy="100" rx="9" ry="7" fill="#f7dcb8"/></g>
          <g class="pm-head">
            <ellipse cx="47" cy="60" rx="11" ry="21" fill="#b8692a" transform="rotate(16 47 60)"/>
            <ellipse cx="103" cy="60" rx="11" ry="21" fill="#b8692a" transform="rotate(-16 103 60)"/>
            <circle cx="75" cy="70" r="31" fill="#e8a15b"/>
            <ellipse cx="75" cy="82" rx="17" ry="13" fill="#f7dcb8"/>
            <ellipse cx="75" cy="75" rx="6.5" ry="4.8" fill="#3b2a20"/>
            <g class="pm-eyes"><circle cx="63" cy="63" r="3.8" fill="#3b2a20"/><circle cx="87" cy="63" r="3.8" fill="#3b2a20"/><circle cx="64.2" cy="61.8" r="1.1" fill="#fff"/><circle cx="88.2" cy="61.8" r="1.1" fill="#fff"/></g>
            <path d="M69 86 q6 6 12 0" stroke="#3b2a20" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path class="pm-tongue" d="M72.5 88 q3 9 7 0 z" fill="#e8737c"/>
          </g>
        </g>
        <g class="pm-env"><rect x="-13" y="-9" width="26" height="18" rx="3" fill="#fff" stroke="#c9b6a3" stroke-width="1.6"/><path d="M-12 -7 L0 3 L12 -7" fill="none" stroke="#e0a06a" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></g>
      </svg>`;
    const otpField = `
      <div class="form-group">
        <span class="form-label" id="sec-code-label">6-digit code</span>
        <div class="sec-otp-boxes" id="sec-otp" role="group" aria-labelledby="sec-code-label">
          ${[0, 1, 2, 3, 4, 5].map((i) => `<input type="text" class="sec-otp-box" inputmode="numeric" maxlength="1" autocomplete="${i === 0 ? 'one-time-code' : 'off'}" aria-label="Digit ${i + 1} of 6" />`).join('')}
        </div>
        <p class="sec-hint">Didn't get it? Check your spam folder, or send it again below.</p>
      </div>`;
    const pwFields = isEmail ? '' : `
      <div class="form-group">
        <label class="form-label" for="sec-pw">New password</label>
        <div class="sec-pw-wrap">
          <input type="password" class="form-control" id="sec-pw" autocomplete="new-password" maxlength="72" />
          <button type="button" class="icon-btn-subtle sec-pw-eye" id="sec-pw-eye" aria-label="Show password" aria-pressed="false">${eye}</button>
        </div>
        <div class="sec-meter" aria-hidden="true"><i id="sec-meter-bar"></i></div>
        <div class="sec-meter-label" id="sec-meter-label" aria-live="polite"></div>
        <ul class="sec-rules" id="sec-rules" aria-label="Password requirements">
          <li data-rule="len">10 or more characters</li><li data-rule="upper">An uppercase letter</li><li data-rule="lower">A lowercase letter</li>
          <li data-rule="num">A number</li><li data-rule="sym">A symbol</li>
        </ul>
      </div>
      <div class="form-group">
        <label class="form-label" for="sec-pw2">Confirm new password</label>
        <input type="password" class="form-control" id="sec-pw2" autocomplete="new-password" maxlength="72" />
      </div>
      <ul class="sec-rules sec-rules-one" aria-label="Confirmation"><li data-rule="match">Both passwords match</li></ul>`;

    const modal = app.openModalContent(`
      <div class="modal-header sec-head">
        <span class="sec-head-ic" aria-hidden="true">${isEmail ? iconMail : iconLock}</span>
        <div class="sec-head-text">
          <div class="nock-card-title">${isEmail ? 'Change email' : setting ? 'Set a password' : 'Change password'}</div>
          <small>${isEmail ? 'Confirmed with a code sent to your new email' : 'Confirmed with a code sent to your email'}</small>
        </div>
        <button class="icon-btn-subtle" id="sec-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <ol class="sec-steps" id="sec-steps" aria-label="Progress">
          <li class="is-active" data-step="1"><i>1</i><span>Request code</span></li>
          <li data-step="2"><i>2</i><span>${isEmail ? 'Confirm email' : 'Verify code'}</span></li>
          ${isEmail ? '' : '<li data-step="3"><i>3</i><span>New password</span></li>'}
        </ol>
        <div class="sec-stage" id="sec-stage" hidden aria-live="polite">
          ${petMail}
          <div class="sec-stage-text"><b id="sec-stage-title">Sending your code…</b><small id="sec-stage-sub"></small></div>
        </div>
        <form id="sec-step1" novalidate>
          ${isEmail
            ? `<div class="form-group"><label class="form-label" for="sec-email">New email address</label>
                 <input type="email" class="form-control" id="sec-email" autocomplete="email" maxlength="254" placeholder="you@gmail.com" /></div>
               <ul class="sec-points">
                 <li>We'll send a 6-digit code to this new address to confirm it's yours.</li>
                 <li>${opts.google ? 'Signing in with Google keeps working.' : 'Your current address gets a notice that it was changed.'}</li>
               </ul>`
            : `<div class="sec-mailcard">
                 <span class="sec-mail-ic" aria-hidden="true">${iconMail}</span>
                 <div><small>We'll email a 6-digit code to</small><b>${esc(currentEmail)}</b></div>
               </div>
               <ul class="sec-points">
                 ${setting
                   ? '<li>Then you can sign in with Google <em>or</em> with your email and password.</li><li>Your Google sign-in keeps working.</li>'
                   : '<li>Every other device you are signed in on will be signed out.</li><li>You will get an email confirming the change.</li>'}
                 <li>The code expires after 10 minutes.</li>
               </ul>`}
          <div class="sec-actions">
            <button type="button" class="btn btn-secondary" id="sec-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="sec-send">Send code</button>
          </div>
        </form>
        <form id="sec-step2" novalidate hidden>
          <div class="sec-sent" id="sec-sent" role="status" hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="sec-sent-ring" cx="12" cy="12" r="10"/><path class="sec-sent-tick" d="m7.5 12.5 3 3 6-7"/></svg>
            <span>Code sent</span>
          </div>
          <p class="sec-lead">Enter the 6-digit code we sent to <b id="sec-target"></b>. It expires in 10 minutes.</p>
          ${otpField}
          <div class="sec-actions">
            <button type="button" class="btn btn-secondary" id="sec-back">${isEmail ? 'Use another email' : 'Back'}</button>
            <button type="button" class="btn btn-secondary" id="sec-resend" disabled>Send again</button>
            <button type="submit" class="btn btn-primary" id="sec-verify">${isEmail ? 'Confirm email' : 'Verify code'}</button>
          </div>
        </form>
        ${isEmail ? '' : `<form id="sec-step3" novalidate hidden>
          <div class="sec-sent is-pop" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="sec-sent-ring" cx="12" cy="12" r="10"/><path class="sec-sent-tick" d="m7.5 12.5 3 3 6-7"/></svg>
            <span>Code verified</span>
          </div>
          <p class="sec-lead">${setting ? 'Now choose the password you will use to sign in with your email.' : 'Now choose your new password.'}</p>
          ${pwFields}
          <div class="sec-actions">
            <button type="button" class="btn btn-secondary" id="sec-cancel3">Cancel</button>
            <button type="submit" class="btn btn-primary" id="sec-set">${setting ? 'Set password' : 'Change password'}</button>
          </div>
        </form>`}
        <div class="sec-status" id="sec-status" role="status" aria-live="polite"></div>
      </div>
    `);

    const $ = (id) => modal.querySelector(id);
    const step1 = $('#sec-step1'), step2 = $('#sec-step2'), status = $('#sec-status');
    const setStatus = (msg, bad) => { status.classList.remove('is-sending'); status.textContent = msg || ''; status.classList.toggle('is-error', !!bad); };
    // "Sending a code to ..." with a spinner while the email goes out
    const setSending = (to) => {
      status.classList.remove('is-error'); status.classList.add('is-sending');
      status.innerHTML = `<span class="sec-spin" aria-hidden="true"></span><span>Sending a code to <b>${esc(to)}</b></span><span class="sec-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
    };
    const busy = (btn, on, label) => {
      btn.disabled = on;
      btn.classList.toggle('is-busy', on);
      btn.setAttribute('aria-busy', on ? 'true' : 'false');
      if (label) btn.dataset.label = btn.dataset.label || btn.textContent;
      btn.textContent = on ? (label || btn.textContent) : (btn.dataset.label || btn.textContent);
    };
    // Locks the form while a request is running so nothing can be edited or sent twice
    const lock = (on) => modal.querySelectorAll('input, #sec-back, #sec-cancel, #sec-cancel3, #sec-close').forEach((el) => { el.disabled = on; });
    const flashSent = () => {
      const chip = $('#sec-sent');
      chip.hidden = false; chip.classList.remove('is-pop'); void chip.offsetWidth; chip.classList.add('is-pop');
    };
    const close = () => { clearInterval(timer); app.closeModal(); };
    $('#sec-close').addEventListener('click', close);
    $('#sec-cancel').addEventListener('click', close);
    $('#sec-cancel3')?.addEventListener('click', close);

    const cooldown = (seconds) => {
      clearInterval(timer);
      let left = seconds;
      const resend = $('#sec-resend');
      const tick = () => {
        if (!resend || !resend.isConnected) { clearInterval(timer); return; }
        resend.disabled = left > 0;
        resend.textContent = left > 0 ? `Send again in ${left}s` : 'Send again';
        if (left <= 0) clearInterval(timer);
        left -= 1;
      };
      tick();
      timer = setInterval(tick, 1000);
    };

    const setStep = (n) => modal.querySelectorAll('#sec-steps li').forEach((li) => { const k = +li.dataset.step; li.classList.toggle('is-active', k === n); li.classList.toggle('is-done', k < n); });
    const showStep2 = () => {
      step1.hidden = true; step2.hidden = false; setStep(2);
      $('#sec-target').textContent = target;
      setStatus('');
      setTimeout(() => code.focus(), 50);
    };

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // Plays the puppy scene while the email goes out (at least ~1.8s so it can be seen), then a short "sent" moment
    const sendCode = async (button) => {
      const to = isEmail ? target : currentEmail;
      const stage = $('#sec-stage');
      const forms = [step1, step2, $('#sec-step3')].filter((f) => f && !f.hidden);
      forms.forEach((f) => { f.hidden = true; });
      stage.classList.remove('is-done');
      $('#sec-stage-title').textContent = 'Sending your code…';
      $('#sec-stage-sub').textContent = `to ${to}`;
      stage.hidden = false;
      setStatus('');
      lock(true);
      const body = isEmail ? { action: 'send', purpose: 'email', new_email: target } : { action: 'send', purpose: 'password' };
      const [res] = await Promise.all([this.callOtp(body), wait(1800)]);
      lock(false);
      if (res.ok) {
        stage.classList.add('is-done');
        $('#sec-stage-title').textContent = 'Code sent!';
        $('#sec-stage-sub').textContent = `Check the inbox of ${to}`;
        await wait(1200);
      }
      stage.hidden = true;
      forms.forEach((f) => { f.hidden = false; });
      if (!res.ok) {
        setStatus(res.data.error || 'Could not send the code. Please try again.', true);
        if (res.data.retryAfter) { showStep2(); setStatus(res.data.error, true); cooldown(res.data.retryAfter); }
        return false;
      }
      setStatus('');
      cooldown(res.data.resendInSeconds || 60);
      return true;
    };

    step1.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isEmail) {
        const v = $('#sec-email').value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setStatus('Enter a valid email address.', true); $('#sec-email').focus(); return; }
        if (v === currentEmail.toLowerCase()) { setStatus('That is already your email.', true); return; }
        target = v;
      }
      if (await sendCode($('#sec-send'))) { showStep2(); flashSent(); }
    });

    $('#sec-back').addEventListener('click', () => {
      clearInterval(timer);
      step2.hidden = true; step1.hidden = false; setStep(1); setStatus('');
      setTimeout(() => (isEmail ? $('#sec-email') : $('#sec-send')).focus(), 50);
    });
    $('#sec-resend').addEventListener('click', async () => {
      if (await sendCode($('#sec-resend'))) { flashSent(); setStatus('A new code was sent.'); }
    });

    // The 6-digit code: one box per digit, with typing, paste, backspace and arrow keys; it submits itself when full.
    // `code` keeps the simple shape the rest of this dialog uses (value / focus).
    const boxes = [...modal.querySelectorAll('.sec-otp-box')];
    const otpWrap = $('#sec-otp');
    const paintOtp = () => boxes.forEach((b) => b.classList.toggle('is-filled', !!b.value));
    const code = {
      get value() { return boxes.map((b) => b.value).join(''); },
      set value(v) { const d = String(v || '').replace(/\D/g, '').slice(0, 6); boxes.forEach((b, i) => { b.value = d[i] || ''; }); paintOtp(); },
      focus() { (boxes.find((b) => !b.value) || boxes[boxes.length - 1]).focus(); },
      shake() { otpWrap.classList.remove('is-shake'); void otpWrap.offsetWidth; otpWrap.classList.add('is-shake'); }
    };
    const spread = (start, digits) => {
      digits.split('').forEach((ch, k) => { if (boxes[start + k]) boxes[start + k].value = ch; });
      paintOtp();
      boxes[Math.min(start + digits.length, boxes.length - 1)].focus();
      if (code.value.length === 6) setTimeout(() => { if (!step2.hidden) step2.requestSubmit(); }, 140);
    };
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        const d = b.value.replace(/\D/g, '');
        b.value = '';
        if (!d) { paintOtp(); return; }
        spread(i, d);
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !b.value && i > 0) { e.preventDefault(); boxes[i - 1].value = ''; boxes[i - 1].focus(); paintOtp(); }
        else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); boxes[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && i < boxes.length - 1) { e.preventDefault(); boxes[i + 1].focus(); }
      });
      b.addEventListener('paste', (e) => {
        e.preventDefault();
        const d = ((e.clipboardData && e.clipboardData.getData('text')) || '').replace(/\D/g, '').slice(0, 6);
        if (d) spread(0, d);
      });
      b.addEventListener('focus', () => b.select());
    });

    // Password rules, shown live
    const rules = (pw, pw2) => ({
      len: pw.length >= 10 && pw.length <= 72, upper: /[A-Z]/.test(pw), lower: /[a-z]/.test(pw),
      num: /\d/.test(pw), sym: /[^A-Za-z0-9\s]/.test(pw), match: !!pw && pw === pw2
    });
    const paintRules = () => {
      if (isEmail) return true;
      const r = rules($('#sec-pw').value, $('#sec-pw2').value);
      modal.querySelectorAll('.sec-rules li').forEach((li) => li.classList.toggle('is-ok', !!r[li.dataset.rule]));
      // Strength: how many of the five requirements are met (a long password counts as strong)
      const pw = $('#sec-pw').value;
      const met = ['len', 'upper', 'lower', 'num', 'sym'].filter((k) => r[k]).length;
      const lvl = !pw ? 0 : met <= 2 ? 1 : met <= 4 ? 2 : pw.length >= 14 ? 4 : 3;
      const bar = $('#sec-meter-bar');
      bar.style.width = `${lvl * 25}%`;
      bar.className = lvl ? `lv${lvl}` : '';
      $('#sec-meter-label').textContent = lvl ? `Strength: ${['', 'Weak', 'Fair', 'Good', 'Strong'][lvl]}` : '';
      return Object.values(r).every(Boolean);
    };
    if (!isEmail) {
      $('#sec-pw').addEventListener('input', paintRules);
      $('#sec-pw2').addEventListener('input', paintRules);
      $('#sec-pw-eye').addEventListener('click', (e) => {
        const show = $('#sec-pw').type === 'password';
        $('#sec-pw').type = show ? 'text' : 'password';
        $('#sec-pw2').type = show ? 'text' : 'password';
        e.currentTarget.setAttribute('aria-pressed', String(show));
        e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    }

    // The puppy hops once the change is saved, then the dialog closes
    const celebrate = async (title, subtitle) => {
      [step1, step2, $('#sec-step3')].forEach((f) => { if (f) f.hidden = true; });
      $('#sec-steps').hidden = true;
      setStatus('');
      const stage = $('#sec-stage');
      stage.classList.add('is-done');
      $('#sec-stage-title').textContent = title;
      $('#sec-stage-sub').textContent = subtitle;
      stage.hidden = false;
      await wait(1700);
    };

    const finishEmail = async (res) => {
      // The session token still carries the old address: refresh it, then show the new one everywhere
      try { await app.supabase.auth.refreshSession(); } catch (err) { /* the next request refreshes it */ }
      if (app.currentAdmin) app.currentAdmin.email = res.data.email || target;
      try { await app.refreshAccount(); } catch (err) { /* the label below is already updated */ }
      app.updateAccountLabels();
      app.renderView('settings');
      app.showToast(`Your email is now ${res.data.email || target}.`, 'success', 4000);
    };

    // Step 2: the emailed code. For an email change this completes it; for a password it only unlocks step 3.
    step2.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!/^\d{6}$/.test(code.value)) { setStatus('Enter the 6-digit code from your email.', true); code.focus(); return; }
      const verify = $('#sec-verify');
      setStatus(isEmail ? 'Confirming…' : 'Checking the code…');
      busy(verify, true, isEmail ? 'Confirming…' : 'Checking…');
      lock(true);
      const res = await this.callOtp(isEmail
        ? { action: 'verify', purpose: 'email', code: code.value }
        : { action: 'check', purpose: 'password', code: code.value });
      lock(false);
      busy(verify, false);
      if (!res.ok) {
        setStatus(res.data.error || 'That did not work. Please try again.', true);
        code.value = '';
        code.shake();
        code.focus();
        return;
      }
      if (isEmail) { await celebrate('Email updated!', res.data.email || target); close(); await finishEmail(res); return; }
      clearInterval(timer);
      step2.hidden = true; $('#sec-step3').hidden = false; setStep(3); setStatus('');
      setTimeout(() => $('#sec-pw').focus(), 50);
    });

    // Step 3 (password only): the new password, accepted by the server only after the code was proven
    $('#sec-step3')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!paintRules()) { setStatus('Please meet all the password requirements.', true); return; }
      const go = $('#sec-set');
      setStatus(setting ? 'Saving your password…' : 'Changing your password…');
      busy(go, true, setting ? 'Saving…' : 'Changing…');
      lock(true);
      const res = await this.callOtp({ action: 'verify', purpose: 'password', new_password: $('#sec-pw').value });
      lock(false);
      busy(go, false);
      if (!res.ok) {
        if (res.data.expired) {
          // The verified code timed out: start again from the first step
          $('#sec-step3').hidden = true; step1.hidden = false; setStep(1);
          setStatus('That confirmation expired. Request a new code.', true);
          return;
        }
        setStatus(res.data.error || 'That did not work. Please try again.', true);
        $('#sec-pw').focus();
        return;
      }
      await celebrate(setting ? 'Password set!' : 'Password updated!', setting ? 'You can now sign in with your email and password too.' : 'Other devices were signed out.');
      close();
      app.showToast(setting ? 'Password set. You can now sign in with your email and password too.' : 'Your password was changed. Other devices were signed out.', 'success', 4500);
    });
  }
};
