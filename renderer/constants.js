const popularMessengers = [
    // ── Топ-8 ─────────────────────────────────────────────────────────
    { name: 'Telegram',         url: 'https://web.telegram.org/k/',         icon: 'assets/logomessenger/telegram.png',      color: '#2AABEE' },
    { name: 'WhatsApp',         url: 'https://web.whatsapp.com',            icon: 'assets/logomessenger/whatsapp.png',      color: '#25D366' },
    { name: 'VK',               url: 'https://vk.com/im',                   icon: 'assets/logomessenger/vk.png',            color: '#0077FF' },
    { name: 'MAX',              url: 'https://web.max.ru/',                 icon: 'assets/logomessenger/max.png',           color: '#FF5C00' },
    { name: 'Mail.ru',          url: 'https://mail.ru',                     icon: 'assets/logomessenger/mailru.png',        color: '#005FF9' },
    { name: 'Яндекс Почта',    url: 'https://mail.yandex.ru',              icon: 'assets/logomessenger/yandex.png',        color: '#FC3F1D' },
    { name: 'Рамблер',         url: 'https://mail.rambler.ru',             icon: 'assets/logomessenger/rambler.png',       color: '#ED1C24' },
    { name: 'Bitrix24',         url: 'https://www.bitrix24.ru',             icon: 'assets/logomessenger/bitrix.png',        color: '#EA4335' },
    // ── Мессенджеры ───────────────────────────────────────────────────
    { name: 'Discord',          url: 'https://discord.com/app',             icon: 'assets/logomessenger/discord.png',       color: '#5865F2' },
    { name: 'Slack',            url: 'https://app.slack.com',               icon: 'assets/logomessenger/slack.png',         color: '#4A154B' },
    { name: 'Viber',            url: 'https://web.viber.com',               icon: 'assets/logomessenger/viber.png',         color: '#7360F2' },
    { name: 'Skype',            url: 'https://web.skype.com',               icon: 'assets/logomessenger/skype.png',         color: '#00AFF0' },
    { name: 'Microsoft Teams',  url: 'https://teams.microsoft.com',         icon: 'assets/logomessenger/teams.png',         color: '#6264A7' },
    { name: 'WeChat',           url: 'https://wx.qq.com',                   icon: 'assets/logomessenger/wechat.png',        color: '#07C160' },
    { name: 'Zoom',             url: 'https://zoom.us/wc',                  icon: 'assets/logomessenger/zoom.png',          color: '#2D8CFF' },
    { name: 'BiP',              url: 'https://bip.com',                     icon: 'assets/logomessenger/bip.png',           color: '#00BDF2' },
    { name: 'Signal',           url: 'https://signal.me',                   icon: 'assets/logomessenger/signal.png',        color: '#3A76F0' },
    { name: 'LINE',             url: 'https://web.line.me',                 icon: 'assets/logomessenger/line.png',          color: '#00B900' },
    { name: 'Messenger',        url: 'https://messenger.com',               icon: 'assets/logomessenger/messenger.png',     color: '#0099FF' },
    { name: 'Instagram',        url: 'https://www.instagram.com/direct/inbox/', icon: 'assets/logomessenger/instagram.png', color: '#E1306C' },
    { name: 'X (Twitter)',      url: 'https://x.com/messages',              icon: 'assets/logomessenger/x.png',            color: '#000000' },
    { name: 'LinkedIn',         url: 'https://www.linkedin.com/messaging',  icon: 'assets/logomessenger/linkedin.png',      color: '#0A66C2' },
    { name: 'Google Chat',      url: 'https://chat.google.com',             icon: 'assets/logomessenger/googlechat.png',    color: '#00897B' },
    { name: 'Rocket.Chat',      url: 'https://open.rocket.chat',            icon: 'assets/logomessenger/rocketchat.png',    color: '#F5455C' },
    { name: 'Mattermost',       url: 'https://mattermost.com',              icon: 'assets/logomessenger/mattermost.png',    color: '#0058CC' },
    // ── Почта ─────────────────────────────────────────────────────────
    { name: 'Gmail',            url: 'https://mail.google.com',             icon: 'assets/logomessenger/gmail.png',         color: '#EA4335' },
    { name: 'Outlook',          url: 'https://outlook.live.com',            icon: 'assets/logomessenger/outlook.png',       color: '#0078D4' },
    { name: 'Yahoo Mail',       url: 'https://mail.yahoo.com',              icon: 'assets/logomessenger/yahoo.png',         color: '#6001D2' },
    { name: 'ProtonMail',       url: 'https://mail.proton.me',              icon: 'assets/logomessenger/protonmail.png',    color: '#6D4AFF' },
    // ── Продуктивность ────────────────────────────────────────────────
    { name: 'Notion',           url: 'https://notion.so',                   icon: 'assets/logomessenger/notion.png',        color: '#000000' },
    { name: 'Trello',           url: 'https://trello.com',                  icon: 'assets/logomessenger/trello.png',        color: '#0052CC' },
    { name: 'Asana',            url: 'https://app.asana.com',               icon: 'assets/logomessenger/asana.png',         color: '#F06A6A' },
    { name: 'ClickUp',          url: 'https://app.clickup.com',             icon: 'assets/logomessenger/clickup.png',       color: '#7B68EE' },
    { name: 'Monday.com',       url: 'https://monday.com',                  icon: 'assets/logomessenger/monday.png',        color: '#F62B54' },
    { name: 'Jira',             url: 'https://jira.atlassian.com',          icon: 'assets/logomessenger/jira.png',          color: '#0052CC' },
    { name: 'GitHub',           url: 'https://github.com',                  icon: 'assets/logomessenger/github.png',        color: '#24292E' },
    { name: 'Figma',            url: 'https://figma.com',                   icon: 'assets/logomessenger/figma.png',         color: '#F24E1E' },
    { name: 'Todoist',          url: 'https://app.todoist.com',             icon: 'assets/logomessenger/todoist.png',       color: '#DB4035' },
    { name: 'Twitch',           url: 'https://twitch.tv',                   icon: 'assets/logomessenger/twitch.png',        color: '#9146FF' },
    { name: 'Zendesk',          url: 'https://www.zendesk.com',             icon: 'assets/logomessenger/zendesk.png',       color: '#03363D' },
    // ── Нейросети ─────────────────────────────────────────────────────────
    { name: 'ChatGPT',          url: 'https://chat.openai.com',             icon: 'assets/logomessenger/chatgpt.png',       color: '#10A37F' },
    { name: 'Claude',           url: 'https://claude.ai',                   icon: 'assets/logomessenger/claude.png',        color: '#CC785C' },
    { name: 'Gemini',           url: 'https://gemini.google.com',           icon: 'assets/logomessenger/gemini.png',        color: '#4285F4' },
    { name: 'Grok',             url: 'https://grok.com',                    icon: 'assets/logomessenger/grok.png',          color: '#000000' },
    { name: 'Perplexity',       url: 'https://www.perplexity.ai',           icon: 'assets/logomessenger/perplexity.png',    color: '#20808D' },
    { name: 'Mistral',          url: 'https://chat.mistral.ai',             icon: 'assets/logomessenger/mistral.png',       color: '#FF7000' },
    { name: 'DeepSeek',         url: 'https://chat.deepseek.com',           icon: 'assets/logomessenger/deepseek.png',      color: '#4D6BFE' },
    { name: 'Copilot',          url: 'https://copilot.microsoft.com',       icon: 'assets/logomessenger/copilot.png',       color: '#0078D4' },
]

const folderIcons = {
    folder: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    work: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    star: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    heart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    chat: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    lock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.8"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="1.8"/></svg>`,
    users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    zap: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    target: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.8"/></svg>`,
    rocket: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    coffee: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><line x1="6" y1="1" x2="6" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="14" y1="1" x2="14" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    music: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.8"/></svg>`,
    book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

const PAGE_SIZE = 8

module.exports = {
    popularMessengers,
    folderIcons,
    PAGE_SIZE
}