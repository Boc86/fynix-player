class SettingsManager {
  constructor() {
    this.defaults = {
      navidrome_server: '',
      navidrome_username: '',
      navidrome_password: '',
      navidrome_proxy: '',
      soulsync_server: '',
      soulsync_apikey: '',
      soulsync_proxy: '',
      crossfade: '0',
      gapless: 'true',
      eqEnabled: 'false',
      equalizer: '',
      eqPreset: 'custom',
      _settingsTab: 'servers',
      _wizard_done: 'false'
    }
    this._jsonKeys = ['equalizer']
  }

  load() {
    const settings = {}
    for (const [key, def] of Object.entries(this.defaults)) {
      const raw = localStorage.getItem(key)
      if (raw === null) {
        settings[key] = def
      } else if (this._jsonKeys.includes(key)) {
        try { settings[key] = JSON.parse(raw) } catch (_) { settings[key] = def }
      } else if (raw === 'true') {
        settings[key] = true
      } else if (raw === 'false') {
        settings[key] = false
      } else {
        settings[key] = raw
      }
    }
    return settings
  }

  save(settings) {
    for (const [key, value] of Object.entries(settings)) {
      if (key in this.defaults) {
        const stored = this._jsonKeys.includes(key) ? JSON.stringify(value) : String(value)
        localStorage.setItem(key, stored)
      }
    }
  }

  get(key) {
    return this.load()[key]
  }

  clear() {
    for (const key of Object.keys(this.defaults)) {
      localStorage.removeItem(key)
    }
  }

  get hasNavidrome() {
    return !!(this.get('navidrome_server') && this.get('navidrome_username') && this.get('navidrome_password'))
  }

  get hasSoulSync() {
    return !!(this.get('soulsync_server') && this.get('soulsync_apikey'))
  }
}

window.SettingsManager = SettingsManager
