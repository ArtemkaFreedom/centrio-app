function ok(data = null) {
    return {
        success: true,
        data
    }
}

function fail(error = 'Unknown error') {
    return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
    }
}

async function wrapIpc(handler) {
    try {
        const data = await handler()
        return ok(data)
    } catch (error) {
        return fail(error)
    }
}

module.exports = {
    ok,
    fail,
    wrapIpc
}