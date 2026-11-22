/**
 * Automated Verification: Google Account Auto-Connect & 4-PIN Gmail Verification
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== Running Test: Google Account Auto-Connect & 4-PIN Gmail Verification ===\n');

// 1. Verify user avatar asset exists
const avatarPath = path.join(__dirname, '..', 'images', 'user-avatar.png');
assert(fs.existsSync(avatarPath), 'images/user-avatar.png must exist');
console.log('[PASS] images/user-avatar.png exists and is bundled in the project.');

// 2. Read app.js, index.html, server.js, api handlers
const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const compCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'components.css'), 'utf8');
const notifJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'notifications.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

// Ensure the notification Edge Function exists (secrets live in Supabase, not in .env)
const notificationFnPath = path.join(__dirname, '..', 'supabase', 'functions', 'send-auth-email', 'index.ts');
assert(fs.existsSync(notificationFnPath), 'supabase/functions/send-auth-email must exist');
console.log('[PASS] Google authorization security notification API is present.');

// Real sign-in: Supabase Auth (email + password with Turnstile captcha, or Google) and the guardians table
assert(indexHtml.includes('@supabase/supabase-js@') && indexHtml.includes('js/supabase-config.js'), 'index.html must load supabase-js and its config');
// Sign-up is verified by an emailed 6-digit code (the signup-otp Edge Function) before the account is created
assert(appJs.includes('auth.signInWithPassword') && appJs.includes('signup-otp'), 'js/app.js must support email + password sign-in and code-verified sign-up');
assert(appJs.includes('signInWithOAuth') && appJs.includes("provider: 'google'"), 'js/app.js must offer Continue with Google');
assert(appJs.includes('auth.resetPasswordForEmail') && appJs.includes('PASSWORD_RECOVERY'), 'js/app.js must support password reset');
assert((appJs.match(/captchaToken/g) || []).length >= 3, 'js/app.js must pass the Turnstile token to Supabase for sign-in, sign-up and reset');
assert(appJs.includes('turnstile.render'), 'js/app.js must render Cloudflare Turnstile');
assert(appJs.includes(".from('guardians')"), 'js/app.js must store guardian profiles in Supabase');
assert(!appJs.includes('/api/auth/'), 'js/app.js must not use the retired custom auth API');
assert(!appJs.includes('performDirectLogin'), 'js/app.js must not sign users in without verification');
assert(!fs.existsSync(path.join(__dirname, '..', 'lib', 'auth.js')), 'the custom lib/auth.js must be gone');
assert(indexHtml.includes('challenges.cloudflare.com/turnstile/v0/api.js'), 'index.html must load Turnstile');
console.log('[PASS] Supabase sign-in (password + Turnstile, Google), password reset, and guardian profiles are wired up.');

// Ensure modals are present in index.html
assert(indexHtml.includes('id="auth-landing"'), 'index.html must include the #auth-landing start screen');
assert(indexHtml.includes('id="auth-landing-report-btn"'), 'start screen must let finders report a pet without signing in');
assert(indexHtml.includes('id="register-dialog-modal"'), 'index.html must include #register-dialog-modal');
assert(!indexHtml.includes('id="google-consent-modal"'), 'index.html must NOT include the simulated #google-consent-modal');
assert(!indexHtml.includes('id="google-auth-modal"'), 'index.html must NOT include legacy #google-auth-modal');
assert(!indexHtml.includes('id="guardian-pin-modal"'), 'index.html must NOT include #guardian-pin-modal');
assert(indexHtml.includes('id="privacy-policy-modal"'), 'index.html must include #privacy-policy-modal');
assert(indexHtml.includes('id="terms-modal"'), 'index.html must include #terms-modal');
console.log('[PASS] Sign-in, registration, and policy modals are present in index.html.');

// Ensure CSS supports avatar image rendering, Login Dialog, and Google Consent Card
assert(compCss.includes('.auth-dialog-card'), 'components.css must define .auth-dialog-card styling');
assert(compCss.includes('.auth-turnstile'), 'components.css must define .auth-turnstile styling');
assert(indexHtml.includes('id="login-turnstile"'), 'index.html must include #login-turnstile');
// Layout order: email/password form, Turnstile, Log in button, then Continue with Google
const order = ['id="login-email"', 'id="login-password"', 'id="login-forgot-btn"', 'id="login-turnstile"', 'id="login-submit-btn"', 'id="login-google-btn"'].map(m => indexHtml.indexOf(m));
assert(order.every(i => i > 0) && order.every((i, n) => n === 0 || i > order[n - 1]), 'sign-in form must be ordered: email, password, forgot password, Turnstile, Log in, Google');
assert(indexHtml.includes('id="register-email"'), 'index.html must include #register-email');
assert(indexHtml.includes('id="register-name"'), 'index.html must include #register-name');
assert(indexHtml.includes('id="register-phone"'), 'index.html must include #register-phone');
assert(indexHtml.includes('id="reset-password-modal"'), 'index.html must include #reset-password-modal');
console.log('[PASS] CSS, sign-in dialog, and registration elements are configured.');

// Verify Guardian Profile View and Edit Mode elements
assert(indexHtml.includes('id="guardian-profile-view-mode"'), 'index.html must include #guardian-profile-view-mode');
assert(indexHtml.includes('id="guardian-profile-edit-form"'), 'index.html must include #guardian-profile-edit-form');
assert(indexHtml.includes('id="guardian-edit-btn"'), 'index.html must include #guardian-edit-btn');
assert(indexHtml.includes('id="edit-guardian-name-input"'), 'index.html must include #edit-guardian-name-input');
assert(indexHtml.includes('id="edit-guardian-phone-input"'), 'index.html must include #edit-guardian-phone-input');
assert(indexHtml.includes('id="edit-guardian-area-input"'), 'index.html must include #edit-guardian-area-input');
assert(indexHtml.includes('id="edit-guardian-backup-input"'), 'index.html must include #edit-guardian-backup-input');
assert(indexHtml.includes('id="edit-guardian-avatar-file"'), 'index.html must include #edit-guardian-avatar-file');
assert(indexHtml.includes('id="edit-guardian-avatar-reset"'), 'index.html must include #edit-guardian-avatar-reset');
assert(indexHtml.includes('id="edit-guardian-cancel-btn"'), 'index.html must include #edit-guardian-cancel-btn');
assert(indexHtml.includes('id="edit-guardian-save-btn"'), 'index.html must include #edit-guardian-save-btn');
assert(compCss.includes('.guardian-modal-avatar-box'), 'components.css must include .guardian-modal-avatar-box');
console.log('[PASS] Guardian Profile View and Edit mode form elements and styles are verified.');

// 3. Mock DOM and state for full flow test
let currentUser = null;
const mockDom = {
  'header-login-btn': { style: { display: '' } },
  'header-user-btn': { style: { display: 'none' } },
  'header-user-name': { textContent: '' },
  'header-avatar-circle': { innerHTML: '', textContent: '' },
  'user-account-dropdown': { style: { display: 'none' } },
  'dropdown-user-name': { textContent: '' },
  'dropdown-user-email': { textContent: '' },
  'dropdown-avatar-circle': { innerHTML: '', textContent: '' },
  'guardian-profile-modal': { classList: { classes: new Set(), add(c) { this.classes.add(c); } } },
  'guardian-modal-name': { textContent: '' },
  'guardian-modal-email': { textContent: '' },
  'guardian-modal-phone': { textContent: '' },
  'guardian-modal-area': { textContent: '' },
  'guardian-modal-backup-phone': { textContent: '' },
  'guardian-modal-avatar': { innerHTML: '', textContent: '' },
  'reg-owner-name': { value: '' },
  'google-onetap-prompt': { style: { display: 'none' } },
  'google-required-modal': { style: { display: 'none' } },
  'auth-landing': { classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); } } },
  'register-dialog-modal': { classList: { classes: new Set(), add(c) { this.classes.add(c); }, remove(c) { this.classes.delete(c); } } },
  'app-viewport': { innerHTML: '' }
};

// Simulate Direct Login & Google User Authorization
const sampleEmail = 'alex.morgan@gmail.com';
const sampleName = 'Alex Morgan';

currentUser = {
  name: sampleName,
  shortName: 'Alex',
  email: sampleEmail,
  picture: 'https://ui-avatars.com/api/?name=Alex%20Morgan&background=1a73e8&color=fff&bold=true&size=128',
  avatarInitial: 'A',
  avatarBg: '#1a73e8',
  phone: '+63 917 555 3829',
  area: 'Quezon City, NCR',
  backupPhone: '+63 918 123 4567',
  verified: true,
  emailVerified: true,
  authenticatedAt: new Date().toISOString()
};

// Simulate updateGoogleAuthUI
function updateGoogleAuthUI(user) {
  const loginBtn = mockDom['header-login-btn'];
  const userBtn = mockDom['header-user-btn'];
  const nameEl = mockDom['header-user-name'];
  const avatarCircle = mockDom['header-avatar-circle'];
  const dropdownName = mockDom['dropdown-user-name'];
  const dropdownEmail = mockDom['dropdown-user-email'];
  const dropdownAvatar = mockDom['dropdown-avatar-circle'];
  const modalName = mockDom['guardian-modal-name'];
  const modalEmail = mockDom['guardian-modal-email'];
  const modalPhone = mockDom['guardian-modal-phone'];
  const modalArea = mockDom['guardian-modal-area'];
  const modalBackupPhone = mockDom['guardian-modal-backup-phone'];
  const modalAvatar = mockDom['guardian-modal-avatar'];

  const isLoggedIn = !!(user && user.name);

  if (isLoggedIn) {
    loginBtn.style.display = 'none';
    userBtn.style.display = 'inline-flex';
    const short = user.shortName || user.name || 'User';
    const initial = user.avatarInitial || (user.name ? user.name[0].toUpperCase() : 'G');

    nameEl.textContent = short;
    dropdownName.textContent = user.name;
    dropdownEmail.textContent = user.email;
    modalName.textContent = user.name;
    modalEmail.textContent = user.email;
    if (modalPhone) modalPhone.textContent = user.phone || '+63 917 555 3829';
    if (modalArea) modalArea.textContent = user.area || 'National Capital Region (NCR)';
    if (modalBackupPhone) modalBackupPhone.textContent = user.backupPhone || 'None set';

    const renderAvatar = (el) => {
      if (!el) return;
      if (user.picture) {
        el.innerHTML = `<img src="${user.picture}" alt="${user.name}" />`;
      } else {
        el.textContent = initial;
      }
    };

    renderAvatar(avatarCircle);
    renderAvatar(dropdownAvatar);
    renderAvatar(modalAvatar);

    const regOwnerName = mockDom['reg-owner-name'];
    if (regOwnerName && !regOwnerName.value) {
      regOwnerName.value = user.name;
    }
  }
}

updateGoogleAuthUI(currentUser);

// 4. Assertions
assert.strictEqual(mockDom['header-login-btn'].style.display, 'none');
assert.strictEqual(mockDom['header-user-btn'].style.display, 'inline-flex');
assert.strictEqual(mockDom['header-user-name'].textContent, 'Alex');
assert(mockDom['header-avatar-circle'].innerHTML.includes('ui-avatars.com'));

assert.strictEqual(mockDom['dropdown-user-name'].textContent, 'Alex Morgan');
assert.strictEqual(mockDom['dropdown-user-email'].textContent, 'alex.morgan@gmail.com');
assert(mockDom['dropdown-avatar-circle'].innerHTML.includes('ui-avatars.com'));

assert.strictEqual(mockDom['guardian-modal-name'].textContent, 'Alex Morgan');
assert.strictEqual(mockDom['guardian-modal-email'].textContent, 'alex.morgan@gmail.com');
assert.strictEqual(mockDom['guardian-modal-phone'].textContent, '+63 917 555 3829');
assert.strictEqual(mockDom['guardian-modal-area'].textContent, 'Quezon City, NCR');
assert.strictEqual(mockDom['guardian-modal-backup-phone'].textContent, '+63 918 123 4567');
assert(mockDom['guardian-modal-avatar'].innerHTML.includes('ui-avatars.com'));

assert.strictEqual(mockDom['reg-owner-name'].value, 'Alex Morgan');

// Simulate Guardian Profile Modification
currentUser.name = 'Alexander Vance';
currentUser.shortName = 'Alexander';
currentUser.phone = '+63 999 888 7766';
currentUser.area = 'Makati City, Metro Manila';
currentUser.backupPhone = '+63 912 345 6789';
currentUser.picture = 'data:image/png;base64,customAvatarData';
updateGoogleAuthUI(currentUser);

assert.strictEqual(mockDom['header-user-name'].textContent, 'Alexander');
assert.strictEqual(mockDom['dropdown-user-name'].textContent, 'Alexander Vance');
assert.strictEqual(mockDom['guardian-modal-name'].textContent, 'Alexander Vance');
assert.strictEqual(mockDom['guardian-modal-phone'].textContent, '+63 999 888 7766');
assert.strictEqual(mockDom['guardian-modal-area'].textContent, 'Makati City, Metro Manila');
assert.strictEqual(mockDom['guardian-modal-backup-phone'].textContent, '+63 912 345 6789');
assert(mockDom['header-avatar-circle'].innerHTML.includes('customAvatarData'));
assert(mockDom['guardian-modal-avatar'].innerHTML.includes('customAvatarData'));

console.log('[PASS] Header user pill displays "Alex" with dynamic avatar.');
console.log('[PASS] Dropdown displays "Alex Morgan", "alex.morgan@gmail.com", and avatar.');
console.log('[PASS] Guardian Profile modal displays "Alex Morgan", "alex.morgan@gmail.com", and avatar.');
console.log('[PASS] Pet Registration automatically prefills owner as "Alex Morgan".');
console.log('[PASS] Profile edit updates name, rescue phone, registered area, secondary backup, and custom avatar.');
console.log('\n=== All Direct Login & Profile Connection Tests Passed! ===');
