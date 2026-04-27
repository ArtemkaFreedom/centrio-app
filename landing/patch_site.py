import re

# ═══════════════════════════════════════════════════════════════════
# PATCH page.tsx — update prices + team callout + button targets
# ═══════════════════════════════════════════════════════════════════
with open('/var/www/centrio-web/src/app/page.tsx', 'r') as f:
    page = f.read()

# -- Pro Monthly price: 199 → 299
page = page.replace(
    '<span style={{ fontSize: 44, fontWeight: 900, color: \'#fff\', letterSpacing: \'-.03em\' }}>199 ₽</span>',
    '<span style={{ fontSize: 44, fontWeight: 900, color: \'#fff\', letterSpacing: \'-.03em\' }}>299 ₽</span>'
)

# -- Pro Annual per-month price: 133 → 199
page = page.replace(
    '<span style={{ fontSize: 44, fontWeight: 900, color: \'#fff\', letterSpacing: \'-.03em\' }}>133 ₽</span>',
    '<span style={{ fontSize: 44, fontWeight: 900, color: \'#fff\', letterSpacing: \'-.03em\' }}>199 ₽</span>'
)

# -- Pro Annual strikethrough + actual price: 2388 → 3588, 1590 → 2499
page = page.replace('2 388 ₽', '3 588 ₽')
page = page.replace('1 590 ₽/год', '2 499 ₽/год')

# -- Buy buttons → /dashboard instead of /auth/login
page = page.replace(
    '<a href="/auth/login" className="btn-plan-ghost" style={{ borderColor: \'rgba(99,102,241,0.3)\', color: \'#a78bfa\' }}>{t.plan_month_btn}</a>',
    '<a href="/dashboard" className="btn-plan-ghost" style={{ borderColor: \'rgba(99,102,241,0.3)\', color: \'#a78bfa\' }}>{t.plan_month_btn}</a>'
)
page = page.replace(
    '<a href="/auth/login" className="btn-plan-primary">{t.plan_year_btn}</a>',
    '<a href="/dashboard" className="btn-plan-primary">{t.plan_year_btn}</a>'
)

# -- Add Team callout after pricing grid closing div
team_callout = '''
            {/* TEAM */}
            <div className="pricing-card month" style={{ borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.04)' }}>
              <div className="plan-top">
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#34d399', marginBottom: 12 }}>{t.plan_team}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, color: '#fff', letterSpacing: '-.03em' }}>699 ₽</span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>/мес</span>
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>{t.plan_team_sub}</div>
              </div>
              <div className="plan-btn-wrap" style={{ padding: '20px 28px 0' }}>
                <a href="/dashboard" className="btn-plan-ghost" style={{ borderColor: 'rgba(16,185,129,0.3)', color: '#34d399' }}>{t.plan_team_btn}</a>
              </div>
              <div className="plan-feats">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {t.feat_items_team.map((txt, i) => (
                    <div key={i} className="check-row">
                      <div className="ci-ok"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{txt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>'''

# Replace the closing of the pricing grid (the two </div> after year card feats)
page = page.replace(
    '''                </div>
              </div>
            </div>

          </div>
          <div style={{ textAlign: 'center', marginTop: 32''',
    '''                </div>
              </div>
            </div>
''' + team_callout + '''
          <div style={{ textAlign: 'center', marginTop: 32'''
)

with open('/var/www/centrio-web/src/app/page.tsx', 'w') as f:
    f.write(page)

print('page.tsx patched')

# ═══════════════════════════════════════════════════════════════════
# PATCH i18n.ts — update plan keys
# ═══════════════════════════════════════════════════════════════════
with open('/var/www/centrio-web/src/lib/i18n.ts', 'r') as f:
    i18n = f.read()

