"""
Patch centrio-api auth routes so that when ?from=desktop is passed,
OAuth callbacks redirect to centrio://auth?accessToken=...&refreshToken=...
instead of the web frontend URL.
"""
path = '/var/www/centrio-api/src/routes/auth.js'
with open(path, 'r') as f:
    code = f.read()

# ── Google /google — pass state=desktop when from=desktop ────────
old_google_init = """router.get('/google', (req, res) => {
  const url = googleWebClient.generateAuthUrl({
    access_type: 'offline', scope: ['email', 'profile'], prompt: 'consent'
  })
  res.redirect(url)
})"""

new_google_init = """router.get('/google', (req, res) => {
  const from = req.query.from || ''
  const url = googleWebClient.generateAuthUrl({
    access_type: 'offline', scope: ['email', 'profile'], prompt: 'consent',
    state: from === 'desktop' ? 'desktop' : undefined
  })
  res.redirect(url)
})"""

code = code.replace(old_google_init, new_google_init)

# ── Google callback — detect state=desktop and redirect to deep link ──
old_google_cb_end = """    const accessToken  = generateAccessToken(user.id)
    const refreshToken = await generateRefreshToken(user.id, req.headers['user-agent'], req.ip)
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?accessToken=${accessToken}&refreshToken=${refreshToken}`)
  } catch (err) {
    console.error('Google callback error:', err)
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`)
  }
})"""

new_google_cb_end = """    const accessToken  = generateAccessToken(user.id)
    const refreshToken = await generateRefreshToken(user.id, req.headers['user-agent'], req.ip)
    if (req.query.state === 'desktop') {
      return res.redirect(`centrio://auth?accessToken=${accessToken}&refreshToken=${refreshToken}`)
    }
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?accessToken=${accessToken}&refreshToken=${refreshToken}`)
  } catch (err) {
    console.error('Google callback error:', err)
    if (req.query.state === 'desktop') {
      return res.redirect('centrio://auth?error=google_failed')
    }
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`)
  }
})"""

code = code.replace(old_google_cb_end, new_google_cb_end)

# ── Yandex /yandex — pass state=desktop ──────────────────────────
old_yandex_init = """router.get('/yandex', (req, res) => {
  const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${process.env.YANDEX_CLIENT_ID}&redirect_uri=${process.env.API_URL}/api/auth/yandex/callback`
  res.redirect(url)
})"""

new_yandex_init = """router.get('/yandex', (req, res) => {
  const from = req.query.from || ''
  const state = from === 'desktop' ? '&state=desktop' : ''
  const url = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${process.env.YANDEX_CLIENT_ID}&redirect_uri=${process.env.API_URL}/api/auth/yandex/callback${state}`
  res.redirect(url)
})"""

code = code.replace(old_yandex_init, new_yandex_init)

# ── Yandex callback — detect state=desktop ───────────────────────
old_yandex_cb_end = """    const accessToken  = generateAccessToken(user.id)
    const refreshToken = await generateRefreshToken(user.id, req.headers['user-agent'], req.ip)
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?accessToken=${accessToken}&refreshToken=${refreshToken}`)
  } catch (err) {
    console.error('Yandex callback error:', err)
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`)
  }
})"""

new_yandex_cb_end = """    const accessToken  = generateAccessToken(user.id)
    const refreshToken = await generateRefreshToken(user.id, req.headers['user-agent'], req.ip)
    if (req.query.state === 'desktop') {
      return res.redirect(`centrio://auth?accessToken=${accessToken}&refreshToken=${refreshToken}`)
    }
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?accessToken=${accessToken}&refreshToken=${refreshToken}`)
  } catch (err) {
    console.error('Yandex callback error:', err)
    if (req.query.state === 'desktop') {
      return res.redirect('centrio://auth?error=yandex_failed')
    }
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`)
  }
})"""

code = code.replace(old_yandex_cb_end, new_yandex_cb_end)

with open(path, 'w') as f:
    f.write(code)

print('auth.js patched')

# verify
with open(path) as f:
    content = f.read()
count = content.count("centrio://auth")
print(f'centrio:// redirects found: {count} (expected 4)')
