path = '/var/www/centrio-api/src/index.js'
with open(path, 'r') as f:
    content = f.read()

if "require('./routes/stats')" in content:
    print('stats route already registered')
else:
    content = content.replace(
        "app.use('/api/sync', require('./routes/sync'))",
        "app.use('/api/stats', require('./routes/stats'))\napp.use('/api/sync', require('./routes/sync'))"
    )
    with open(path, 'w') as f:
        f.write(content)
    print('stats route registered')