# ── Russian ────────────────────────────────────────────────────────
i18n = i18n.replace(
    "plan_year_badge: '⚡ Выгоднее всего', plan_year_save: 'Экономия 798 ₽', plan_year_btn: 'Купить на год — 1 590 ₽'",
    "plan_year_badge: '⚡ Выгоднее всего', plan_year_save: 'Экономия 1 089 ₽', plan_year_btn: 'Купить на год — 2 499 ₽', plan_team: 'Команда', plan_team_sub: 'За пользователя', plan_team_btn: 'Подключить команду'"
)
i18n = i18n.replace(
    "feat_items_free: ['До 5 мессенджеров', 'Три темы на выбор', 'Уведомления', 'Прокси-поддержка'],",
    "feat_items_free: ['1 устройство', 'До 5 мессенджеров', 'Три темы на выбор', 'Уведомления', 'Статистика использования'],",
)
i18n = i18n.replace(
    "feat_items_no: ['Облачная синхронизация', 'Папки', 'Приоритетная поддержка'],",
    "feat_items_no: ['Облачная синхронизация', 'Папки', 'Управление устройствами'],",
)
i18n = i18n.replace(
    "feat_items_pro: ['Неограниченные мессенджеры', 'Облачная синхронизация', 'Папки и группировка', 'Все функции базового', 'Поддержка в чате'],",
    "feat_items_pro: ['До 5 устройств', 'Неограниченные мессенджеры', 'Облачная синхронизация', 'Папки и группировка', 'Статистика и аналитика', 'Приоритетная поддержка'],",
)
i18n = i18n.replace(
    "feat_items_pro_no: ['Приоритетная поддержка', 'Ранний доступ'],",
    "feat_items_pro_no: ['Командное управление'],",
)
i18n = i18n.replace(
    "feat_items_pro_year: ['Неограниченные мессенджеры', 'Облачная синхронизация', 'Папки и группировка', 'Все функции базового', 'Приоритетная поддержка', 'Ранний доступ к функциям', 'Обновления весь год'],",
    "feat_items_pro_year: ['До 5 устройств', 'Неограниченные мессенджеры', 'Облачная синхронизация', 'Папки и группировка', 'Статистика и аналитика', 'Приоритетная поддержка', 'Ранний доступ к функциям'],\n    feat_items_team: ['Неограниченно устройств', 'Всё из Pro', 'Командное рабочее пространство', 'Общий доступ к настройкам', 'Аналитика команды', 'API-доступ', 'SLA-поддержка'],",
)

# ── English ───────────────────────────────────────────────────────
i18n = i18n.replace(
    "plan_year: 'Pro — Yearly', plan_year_badge: '⚡ Best value', plan_year_save: 'Save 34%', plan_year_btn: 'Buy yearly — $16/yr'",
    "plan_year: 'Pro — Yearly', plan_year_badge: '⚡ Best value', plan_year_save: 'Save 30%', plan_year_btn: 'Buy yearly — 2 499 ₽', plan_team: 'Team', plan_team_sub: 'Per user / month', plan_team_btn: 'Set up team'"
)
i18n = i18n.replace(
    "feat_items_free: ['Up to 5 messengers', 'Three themes', 'Notifications', 'Proxy support'],",
    "feat_items_free: ['1 device', 'Up to 5 messengers', 'Three themes', 'Notifications', 'Usage stats'],",
)
i18n = i18n.replace(
    "feat_items_no: ['Cloud sync', 'Folders', 'Priority support'],",
    "feat_items_no: ['Cloud sync', 'Folders', 'Device management'],",
)
i18n = i18n.replace(
    "feat_items_pro: ['Unlimited messengers', 'Cloud sync', 'Folders & grouping', 'All basic features', 'Chat support'],",
    "feat_items_pro: ['Up to 5 devices', 'Unlimited messengers', 'Cloud sync', 'Folders & grouping', 'Analytics', 'Priority support'],",
)
i18n = i18n.replace(
    "feat_items_pro_no: ['Priority support', 'Early access'],",
    "feat_items_pro_no: ['Team management'],",
)
i18n = i18n.replace(
    "feat_items_pro_year: ['Unlimited messengers', 'Cloud sync', 'Folders & grouping', 'All basic features', 'Priority support', 'Early access to features', 'Updates all year'],",
    "feat_items_pro_year: ['Up to 5 devices', 'Unlimited messengers', 'Cloud sync', 'Folders & grouping', 'Analytics', 'Priority support', 'Early access'],\n    feat_items_team: ['Unlimited devices', 'Everything in Pro', 'Team workspace', 'Shared settings', 'Team analytics', 'API access', 'SLA support'],",
)

