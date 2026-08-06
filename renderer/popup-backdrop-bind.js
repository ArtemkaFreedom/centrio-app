// Единая "подложка" для всех попапов (контекстные меню, панель уведомлений,
// панель загрузок). Решает конкретную проблему: клики внутри <webview> не
// всплывают до document (это отдельный процесс рендеринга), поэтому обычный
// document-click-outside для закрытия попапа их не видит.
//
// ВАЖНО (тот же приём, что и в renderer/split.js для #splitHandle/#splitPicker):
// Electron webview перехватывает мышь в своих границах независимо от CSS
// z-index, если элемент-подложка — обычный потомок в DOM-потоке страницы.
// Единственный надёжный способ оказаться "поверх" — position:fixed прямо
// на document.body, вручную подогнанный под рект #contentArea (сайдбар и
// тайтлбар при этом не перекрываются — там обычный DOM-bubbling и так
// работает через document-click листенеры каждого попапа).
//
// Модули-владельцы попапов не знают друг о друге напрямую — координация идёт
// через два DOM-события (тот же паттерн, что уже использует contextmenu-opened
// в context-menus.js):
//   'popup-opened'      — диспатчится, когда какой-либо попап показался
//   'close-all-popups'  — диспатчится, когда что-либо должно закрыть ВСЁ
//                          (клик/правый клик на подложке); каждый попап-модуль
//                          сам вешает на это событие свой close()
function bindPopupBackdrop({ contentArea } = {}) {
    const backdrop = document.getElementById('popupBackdrop')
    if (!backdrop) return

    if (backdrop.parentElement !== document.body) {
        document.body.appendChild(backdrop)
    }
    backdrop.style.position = 'fixed'

    function reposition() {
        if (!contentArea) return
        const rect = contentArea.getBoundingClientRect()
        backdrop.style.left   = `${rect.left}px`
        backdrop.style.top    = `${rect.top}px`
        backdrop.style.width  = `${rect.width}px`
        backdrop.style.height = `${rect.height}px`
    }

    reposition()
    window.addEventListener('resize', reposition)

    // Перетаскивание файла из панели загрузок наружу (см. downloads-bind.js,
    // downloads:start-drag) — настоящий OS-level drag поверх webview. Пока
    // подложка видима (а она видима всё время, что открыта панель загрузок,
    // из которой и тащат файл), она перехватывает мышь над webview и не даёт
    // ОС-дропу долететь до места назначения. На время самого перетаскивания
    // подложку нужно прятать, не закрывая при этом саму панель — как только
    // drag завершится, 'popup-opened' диспатчится заново и подложка вернётся.
    let suspended = false
    document.addEventListener('popup-backdrop-suspend', () => {
        suspended = true
        backdrop.classList.remove('show')
    })
    document.addEventListener('popup-backdrop-resume', () => {
        suspended = false
    })

    document.addEventListener('popup-opened', () => {
        if (suspended) return
        reposition()
        backdrop.classList.add('show')
    })
    document.addEventListener('close-all-popups', () => backdrop.classList.remove('show'))

    function closeAll(e) {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('close-all-popups'))
    }

    backdrop.addEventListener('mousedown', closeAll)
    backdrop.addEventListener('contextmenu', closeAll)
}

module.exports = { bindPopupBackdrop }
