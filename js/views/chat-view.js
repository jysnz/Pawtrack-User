const CHAT_PROGRESS = new Set([
  'reading_request', 'checking_pets', 'checking_reports', 'checking_sightings',
  'preparing_report', 'preparing_reunion', 'writing_reply', 'switching_model',
]);
const NAMED_CHAT_PROGRESS = new Set(['checking_reports', 'checking_sightings', 'preparing_report', 'preparing_reunion']);

class ChatView {
  constructor(widget, { audience = 'guardian', labels, prompts = ['missing', 'found', 'tag'],
    getClient = () => window.pawApp?.supabase } = {}) {
    this.widget = widget;
    this.panel = widget.querySelector('.chat-popover');
    this.launcher = widget.querySelector('.chat-launcher');
    this.audience = audience;
    this.labels = labels;
    this.prompts = prompts;
    this.getClient = getClient;
    this.userId = null;
    this.messages = [];
    this.draft = '';
    this.pending = '';
    this.errorCode = '';

    this.launcher.addEventListener('click', () => this.setOpen(this.panel.hidden));
    this.widget.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.panel.hidden) {
        event.stopPropagation();
        this.setOpen(false);
      }
    });
  }

  setUser(userId) {
    if (userId === this.userId) return;
    this.userId = userId;
    this.widget.hidden = !userId;
    this.setOpen(false, false);
    this.reset();
  }

  setOpen(open, manageFocus = true) {
    if (open && !this.userId) return;
    if (open) this.render(this.panel);
    this.panel.hidden = !open;
    if (open) this.fitInput();
    this.launcher.setAttribute('aria-expanded', String(open));
    if (manageFocus) (open ? this.closeButton : this.launcher).focus();
  }

  reset() {
    this.streamReader?.cancel().catch(() => {});
    this.messages = [];
    this.draft = '';
    this.pending = '';
    this.errorCode = '';
    this.action = null;
    this.openingAction = false;
    this.update();
  }

  t(key) {
    return this.labels ? (this.labels[key] ?? '') : window.pawI18n.t(`chat.${key}`);
  }

  applyLabels() {
    const attributes = Object.entries({
      'data-i18n': 'textContent',
      'data-i18n-aria': 'aria-label',
      'data-i18n-placeholder': 'placeholder',
      'data-i18n-title': 'title',
    });
    for (const [key, attribute] of attributes) {
      this.root.querySelectorAll(`[${key}]`).forEach((element) => {
        const label = this.t(element.getAttribute(key).slice('chat.'.length));
        if (attribute === 'textContent') element.textContent = label;
        else element.setAttribute(attribute, label);
      });
    }
  }

  render(container) {
    if (this.root?.parentNode === container) return;

    container.innerHTML = `
      <section class="chat-page" aria-labelledby="chat-title">
        <header class="chat-header">
          <span class="chat-avatar" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg></span>
          <div class="chat-heading">
            <h2 id="chat-title" data-i18n="chat.title"></h2>
            <p data-i18n="chat.subtitle"></p>
          </div>
          <button type="button" class="chat-icon-btn chat-new" aria-label="New chat" title="New chat" data-i18n-aria="chat.new" data-i18n-title="chat.new">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button type="button" class="chat-icon-btn chat-close" aria-label="Close chat" data-i18n-aria="chat.close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="chat-panel">
          <div class="chat-transcript">
            <div class="chat-empty">
              <span class="chat-avatar" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg></span>
              <h3 data-i18n="chat.empty"></h3>
              <div class="chat-suggestions">
                ${this.prompts.map((key) => `<button type="button" data-prompt="${key}" data-i18n="chat.${key}"></button>`).join('')}
              </div>
            </div>
            <div class="chat-log" role="log" aria-labelledby="chat-title" aria-relevant="additions"></div>
            <div class="chat-action" hidden>
              <strong></strong>
              <p></p>
              <button type="button" class="btn btn-primary"></button>
            </div>
            <div class="chat-thinking" role="status" hidden>
              <span class="chat-thinking-label" dir="auto"></span>
              <span class="chat-dot" aria-hidden="true"></span><span class="chat-dot" aria-hidden="true"></span><span class="chat-dot" aria-hidden="true"></span>
            </div>
          </div>
          <form class="chat-form">
            <p class="chat-error" role="alert" hidden></p>
            <div class="chat-composer">
              <textarea rows="1" maxlength="2000" required aria-label="Your message" data-i18n-aria="chat.message" data-i18n-placeholder="chat.placeholder"></textarea>
              <button type="submit" class="chat-send" aria-label="Send" title="Send" data-i18n-aria="chat.send" data-i18n-title="chat.send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              </button>
            </div>
            <p class="chat-privacy" data-i18n="chat.privacy"></p>
          </form>
        </div>
      </section>`;

    this.root = container.querySelector('.chat-page');
    this.form = this.root.querySelector('form');
    this.input = this.root.querySelector('textarea');
    this.log = this.root.querySelector('.chat-log');
    this.actionBox = this.root.querySelector('.chat-action');
    this.actionButton = this.actionBox.querySelector('button');
    this.closeButton = this.root.querySelector('.chat-close');
    this.newButton = this.root.querySelector('.chat-new');
    this.sendButton = this.root.querySelector('.chat-send');
    this.empty = this.root.querySelector('.chat-empty');
    this.thinking = this.root.querySelector('.chat-thinking');
    this.thinkingLabel = this.root.querySelector('.chat-thinking-label');
    this.error = this.root.querySelector('.chat-error');

    this.input.addEventListener('input', () => {
      this.draft = this.input.value;
      this.fitInput();
      this.sendButton.disabled = !!this.pending || !this.draft.trim();
      this.newButton.disabled = !this.messages.length && !this.pending && !this.draft.trim();
    });
    this.input.addEventListener('keydown', (event) => {
      // Enter sends, Shift+Enter adds a line; ignore the Enter that confirms an IME composition.
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (this.form.checkValidity()) this.form.requestSubmit();
      }
    });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (document.activeElement === this.sendButton) this.input.focus();
      this.send();
    });
    this.closeButton.addEventListener('click', () => this.setOpen(false));
    this.actionButton.addEventListener('click', () => this.openAction());
    this.newButton.addEventListener('click', () => {
      this.reset();
      this.input.focus();
    });
    this.empty.querySelectorAll('[data-prompt]').forEach((button) => {
      button.addEventListener('click', () => {
        this.draft = this.t(button.dataset.prompt);
        this.update();
        this.input.focus();
      });
    });

    this.applyLabels();
    this.update();
  }

  fitInput() {
    this.input.style.height = 'auto';
    // A hidden panel measures 0; leave the CSS min-height in charge until it is visible.
    const height = this.input.scrollHeight;
    if (height) this.input.style.height = `${Math.min(height, 120)}px`;
  }

  showProgress(stage, petName) {
    if (!CHAT_PROGRESS.has(stage)) return;
    const key = typeof petName === 'string' && petName && NAMED_CHAT_PROGRESS.has(stage) ? `${stage}_named` : stage;
    const label = this.t(key).replace('{pet}', () => petName);
    if (!label || this.thinkingLabel.textContent === label) return;
    const transcript = this.log.parentElement;
    const atBottom = transcript.scrollHeight - transcript.clientHeight - transcript.scrollTop < 20;
    this.thinkingLabel.textContent = label;
    if (atBottom) transcript.scrollTop = transcript.scrollHeight;
  }

  async readReply(data, history) {
    if (!(data instanceof Response) || !data.body) return data;
    if (this.messages !== history) {
      await data.body.cancel();
      return null;
    }
    const reader = data.body.getReader();
    this.streamReader = reader;
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (this.messages === history) {
        const { value, done } = await reader.read();
        if (done || this.messages !== history) return null;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop();
        for (const frame of frames) {
          if (!frame.startsWith('data: ')) continue;
          const event = JSON.parse(frame.slice(6));
          if (event.type === 'result') return event.data;
          if (event.type === 'progress') this.showProgress(event.stage, event.petName);
        }
      }
      return null;
    } finally {
      if (this.streamReader === reader) this.streamReader = null;
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  async openAction() {
    const action = this.action;
    if (!action || this.openingAction) return;
    const store = window.pawStore;
    if (action.kind === 'missing' && window.location.hash === '#report') {
      this.errorCode = 'finish_report';
      this.update();
      return;
    }
    this.openingAction = true;
    this.errorCode = '';
    this.update();

    let opened = false;
    try {
      await store.syncFromSupabase();
      if (this.action !== action || this.panel.hidden) return;
      if (action.kind === 'missing') {
        const pet = store.getPetById(action.petId);
        if (pet && store.isMyPet(pet) && !['lost', 'missing', 'impounded'].includes(pet.status)
          && !store.getActiveMissingReportForPet(pet.id) && window.reportManager) {
          window.reportManager.openReportModal('missing', pet.id, { missingDraft: action });
          opened = true;
        }
      } else {
        opened = window.publicView?.openMarkFound(action.petId || action.reportId, action) === true;
      }
      if (opened) {
        this.action = null;
        this.setOpen(false, false);
        if (action.kind === 'missing') {
          requestAnimationFrame(() => {
            const title = document.querySelector('#report-pet-modal h1, #report-pet-modal h2');
            if (title) {
              title.tabIndex = -1;
              title.focus();
            }
          });
        }
      }
    } catch (error) {
      console.warn('Could not open the PawTrack Assistant form', error);
    } finally {
      if (this.action === action || opened) {
        this.openingAction = false;
        if (!opened && !this.panel.hidden) this.errorCode = 'action_unavailable';
        this.update();
      }
    }
  }

  update() {
    if (!this.root?.isConnected) return;
    const turns = this.pending ? [...this.messages, { role: 'user', text: this.pending }] : this.messages;
    const bubbles = turns.map(({ role, text }, index) => {
      const existing = this.log.children[index];
      if (existing?.dataset.role === role && existing.lastChild.textContent === text) return existing;
      const bubble = document.createElement('article');
      bubble.className = 'chat-message';
      bubble.dataset.role = role;
      const speaker = document.createElement('strong');
      const speakerKey = role === 'user' ? 'you' : 'title';
      speaker.dataset.i18n = `chat.${speakerKey}`;
      speaker.textContent = this.t(speakerKey);
      const content = document.createElement('p');
      content.textContent = text;
      bubble.append(speaker, content);
      return bubble;
    });
    // Keep existing live-region entries in place so assistive technology announces only new turns.
    bubbles.forEach((bubble, index) => {
      const current = this.log.children[index];
      if (!current) this.log.append(bubble);
      else if (current !== bubble) current.replaceWith(bubble);
    });
    while (this.log.children.length > bubbles.length) this.log.lastElementChild.remove();

    this.empty.hidden = turns.length > 0;
    this.actionBox.hidden = !this.action;
    if (this.action) {
      const { kind, petName, location, lastSeenAt } = this.action;
      const titleKey = kind === 'missing' ? 'report_draft' : 'reunion_draft';
      const buttonKey = this.openingAction ? 'opening_form' : kind === 'missing' ? 'review_report' : 'review_reunion';
      const date = lastSeenAt ? new Date(lastSeenAt) : null;
      const dateLabel = date && !Number.isNaN(date.valueOf())
        ? new Intl.DateTimeFormat(window.pawI18n.getLang() === 'fil' ? 'fil-PH' : 'en-PH', {
          dateStyle: 'medium', timeStyle: 'short',
        }).format(date) : '';
      this.actionBox.querySelector('strong').textContent = `${this.t(titleKey)} · ${petName}`;
      const details = this.actionBox.querySelector('p');
      details.textContent = [location, dateLabel].filter(Boolean).join(' · ');
      details.hidden = !details.textContent;
      this.actionButton.textContent = this.t(buttonKey);
      this.actionButton.disabled = this.openingAction;
    }
    this.thinking.hidden = !this.pending;
    this.newButton.disabled = !turns.length && !this.draft.trim();
    this.sendButton.disabled = !!this.pending || this.openingAction || !this.draft.trim();
    this.input.readOnly = !!this.pending || this.openingAction;
    if (this.input.value !== this.draft) this.input.value = this.draft;
    this.fitInput();
    this.error.hidden = !this.errorCode;
    this.error.textContent = this.errorCode ? this.t(this.errorCode) : '';
    if (this.errorCode) this.error.dataset.i18n = `chat.${this.errorCode}`;
    else delete this.error.dataset.i18n;
    const transcript = this.log.parentElement;
    transcript.scrollTop = transcript.scrollHeight;
  }

  async send() {
    const text = this.draft.trim();
    if (!text || this.pending || this.openingAction) return;
    const history = this.messages;
    const userId = this.userId;
    this.draft = '';
    this.pending = text;
    this.action = null;
    this.errorCode = '';
    this.showProgress('reading_request');
    this.update();

    let reply;
    let action;
    let errorCode = 'unavailable';
    try {
      const client = this.getClient();
      const auth = await client?.auth.getSession();
      const session = auth?.data.session;
      if (this.messages !== history) return;
      if (!userId || session?.user.id !== userId) {
        errorCode = 'sign_in';
      } else {
        const messages = [...history.slice(-12), { role: 'user', text }];
        const { data, error } = await client.functions.invoke('pawtrack-chat', {
          headers: { Accept: 'text/event-stream', Authorization: `Bearer ${session.access_token}` },
          body: { messages, locale: window.pawI18n?.getLang() ?? 'en', audience: this.audience },
        });
        const result = error ? null : await this.readReply(data, history);
        if (error || result?.code) {
          const detail = error ? await error.context?.json?.().catch(() => null) : result;
          const knownCodes = ['sign_in', 'quota', 'rate_limit', 'rephrase', 'unavailable'];
          if (knownCodes.includes(detail?.code)) errorCode = detail.code;
          else if (error?.context?.status === 401) errorCode = 'sign_in';
        } else if (typeof result?.reply === 'string' && result.reply.trim()) {
          reply = result.reply;
          if (this.audience === 'guardian' && ['missing', 'found'].includes(result.action?.kind)) action = result.action;
        }
      }
    } catch {
      // Keep the message available for a retry if the request fails.
    }

    if (this.messages !== history) return;
    this.pending = '';
    if (reply) {
      history.push({ role: 'user', text }, { role: 'model', text: reply });
      this.action = action ?? null;
    } else {
      this.errorCode = errorCode;
      if (!this.draft) this.draft = text;
    }
    this.update();
  }
}

const guardianChatWidget = document.getElementById('chat-widget');
if (guardianChatWidget) window.chatView = new ChatView(guardianChatWidget);