# ── Chinese ───────────────────────────────────────────────────────
i18n = i18n.replace(
    "plan_year: 'Pro — 年付', plan_year_badge: '⚡ 最佳性价比', plan_year_save: '节省34%', plan_year_btn: '按年购买'",
    "plan_year: 'Pro — 年付', plan_year_badge: '⚡ 最佳性价比', plan_year_save: '节省30%', plan_year_btn: '按年购买 — 2 499₽', plan_team: '团队版', plan_team_sub: '每用户/月', plan_team_btn: '组建团队'"
)
i18n = i18n.replace(
    "feat_items_free: ['最多5个通讯工具', '三款主题', '通知', '代理支持'],",
    "feat_items_free: ['1台设备', '最多5个通讯工具', '三款主题', '通知', '使用统计'],",
)
i18n = i18n.replace(
    "feat_items_no: ['云端同步', '文件夹', '优先支持'],",
    "feat_items_no: ['云端同步', '文件夹', '设备管理'],",
)
i18n = i18n.replace(
    "feat_items_pro: ['无限通讯工具', '云端同步', '文件夹分组', '所有基础功能', '聊天支持'],",
    "feat_items_pro: ['最多5台设备', '无限通讯工具', '云端同步', '文件夹分组', '数据分析', '优先支持'],",
)
i18n = i18n.replace(
    "feat_items_pro_no: ['优先支持', '抢先体验'],",
    "feat_items_pro_no: ['团队管理'],",
)
i18n = i18n.replace(
    "feat_items_pro_year: ['无限通讯工具', '云端同步', '文件夹分组', '所有基础功能', '优先支持', '抢先体验新功能', '全年更新'],",
    "feat_items_pro_year: ['最多5台设备', '无限通讯工具', '云端同步', '文件夹分组', '数据分析', '优先支持', '抢先体验'],\n    feat_items_team: ['无限设备', 'Pro所有功能', '团队工作空间', '共享设置', '团队分析', 'API访问', 'SLA支持'],",
)

# ── French ───────────────────────────────────────────────────────
i18n = i18n.replace(
    "plan_year: 'Pro — Annuel', plan_year_badge: '⚡ Meilleure offre', plan_year_save: 'Économisez 34%', plan_year_btn: 'Acheter annuel'",
    "plan_year: 'Pro — Annuel', plan_year_badge: '⚡ Meilleure offre', plan_year_save: 'Économisez 30%', plan_year_btn: 'Acheter annuel — 2 499₽', plan_team: 'Équipe', plan_team_sub: 'Par utilisateur/mois', plan_team_btn: 'Créer une équipe'"
)
i18n = i18n.replace(
    "feat_items_free: [\"Jusqu'à 5 messageries\", 'Trois thèmes', 'Notifications', 'Support proxy'],",
    "feat_items_free: ['1 appareil', \"Jusqu'à 5 messageries\", 'Trois thèmes', 'Notifications', 'Statistiques'],",
)
i18n = i18n.replace(
    "feat_items_no: ['Synchronisation cloud', 'Dossiers', 'Support prioritaire'],",
    "feat_items_no: ['Synchronisation cloud', 'Dossiers', 'Gestion des appareils'],",
)
i18n = i18n.replace(
    "feat_items_pro: ['Messageries illimitées', 'Synchronisation cloud', 'Dossiers & groupes', 'Toutes les fonctions de base', 'Support par chat'],",
    "feat_items_pro: [\"Jusqu'à 5 appareils\", 'Messageries illimitées', 'Synchronisation cloud', 'Dossiers & groupes', 'Analytique', 'Support prioritaire'],",
)
i18n = i18n.replace(
    "feat_items_pro_no: ['Support prioritaire', 'Accès anticipé'],",
    "feat_items_pro_no: ['Gestion d\\'équipe'],",
)
i18n = i18n.replace(
    "feat_items_pro_year: ['Messageries illimitées', 'Synchronisation cloud', 'Dossiers & groupes', 'Toutes les fonctions de base', 'Support prioritaire', 'Accès anticipé aux fonctions', \"Mises à jour toute l'année\"],",
    "feat_items_pro_year: [\"Jusqu'à 5 appareils\", 'Messageries illimitées', 'Synchronisation cloud', 'Dossiers & groupes', 'Analytique', 'Support prioritaire', 'Accès anticipé'],\n    feat_items_team: ['Appareils illimités', 'Tout de Pro', 'Espace équipe', 'Paramètres partagés', 'Analytique équipe', 'Accès API', 'Support SLA'],",
)

