class SettingsManager {
  constructor() {
    this.defaults = {
      navidrome_server: '',
      navidrome_username: '',
      navidrome_password: '',
      navidrome_proxy: '',
      soulsync_server: '',
      soulsync_apikey: '',
      soulsync_proxy: ''
    }
  }

  load() {
    const settings = {}
    for (const [key, def] of Object.entries(this.defaults)) {
      settings[key] = localStorage.getItem(key) ?? def
    }
    return settings
  }

  save(settings) {
    for (const [key, value] of Object.entries(settings)) {
      if (key in this.defaults) {
        localStorage.setItem(key, value)
      }
    }
  }

  get(key) {
    return localStorage.getItem(key) ?? this.defaults[key]
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
