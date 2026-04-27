const { ipcRenderer } = require('electron')

function unwrapIpcResult(result) {
    if (!result || typeof result !== 'object') {
        return {
            success: true,
            data: result
        }
    }

    if (typeof result.success === 'boolean') {
        return result
    }

    if ('error' in result) {
        return {
            success: false,
            error: result.error
        }
    }

    return {
        success: true,
        data: result
    }
}

async function invokeIpc(channel, ...args) {
    const raw = await ipcRenderer.invoke(channel, ...args)
    return unwrapIpcResult(raw)
}

module.exports = {
    ipcRenderer,
    unwrapIpcResult,
    invokeIpc
}