# ── Italian ───────────────────────────────────────────────────────
i18n = i18n.replace(
    "plan_year: 'Pro — Annuale', plan_year_badge: '⚡ Miglior valore', plan_year_save: 'Risparmia 34%', plan_year_btn: 'Acquista annuale'",
    "plan_year: 'Pro — Annuale', plan_year_badge: '⚡ Miglior valore', plan_year_save: 'Risparmia 30%', plan_year_btn: 'Acquista annuale — 2 499₽', plan_team: 'Team', plan_team_sub: 'Per utente/mese', plan_team_btn: 'Crea un team'"
)
i18n = i18n.replace(
    "feat_items_free: ['Fino a 5 app di messaggistica', 'Tre temi', 'Notifiche', 'Supporto proxy'],",
    "feat_items_free: ['1 dispositivo', 'Fino a 5 app di messaggistica', 'Tre temi', 'Notifiche', 'Statistiche utilizzo'],",
)
i18n = i18n.replace(
    "feat_items_no: ['Sincronizzazione cloud', 'Cartelle', 'Supporto prioritario'],",
    "feat_items_no: ['Sincronizzazione cloud', 'Cartelle', 'Gestione dispositivi'],",
)
i18n = i18n.replace(
    "feat_items_pro: ['App illimitate', 'Sincronizzazione cloud', 'Cartelle e raggruppamento', 'Tutte le funzioni base', 'Supporto via chat'],",
    "feat_items_pro: ['Fino a 5 dispositivi', 'App illimitate', 'Sincronizzazione cloud', 'Cartelle e raggruppamento', 'Analisi', 'Supporto prioritario'],",
)
i18n = i18n.replace(
    "feat_items_pro_no: ['Supporto prioritario', 'Accesso anticipato'],",
    "feat_items_pro_no: ['Gestione del team'],",
)
i18n = i18n.replace(
    "feat_items_pro_year: ['App illimitate', 'Sincronizzazione cloud', 'Cartelle e raggruppamento', 'Tutte le funzioni base', 'Supporto prioritario', 'Accesso anticipato alle funzioni', 'Aggiornamenti per tutto l\\'anno'],",
    "feat_items_pro_year: ['Fino a 5 dispositivi', 'App illimitate', 'Sincronizzazione cloud', 'Cartelle e raggruppamento', 'Analisi', 'Supporto prioritario', 'Accesso anticipato'],\n    feat_items_team: ['Dispositivi illimitati', 'Tutto di Pro', 'Spazio di lavoro team', 'Impostazioni condivise', 'Analisi team', 'Accesso API', 'Supporto SLA'],",
)

with open('/var/www/centrio-web/src/lib/i18n.ts', 'w') as f:
    f.write(i18n)

print('i18n.ts patched')
print('All patches applied successfully!')
