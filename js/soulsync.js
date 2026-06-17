class SoulSyncClient {
  constructor() {
    this.server = localStorage.getItem('soulsync_server') || ''
    this.apiKey = localStorage.getItem('soulsync_apikey') || ''
    this.proxyUrl = localStorage.getItem('soulsync_proxy') || ''
    this.timeout = 6000
  }

  get configured() {
    return !!(this.server && this.apiKey)
  }

  get useProxy() {
    return !!this.proxyUrl
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    }
  }

  _url(path) {
    return `${this.server.replace(/\/+$/, '')}/api/v1${path}`
  }

  async _fetch(url, opts = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)
    opts.signal = controller.signal
    try {
      const res = await fetch(url, opts)
      clearTimeout(timer)
      return res
    } catch (e) {
      clearTimeout(timer)
      if (e.name === 'AbortError') {
        throw new Error('Request timed out')
      }
      throw e
    }
  }

  async _request(method, path, body = null) {
    if (!this.configured) throw new Error('SoulSync not configured')

    if (this.useProxy) {
      return this._proxyRequest(method, path, body)
    }

    const url = this._url(path)
    const opts = { method, headers: this._headers() }
    if (body) opts.body = JSON.stringify(body)

    let res
    try {
      res = await this._fetch(url, opts)
    } catch (e) {
      if (e.name === 'AbortError' || e.message === 'Request timed out') {
        throw new Error('Cannot reach server. If SoulSync is on a different domain, set the CORS Proxy URL in settings, or configure CORS headers on your SoulSync reverse proxy.')
      }
      if (e instanceof TypeError) {
        throw new Error('Cannot reach server. If SoulSync is on a different domain, set the CORS Proxy URL in settings, or configure CORS headers on your SoulSync reverse proxy.')
      }
      throw e
    }

    if (res.status === 0) {
      throw new Error('CORS blocked. Set the CORS Proxy URL in settings.')
    }

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error?.message || `SoulSync error (HTTP ${res.status})`)
    }
    return data
  }

  async _proxyRequest(method, path, body = null) {
    const url = this._url(path)
    let resp
    try {
      resp = await this._fetch(this.proxyUrl.replace(/\/+$/, '') + '/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, body, headers: this._headers() })
      })
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error('SoulSync proxy request timed out')
      }
      throw e
    }
    const data = await resp.json()
    if (!resp.ok || !data.success) {
      throw new Error(data.error?.message || `SoulSync proxy error (HTTP ${resp.status})`)
    }
    return data
  }

  async searchTracks(query, limit = 20) {
    return this._request('POST', '/search/tracks', { query, limit })
  }

  async searchAlbums(query, limit = 20) {
    return this._request('POST', '/search/albums', { query, limit })
  }

  async searchArtists(query, limit = 20) {
    return this._request('POST', '/search/artists', { query, limit })
  }

  async getWishlist(page = 1, limit = 50, category = '') {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (category) params.set('category', category)
    const url = this._url(`/wishlist?${params}`)

    if (this.useProxy) {
      return this._proxyRequest('GET', `/wishlist?${params}`)
    }

    const res = await this._fetch(url, { headers: this._headers() })
    if (res.status === 0) throw new Error('CORS blocked')
    const data = await res.json()
    if (!data.success) throw new Error(data.error?.message || 'Failed to get wishlist')
    return data
  }

  async addToWishlist(trackData, sourceType = 'web_app') {
    return this._request('POST', '/wishlist', {
      track_data: trackData,
      source_type: sourceType
    })
  }

  async removeFromWishlist(trackId) {
    return this._request('DELETE', `/wishlist/${encodeURIComponent(trackId)}`)
  }

  async processWishlist() {
    return this._request('POST', '/wishlist/process')
  }

  async getAlbumTracks(albumId, albumName, artistName, source = '') {
    if (!this.configured) throw new Error('SoulSync not configured')
    const params = new URLSearchParams({ name: albumName, artist: artistName })
    if (source) params.set('source', source)
    const path = `/api/album/${encodeURIComponent(albumId)}/tracks?${params}`
    const url = `${this.server.replace(/\/+$/, '')}${path}`

    if (this.useProxy) {
      const resp = await this._fetch(this.proxyUrl.replace(/\/+$/, '') + '/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method: 'GET', headers: this._headers() })
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error?.message || `SoulSync proxy error (HTTP ${resp.status})`)
      }
      return data
    }

    const res = await this._fetch(url, { headers: this._headers() })
    if (res.status === 0) throw new Error('CORS blocked')
    const data = await res.json()
    if (!data.success) throw new Error(data.error?.message || `SoulSync error (HTTP ${res.status})`)
    return data
  }

  async addAlbumTrackToWishlist(track, artist, album, sourceType = 'album', sourceContext = {}) {
    if (!this.configured) throw new Error('SoulSync not configured')
    const path = '/api/add-album-to-wishlist'
    const url = `${this.server.replace(/\/+$/, '')}${path}`
    const body = { track, artist, album, source_type: sourceType, source_context: sourceContext }

    if (this.useProxy) {
      const resp = await this._fetch(this.proxyUrl.replace(/\/+$/, '') + '/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method: 'POST', body, headers: this._headers() })
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error?.message || `SoulSync proxy error (HTTP ${resp.status})`)
      }
      return data
    }

    const res = await this._fetch(url, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body)
    })
    if (res.status === 0) throw new Error('CORS blocked')
    const data = await res.json()
    if (!data.success) throw new Error(data.error?.message || `SoulSync error (HTTP ${res.status})`)
    return data
  }

  async _legacyFetch(method, path, body = null) {
    const url = `${this.server.replace(/\/+$/, '')}${path}`

    if (this.useProxy) {
      const resp = await this._fetch(this.proxyUrl.replace(/\/+$/, '') + '/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, body, headers: this._headers() })
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error?.message || `SoulSync proxy error (HTTP ${resp.status})`)
      }
      return data
    }

    const opts = { method, headers: this._headers() }
    if (body) opts.body = JSON.stringify(body)
    const res = await this._fetch(url, opts)
    if (res.status === 0) throw new Error('CORS blocked')
    const data = await res.json()
    if (data.success === false || data.error) {
      throw new Error(data.error?.message || data.error || `SoulSync error (HTTP ${res.status})`)
    }
    return data
  }

  async clearWishlist() {
    return this._legacyFetch('POST', '/api/wishlist/clear')
  }

  async downloadWishlist(category = '', forceDownloadAll = false) {
    const body = {}
    if (category) body.category = category
    if (forceDownloadAll) body.force_download_all = true
    return this._legacyFetch('POST', '/api/wishlist/download_missing', body)
  }

  async getWishlistStats() {
    return this._legacyFetch('GET', '/api/wishlist/stats')
  }
}

window.SoulSyncClient = SoulSyncClient
