const adminChatLabels = {
  title: 'Admin Assistant',
  subtitle: 'Get help with the PawTrack admin console.',
  new: 'New chat',
  close: 'Close chat',
  empty: 'What are you working on?',
  intake: 'How do I record an intake?',
  reports: 'Where can I find missing-pet reports?',
  claims: 'How do I review a claim?',
  message: 'Your message',
  placeholder: 'Ask about the admin console',
  send: 'Send',
  you: 'You',
  reading_request: 'Reading your request…',
  writing_reply: 'Putting together your reply…',
  switching_model: 'Trying another model…',
  privacy: 'Google Gemini processes your messages. Keep personal and case details out of chat.',
  sign_in: 'Sign in with an approved admin account to use chat.',
  quota: 'The assistant is at capacity. Try again in a moment.',
  rate_limit: 'Wait a moment before sending another message.',
  rephrase: 'Try rephrasing your question.',
  unavailable: 'The assistant is unavailable right now. Try sending your message again.',
};

const adminChatWidget = document.getElementById('admin-chat-widget');
if (adminChatWidget) {
  window.adminChatView = new ChatView(adminChatWidget, {
    audience: 'admin',
    labels: adminChatLabels,
    prompts: ['intake', 'reports', 'claims'],
    getClient: () => window.adminApp?.supabase,
  });
}
