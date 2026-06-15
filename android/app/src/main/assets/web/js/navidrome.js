class NavidromeClient {
  constructor() {
    this.server = localStorage.getItem('navidrome_server') || ''
    this.username = localStorage.getItem('navidrome_username') || ''
    this.password = localStorage.getItem('navidrome_password') || ''
    this.proxyUrl = localStorage.getItem('navidrome_proxy') || ''
    this.clientName = 'music-web-app'
  }

  get configured() {
    return !!(this.server && this.username && this.password)
  }

  _hexPassword() {
    let h = ''
    for (let i = 0; i < this.password.length; i++) {
      h += this.password.charCodeAt(i).toString(16).padStart(2, '0')
    }
    return h
  }

  _buildQuery(params = {}) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries({ u: this.username, p: `enc:${this._hexPassword()}`, v: '1.12.0', c: this.clientName, f: 'json' })) {
      qs.append(k, v)
    }
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        v.forEach(item => qs.append(k, String(item)))
      } else {
        qs.append(k, String(v))
      }
    }
    return qs
  }

  _baseParams(extra = {}) {
    return this._buildQuery(extra)
  }

  async _request(endpoint, params = {}) {
    if (!this.configured) throw new Error('Navidrome not configured')

    if (this.proxyUrl) {
      const base = this.proxyUrl.replace(/\/+$/, '')
      const res = await fetch(`${base}/api/navidrome-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: this.server,
          username: this.username,
          password: this.password,
          endpoint,
          params
        })
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Navidrome proxy error (HTTP ${res.status})${txt ? ': ' + txt : ''}`)
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return data.result
    }

    const query = this._baseParams(params)
    const url = `${this.server.replace(/\/+$/, '')}/rest/${endpoint}.view?${query}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Navidrome HTTP ${res.status}`)
    const data = await res.json()
    if (data['subsonic-response']?.status === 'failed') {
      throw new Error(data['subsonic-response']?.error?.message || 'Navidrome API error')
    }
    return data['subsonic-response']
  }

  async ping() {
    return this._request('ping')
  }

  async getArtists() {
    return this._request('getArtists')
  }

  async getArtist(id) {
    return this._request('getArtist', { id })
  }

  async getAlbum(id) {
    return this._request('getAlbum', { id })
  }

  async getAlbumList2(type = 'newest', size = 50, offset = 0) {
    return this._request('getAlbumList2', { type, size: String(size), offset: String(offset) })
  }

  async getRandomSongs(size = 50) {
    return this._request('getRandomSongs', { size: String(size) })
  }

  async search3(query, artistCount = 20, albumCount = 20, songCount = 20) {
    return this._request('search3', {
      query,
      artistCount: String(artistCount),
      albumCount: String(albumCount),
      songCount: String(songCount)
    })
  }

  streamUrl(id) {
    if (!this.configured) return ''
    if (this.proxyUrl) {
      const base = this.proxyUrl.replace(/\/+$/, '')
      return `${base}/api/navidrome-stream?id=${encodeURIComponent(id)}&server=${encodeURIComponent(this.server)}&u=${encodeURIComponent(this.username)}&p=enc:${this._hexPassword()}`
    }
    const params = this._baseParams()
    return `${this.server.replace(/\/+$/, '')}/rest/stream.view?id=${encodeURIComponent(id)}&${params}`
  }

  coverUrl(id, size = 300) {
    if (!this.configured) return ''
    if (this.proxyUrl) {
      const base = this.proxyUrl.replace(/\/+$/, '')
      return `${base}/api/navidrome-cover?id=${encodeURIComponent(id)}&size=${size}&server=${encodeURIComponent(this.server)}&u=${encodeURIComponent(this.username)}&p=enc:${this._hexPassword()}`
    }
    const params = this._baseParams({ size: String(size) })
    return `${this.server.replace(/\/+$/, '')}/rest/getCoverArt.view?id=${encodeURIComponent(id)}&${params}`
  }

  async getPlaylists() {
    return this._request('getPlaylists')
  }

  async getPlaylist(id) {
    return this._request('getPlaylist', { id })
  }

  async createPlaylist(name, songIds = []) {
    return this._request('createPlaylist', { name, songId: songIds })
  }

  async deletePlaylist(id) {
    return this._request('deletePlaylist', { id })
  }

  async updatePlaylist(id, { name, songIdsToAdd, songIdsToRemove } = {}) {
    const params = { playlistId: id }
    if (name) params.name = name
    if (songIdsToAdd?.length) params.songIdToAdd = songIdsToAdd
    if (songIdsToRemove?.length) params.songIdToRemove = songIdsToRemove
    return this._request('createPlaylist', params)
  }
}

window.NavidromeClient = NavidromeClient
