const path = require('path')

const ROOT_DIR = path.join(__dirname, '..', '..')
const ASSETS_DIR = path.join(ROOT_DIR, 'assets')

module.exports = {
    APP_NAME: 'Centrio',
    APP_USER_MODEL_ID: 'me.centrio.app',
    APP_PROTOCOL: 'centrio',

    API_URL: 'https://api.centrio.me',

    WINDOW: {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#1e1e1e'
    },

    PATHS: {
        ROOT_DIR,
        ASSETS_DIR,
        ICON: process.platform === 'win32'
            ? path.join(ASSETS_DIR, 'logotype.ico')
            : path.join(ASSETS_DIR, 'icon.png'),
        TRAY_ICON: path.join(ASSETS_DIR, 'tray-icon.png'),
        LOGO: path.join(ASSETS_DIR, 'logo.png'),
        PRELOAD: path.join(ROOT_DIR, 'preload.js'),
        INDEX_HTML: path.join(ROOT_DIR, 'index.html')
    },

    IPC_CHANNELS: {
        UPDATE_STATUS: 'update-status',
        APP_HIDDEN: 'app-hidden',
        APP_READY_TO_SHOW: 'app-ready-to-show',
        PROTOCOL_URL: 'protocol-url',
        NOTIFICATION_CLICKED_ID: 'notification-clicked-id',
        SWITCH_MESSENGER_INDEX: 'switch-messenger-index',
        SWITCH_MESSENGER_NEXT: 'switch-messenger-next',
        SWITCH_MESSENGER_PREV: 'switch-messenger-prev',
        RELOAD_ACTIVE: 'reload-active',
        OPEN_SETTINGS: 'open-settings'
    },

    OAUTH: {
        GOOGLE: {
            PORT: 9842,
            CALLBACK_PATH: '/oauth/google/callback',
            AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
            EXCHANGE_URL: 'https://api.centrio.me/api/auth/google/electron-code'
        },
        GITHUB: {
            PORT: 9843,
            CALLBACK_PATH: '/oauth/github/callback',
            AUTH_URL: 'https://github.com/login/oauth/authorize',
            EXCHANGE_URL: 'https://api.centrio.me/api/auth/github/electron-code'
        },
        YANDEX: {
            AUTH_URL: 'https://oauth.yandex.ru/authorize',
            EXCHANGE_URL: 'https://api.centrio.me/api/auth/yandex/electron'
        },
        TELEGRAM: {
            PORT: 9844,
            CALLBACK_PATH: '/oauth/telegram/callback',
            AUTH_PAGE_URL: 'https://api.centrio.me/api/auth/telegram/electron',
            EXCHANGE_URL: 'https://api.centrio.me/api/auth/telegram/electron'
        }
    }
}