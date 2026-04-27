const ElectronStore = require('electron-store')

const StoreCtor = ElectronStore.default || ElectronStore
const store = new StoreCtor()

module.exports = store