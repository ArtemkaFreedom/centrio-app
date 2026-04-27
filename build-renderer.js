const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const isWatch = process.argv.includes('--watch')
const isProd = process.env.NODE_ENV === 'production'

const projectRoot = process.cwd()
const entryFile = path.join(projectRoot, 'renderer', 'index.js')
const outFile = path.join(projectRoot, 'bundle.js')

if (!fs.existsSync(entryFile)) {
    console.error(`[build-renderer] Entry file not found: ${entryFile}`)
    process.exit(1)
}

const sharedConfig = {
    entryPoints: [entryFile],
    bundle: true,
    outfile: outFile,
    platform: 'browser',
    format: 'iife',
    target: ['chrome120'],
    sourcemap: isProd ? false : 'inline',
    minify: isProd,
    legalComments: 'none',
    logLevel: 'info',
    loader: {
        '.js': 'js',
        '.json': 'json'
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    external: ['electron', 'fs', 'path', 'https', 'http', 'child_process', 'os', 'crypto', 'stream', 'util', 'events', 'net', 'tls', 'zlib']
}

async function build() {
    try {
        if (isWatch) {
            const ctx = await esbuild.context(sharedConfig)
            await ctx.watch()
            console.log('[build-renderer] watching...')
            return
        }

        await esbuild.build(sharedConfig)
        console.log(`[build-renderer] built: ${outFile}`)
    } catch (error) {
        console.error('[build-renderer] build failed')
        console.error(error)
        process.exit(1)
    }
}

build()