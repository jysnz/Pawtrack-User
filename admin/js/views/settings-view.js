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

            <section class="nock-card" aria-label="Account">
              <div class="nock-card-head">
                <span class="nock-card-title">Account</span>
                <span class="nock-card-right acct-lock">${lock} Can't be changed here</span>
              </div>
              <dl class="acct-facts">
                <div><dt>Email</dt><dd>${esc(account.email)}</dd></div>
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

    // How this account signs in (the auth service knows; the account row does not)
    const setProvider = (text) => { const p = container.querySelector('#acct-provider'); if (p) p.textContent = text; };
    if (app.supabase && app.supabase.auth) {
      app.supabase.auth.getUser().then(({ data }) => {
        const provider = data && data.user && data.user.app_metadata && data.user.app_metadata.provider;
        setProvider(provider === 'google' ? 'Google' : provider === 'email' ? 'Email and password' : (provider || '—'));
      }).catch(() => setProvider('—'));
    } else {
      setProvider('—');
    }
  }
};
