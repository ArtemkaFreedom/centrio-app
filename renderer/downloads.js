function bindDownloads({
    store,
    ipcRenderer,
    invokeIpc,
    tGet
}) {
    function updateDownloadDirUI(dir) {
        const text = document.getElementById('downloadDirText')
        const clearBtn = document.getElementById('clearDownloadDirBtn')
        if (!text || !clearBtn) return

        if (dir) {
            text.textContent = dir
            text.style.color = 'var(--text-primary)'
            clearBtn.style.display = 'block'
        } else {
            text.textContent = tGet('settings.downloadDirEmpty')
            text.style.color = 'var(--text-secondary)'
            clearBtn.style.display = 'none'
        }
    }

    function bind() {
        document.getElementById('chooseDownloadDirBtn').addEventListener('click', async () => {
            const result = await invokeIpc('choose-download-dir')
            if (!result.success) return

            const dir = result.data
            if (dir) {
                store.set('settings.downloadDir', dir)
                updateDownloadDirUI(dir)
                ipcRenderer.send('set-download-dir', dir)
            }
        })

        document.getElementById('clearDownloadDirBtn').addEventListener('click', () => {
            store.set('settings.downloadDir', '')
            updateDownloadDirUI('')
            ipcRenderer.send('set-download-dir', '')
        })

        document.getElementById('settingAskDownload').addEventListener('change', (e) => {
            store.set('settings.askDownload', e.target.checked)
            ipcRenderer.send('set-ask-download', e.target.checked)
        })
    }

    return {
        bind,
        updateDownloadDirUI
    }
}

module.exports = {
    bindDownloads
}