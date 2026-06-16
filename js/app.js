(function () {
  const navidrome = new NavidromeClient()
  const soulsync = new SoulSyncClient()
  const settings = new SettingsManager()
  const player = new MusicPlayer()

  let currentView = 'home'
  let previousView = 'home'
  let searchResults = { navidrome: null, soulsync: null }
  let albumHistoryView = 'home'
  let libraryState = { tab: 'albums', search: '', albums: null, artists: null, tracks: null }

  function $(sel, ctx = document) { return ctx.querySelector(sel) }
  function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)] }

  const icons = {
    home: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    library: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
    queue: '<svg viewBox="0 0 24 24"><path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
    delete: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    playlist: '<svg viewBox="0 0 24 24"><path d="M14 10H3v2h11v-2zm0-4H3v2h11V6zM3 16h7v-2H3v2zm11-1v6l5-3-5-3z"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>'
  }

  function init() {
    renderLayout()
    bindNavigation()
    bindSettings()
    bindPlayer()
    bindSearch()
    bindKeyboard()
    applySavedSettings()
    if (!navidrome.configured) {
      navigate('settings')
      hideSplash()
    } else {
      navigate('home')
      setTimeout(() => {
        try { restorePlaybackState() } catch (_) {}
        hideSplash()
      }, 0)
    }
    // Fallback: never let splash stick forever
    setTimeout(hideSplash, 3000)
  }

  function hideSplash() {
    const s = document.getElementById('splash')
    if (s) s.classList.add('hidden')
  }

  function restorePlaybackState() {
    if (!player._restored) return
    if (player.queue.length === 0 || player.currentIndex < 0) return
    const track = player.queue[player.currentIndex]
    if (!track || !track.streamUrl) return
    const savedTime = player._savedCurrentTime || 0
    const wasPlaying = player._restoredPlaying
    const dur = track.duration || 0
    const pct = dur ? (savedTime / dur) * 100 : 0
    const titleText = track.title || track.name || 'Unknown'
    const artistText = [track.artist, track.artist_name, track.albumArtist, track.albumName].filter(Boolean).join(' · ')
    const coverSrc = track.coverUrl || ''
    const byId = id => document.getElementById(id)
    // Bottom bar
    const nt = byId('np-title'); if (nt) nt.textContent = titleText
    const na = byId('np-artist'); if (na) na.textContent = artistText
    const nc = byId('np-cover'); if (nc) nc.src = coverSrc
    // Now playing overlay
    const noc = byId('np-overlay-cover'); if (noc) noc.src = coverSrc
    const not = byId('np-overlay-title'); if (not) not.textContent = titleText
    const noa = byId('np-overlay-artist'); if (noa) noa.textContent = artistText
    const noab = byId('np-overlay-album'); if (noab) noab.textContent = track.albumName || track.album || ''
    // Progress
    const pb = byId('progress-bar'); if (pb) pb.value = pct
    const pf = byId('np-progress-fill'); if (pf) pf.style.width = pct + '%'
    const nc2 = byId('np-current'); if (nc2) nc2.textContent = player.formatTime(savedTime)
    const nd = byId('np-duration'); if (nd) nd.textContent = player.formatTime(dur)
    const op = byId('np-overlay-progress'); if (op) op.value = pct
    const oc = byId('np-overlay-current'); if (oc) oc.textContent = player.formatTime(savedTime)
    const od = byId('np-overlay-duration'); if (od) od.textContent = player.formatTime(dur)
    // Play button
    const cp = byId('ctrl-play'); if (cp) cp.innerHTML = wasPlaying ? icons.pause : icons.play
    const np = byId('np-overlay-play'); if (np) np.innerHTML = wasPlaying ? icons.pause : icons.play
    // Show now-playing bar
    const npb = byId('now-playing-bar')
    if (npb) npb.style.display = ''
    // Start audio if it was playing
    if (wasPlaying) {
      player._loadCurrent()
    }
  }

  function applySavedSettings() {
    const s = settings.load()
    if (s.navidrome_server) {
      Object.assign(navidrome, {
        server: s.navidrome_server,
        username: s.navidrome_username,
        password: s.navidrome_password,
        proxyUrl: s.navidrome_proxy
      })
    }
    if (s.soulsync_server) {
      Object.assign(soulsync, {
        server: s.soulsync_server,
        apiKey: s.soulsync_apikey,
        proxyUrl: s.soulsync_proxy
      })
    }
    updateSidebarStatus()
  }

  function renderLayout() {
    const app = $('#app')
    app.innerHTML = `
      <header class="top-bar" id="top-bar">
        <div class="top-bar-left">
          <button class="icon-btn" id="menu-btn" aria-label="Menu" onclick="document.getElementById('sidebar')?.classList.toggle('open');document.getElementById('sidebar-backdrop')?.classList.toggle('show')">${icons.menu}</button>
          <div class="top-bar-brand">
            <img src="assets/logo.png" class="top-bar-logo" alt="Fynix">
            <span class="top-bar-title">Fynix</span>
          </div>
        </div>
        <span class="top-bar-center" id="top-bar-title">Home</span>
        <div class="top-bar-right">
          <button class="icon-btn" onclick="navigate('settings')" aria-label="Settings">${icons.settings}</button>
        </div>
      </header>

      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>

      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <img src="assets/logo.png" class="sidebar-logo" alt="Fynix">
          <span class="sidebar-brand">Fynix</span>
        </div>
        <nav class="sidebar-nav">
          <a href="#" data-view="home" class="nav-item active">${icons.home} Home</a>
          <a href="#" data-view="search" class="nav-item">${icons.search} Search</a>
          <a href="#" data-view="albums" class="nav-item">${icons.library} Library</a>
          <hr class="nav-divider">
          <a href="#" data-view="queue" class="nav-item">${icons.queue} Queue</a>
          <a href="#" data-view="playlists" class="nav-item">${icons.playlist} Playlists</a>
          <a href="#" data-view="settings" class="nav-item">${icons.settings} Settings</a>
        </nav>
        <div class="sidebar-status" id="sidebar-status"></div>
      </aside>

      <main class="main-content" id="main-content">
        <div class="view" id="view-home"></div>
        <div class="view hidden" id="view-albums"></div>
        <div class="view hidden" id="view-artists"></div>
        <div class="view hidden" id="view-search"></div>
        <div class="view hidden" id="view-settings"></div>
        <div class="view hidden" id="view-queue"></div>
        <div class="view hidden" id="view-playlists"></div>
      </main>

      <footer class="now-playing-bar" id="now-playing-bar">
        <div class="np-progress-line"><div class="np-progress-line-fill" id="np-progress-fill"></div></div>
        <div class="np-left">
          <img class="np-cover" id="np-cover" src="" alt="" onerror="this.style.display='none'" onload="this.style.display=''">
          <div class="np-info">
            <div class="np-title" id="np-title">No track</div>
            <div class="np-artist" id="np-artist"></div>
          </div>
        </div>
        <div class="np-center">
          <div class="np-controls">
            <button class="ctrl-btn" id="ctrl-shuffle" title="Shuffle">${icons.shuffle}</button>
            <button class="ctrl-btn" id="ctrl-prev" title="Previous">${icons.prev}</button>
            <button class="ctrl-btn ctrl-play" id="ctrl-play" title="Play/Pause">${icons.play}</button>
            <button class="ctrl-btn" id="ctrl-next" title="Next">${icons.next}</button>
            <button class="ctrl-btn" id="ctrl-repeat" title="Repeat">${icons.repeat}</button>
          </div>
        </div>
        <div class="np-right">
          <div class="np-progress" id="np-progress-desktop">
            <span class="np-time" id="np-current">0:00</span>
            <input type="range" class="progress-bar" id="progress-bar" min="0" max="100" value="0">
            <span class="np-time" id="np-duration">0:00</span>
          </div>
          <input type="range" class="volume-bar" id="volume-bar" min="0" max="1" step="0.05" value="0.8">
        </div>
      </footer>

      <nav class="bottom-nav" id="bottom-nav">
        <a href="#" data-view="home" class="bottom-nav-item active">${icons.home}<span>Home</span></a>
        <a href="#" data-view="search" class="bottom-nav-item">${icons.search}<span>Search</span></a>
        <a href="#" data-view="albums" class="bottom-nav-item">${icons.library}<span>Library</span></a>
        <a href="#" data-view="playlists" class="bottom-nav-item">${icons.playlist}<span>Playlists</span></a>
      </nav>

      <div class="now-playing-screen" id="now-playing-screen">
        <div class="np-overlay-header">
          <button class="icon-btn" id="np-back-btn" aria-label="Close">${icons.back}</button>
          <span class="np-overlay-title-text">Now Playing</span>
          <button class="icon-btn" id="np-queue-btn" onclick="navigate('queue');hideNowPlaying()" aria-label="Queue">${icons.queue}</button>
        </div>
        <div class="np-overlay-body">
          <div class="np-overlay-artwork">
            <img id="np-overlay-cover" src="" alt="">
          </div>
          <div class="np-overlay-info">
            <div class="np-overlay-track" id="np-overlay-title">No track</div>
            <div class="np-overlay-artist" id="np-overlay-artist"></div>
            <div class="np-overlay-album" id="np-overlay-album"></div>
          </div>
          <div class="np-overlay-progress">
            <input type="range" class="progress-bar" id="np-overlay-progress" min="0" max="100" value="0">
            <div class="np-overlay-time-row">
              <span class="np-time" id="np-overlay-current">0:00</span>
              <span class="np-time" id="np-overlay-duration">0:00</span>
            </div>
          </div>
          <div class="np-overlay-controls">
            <button class="ctrl-btn" id="np-ctrl-shuffle" title="Shuffle">${icons.shuffle}</button>
            <button class="ctrl-btn" id="np-ctrl-prev" title="Previous">${icons.prev}</button>
            <button class="ctrl-btn ctrl-play" id="np-overlay-play" title="Play/Pause">${icons.play}</button>
            <button class="ctrl-btn" id="np-ctrl-next" title="Next">${icons.next}</button>
            <button class="ctrl-btn" id="np-ctrl-repeat" title="Repeat">${icons.repeat}</button>
          </div>
          <div class="np-overlay-volume">
            <svg class="volume-icon" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.49 4.49 0 0 0 2.5-3.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            <input type="range" class="volume-bar" id="np-overlay-volume" min="0" max="1" step="0.05" value="0.8">
          </div>
        </div>
      </div>
    `
    updateSidebarStatus()
  }

  function updateSidebarStatus() {
    const el = $('#sidebar-status')
    if (!el) return
    const parts = []
    parts.push(navidrome.configured ? '\u2705 Navidrome' : '\u274C Navidrome')
    parts.push(soulsync.configured ? '\u2705 SoulSync' : '\u274C SoulSync')
    el.textContent = parts.join(' | ')
  }

  function bindNavigation() {
    $$('.nav-item, .bottom-nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault()
        navigate(item.dataset.view)
      })
    })

    const backdrop = $('#sidebar-backdrop')
    $('#menu-btn')?.addEventListener('click', () => {
      $('#sidebar').classList.toggle('open')
      backdrop?.classList.toggle('show')
    })
    backdrop?.addEventListener('click', () => {
      $('#sidebar').classList.remove('open')
      backdrop.classList.remove('show')
    })
  }

  function navigate(view) {
    previousView = currentView
    currentView = view
    $$('.nav-item, .bottom-nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view))
    $$('.view').forEach(v => v.classList.add('hidden'))
    const target = $(`#view-${view}`)
    if (target) target.classList.remove('hidden')
    $('#sidebar').classList.remove('open')
    $('#sidebar-backdrop')?.classList.remove('show')

    const titles = { home: 'Home', search: 'Search', albums: 'Library', artists: 'Artists', queue: 'Queue', playlists: 'Playlists', settings: 'Settings' }
    const titleEl = $('#top-bar-title')
    if (titleEl && titles[view]) titleEl.textContent = titles[view]

    switch (view) {
      case 'home': renderHome(); break
      case 'albums': renderAlbums(); break
      case 'artists': renderArtists(); break
      case 'search': renderSearch(); break
      case 'settings': renderSettings(); break
      case 'queue': renderQueue(); break
      case 'playlists': renderPlaylists(); break
    }
  }

  function showNowPlaying() {
    const el = $('#now-playing-screen')
    el.classList.remove('hidden')
    el.offsetHeight
    el.classList.add('open')
    updateNowPlaying()
  }

  function hideNowPlaying() {
    const el = $('#now-playing-screen')
    el.classList.remove('open')
    setTimeout(() => el.classList.add('hidden'), 300)
  }

  function updateNowPlaying() {
    const state = player.getState()
    const t = state.currentTrack
    const el = $('#now-playing-screen')
    if (!t) return
    $('#np-overlay-cover').src = t.coverUrl || ''
    $('#np-overlay-title').textContent = t.title || t.name || 'Unknown'
    $('#np-overlay-artist').textContent = [t.artist, t.artist_name, t.albumArtist].filter(Boolean).join(' · ')
    $('#np-overlay-album').textContent = t.albumName || t.album || ''
    $('#np-overlay-play').innerHTML = state.playing ? icons.pause : icons.play
    $('#np-overlay-progress').value = state.duration ? (state.currentTime / state.duration) * 100 : 0
    $('#np-overlay-current').textContent = player.formatTime(state.currentTime)
    $('#np-overlay-duration').textContent = player.formatTime(state.duration)
    $('#np-overlay-volume').value = state.volume
    $('#np-ctrl-shuffle').style.opacity = state.shuffle ? '1' : '0.4'
    $('#np-ctrl-repeat').style.opacity = state.repeat ? '1' : '0.4'
  }

  function showSnackbar(msg, type = 'success') {
    let el = $('#snackbar')
    if (!el) {
      el = document.createElement('div')
      el.id = 'snackbar'
      el.className = 'snackbar'
      document.body.appendChild(el)
    }
    el.className = `snackbar ${type}`
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(el._timer)
    el._timer = setTimeout(() => el.classList.remove('show'), 3000)
  }

  function showError(msg) { showSnackbar(msg, 'error') }
  function showSuccess(msg) { showSnackbar(msg, 'success') }

  async function renderHome() {
    const el = $('#view-home')
    if (!navidrome.configured) {
      el.innerHTML = `
        <div class="welcome">
          <h2>Welcome to Fynix</h2>
          <p>Configure your music servers in Settings to get started.</p>
          <button class="btn btn-primary" onclick="navigate('settings')">Open Settings</button>
        </div>
      `
      return
    }
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'
    try {
      const [newestRes, recentRes, artistsRes] = await Promise.all([
        navidrome.getAlbumList2('newest', 24).catch(() => null),
        navidrome.getAlbumList2('recent', 12).catch(() => null),
        navidrome.getArtists().catch(() => null)
      ])
      const newest = newestRes?.albumList2?.album || []
      const recent = recentRes?.albumList2?.album || []
      const artistIndex = artistsRes?.artists?.index || []
      const artistCount = artistIndex.reduce((sum, i) => sum + (i.artist?.length || 0), 0)
      const albumCount = artistIndex.reduce((sum, i) => sum + (i.artist || []).reduce((s, a) => s + (a.albumCount || 0), 0), 0)

      let html = ''

      if (albumCount > 0 || artistCount > 0) {
        html += `
          <div class="stats-row">
            <div class="stat-card"><div class="stat-card-value">${albumCount}</div><div class="stat-card-label">Albums</div></div>
            <div class="stat-card"><div class="stat-card-value">${artistCount}</div><div class="stat-card-label">Artists</div></div>
          </div>
        `
      }

      if (newest.length) {
        html += `<h3 class="section-title">New Releases</h3><div class="album-grid">${newest.map(a => albumCard(a)).join('')}</div>`
      }

      if (recent.length) {
        html += `<h3 class="section-title">Recently Played</h3><div class="album-grid">${recent.map(a => albumCard(a)).join('')}</div>`
      }

      if (!newest.length && !recent.length) {
        html = '<div class="empty-state">No albums found in your library.</div>'
      }

      el.innerHTML = html
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  async function renderAlbums() {
    const el = $('#view-albums')
    if (!navidrome.configured) { el.innerHTML = '<div class="error-msg">Navidrome not configured</div>'; return }
    libraryState.search = ''

    el.innerHTML = `
      <div class="library-header">
        <div class="library-tabs">
          <button class="library-tab ${libraryState.tab === 'albums' ? 'active' : ''}" data-libtab="albums">Albums</button>
          <button class="library-tab ${libraryState.tab === 'artists' ? 'active' : ''}" data-libtab="artists">Artists</button>
          <button class="library-tab ${libraryState.tab === 'tracks' ? 'active' : ''}" data-libtab="tracks">Tracks</button>
        </div>
        <input type="text" class="input library-search" id="library-search" placeholder="Filter library..." autocomplete="off">
      </div>
      <div class="library-content" id="library-content">
        <div class="loading"><div class="loading-spinner"></div> Loading...</div>
      </div>
    `

    bindLibraryTabs()
    bindLibrarySearch()
    loadLibraryTab()
  }

  function bindLibraryTabs() {
    $$('.library-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        libraryState.tab = tab.dataset.libtab
        $$('.library-tab').forEach(t => t.classList.toggle('active', t.dataset.libtab === libraryState.tab))
        loadLibraryTab()
      })
    })
  }

  function bindLibrarySearch() {
    const input = $('#library-search')
    if (!input) return
    let timer
    input.addEventListener('input', () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        libraryState.search = input.value
        renderLibraryContent()
      }, 200)
    })
  }

  async function loadLibraryTab() {
    const content = $('#library-content')
    content.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'

    try {
      switch (libraryState.tab) {
        case 'albums':
          if (!libraryState.albums) {
            const resp = await navidrome.getAlbumList2('newest', 500)
            libraryState.albums = resp?.albumList2?.album || []
          }
          break
        case 'artists':
          if (!libraryState.artists) {
            const resp = await navidrome.getArtists()
            libraryState.artists = resp?.artists?.index?.flatMap(i => i.artist) || []
          }
          break
        case 'tracks':
          if (!libraryState.tracks) {
            const resp = await navidrome.getRandomSongs(500)
            libraryState.tracks = resp?.randomSongs?.song || []
          }
          break
      }
      renderLibraryContent()
    } catch (e) {
      content.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  window.filterArtist = function (name) {
    libraryState.tab = 'albums'
    libraryState.search = name
    $$('.library-tab').forEach(t => t.classList.toggle('active', t.dataset.libtab === 'albums'))
    const input = $('#library-search')
    if (input) input.value = name
    loadLibraryTab()
  }

  function renderLibraryContent() {
    const content = $('#library-content')
    if (!content) return
    const q = libraryState.search.toLowerCase()

    switch (libraryState.tab) {
      case 'albums': {
        let albums = libraryState.albums || []
        if (q) {
          albums = albums.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.artist || '').toLowerCase().includes(q)
          )
        }
        if (!albums.length) {
          content.innerHTML = `<div class="empty-state">${q ? 'No matching albums' : 'No albums found'}</div>`
          return
        }
        content.innerHTML = `<div class="album-grid">${albums.map(a => albumCard(a)).join('')}</div>`
        break
      }
      case 'artists': {
        let artists = libraryState.artists || []
        if (q) {
          artists = artists.filter(a => (a.name || '').toLowerCase().includes(q))
        }
        if (!artists.length) {
          content.innerHTML = `<div class="empty-state">${q ? 'No matching artists' : 'No artists found'}</div>`
          return
        }
        content.innerHTML = `<div class="artist-grid">${artists.map(a => {
          const cover = navidrome.coverUrl(a.id, 160)
          return `
          <div class="artist-card" onclick="filterArtist('${escHtml(a.name)}')">
            <img class="artist-cover-img" src="${cover}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="artist-cover" style="display:none">${escHtml(a.name.charAt(0).toUpperCase())}</div>
            <div class="artist-name">${escHtml(a.name)}</div>
            <div class="artist-count">${a.albumCount} albums</div>
          </div>`
        }).join('')}</div>`
        break
      }
      case 'tracks': {
        let tracks = libraryState.tracks || []
        if (q) {
          tracks = tracks.filter(t =>
            (t.title || '').toLowerCase().includes(q) ||
            (t.artist || '').toLowerCase().includes(q) ||
            (t.album || '').toLowerCase().includes(q)
          )
        }
        if (!tracks.length) {
          content.innerHTML = `<div class="empty-state">${q ? 'No matching tracks' : 'No tracks found'}</div>`
          return
        }
        const songsWithStream = tracks.map(s => ({
          ...s,
          streamUrl: navidrome.streamUrl(s.id),
          coverUrl: navidrome.coverUrl(s.id, 100),
          albumName: s.album || '',
          albumArtist: s.artist || ''
        }))
        window._libraryTracks = songsWithStream
        content.innerHTML = `
          <div class="track-list">${tracks.map((t, i) => `
            <div class="track-row" onclick="playLibraryTrack(${i})">
              <span class="track-num">${i + 1}</span>
              <div class="track-info">
                <div class="track-name">${escHtml(t.title)}</div>
                <div class="track-artist">${escHtml(t.artist || '')} · ${escHtml(t.album || '')}</div>
              </div>
              <span class="track-duration">${player.formatTime(t.duration)}</span>
            </div>
          `).join('')}</div>`
        break
      }
    }
  }

  window.playLibraryTrack = function (index) {
    const songs = window._libraryTracks || []
    if (songs[index]) player.playQueue(songs, index)
  }

  function fallbackSvg(label, size = 120) {
    const c = label.charCodeAt(0) % 360
    return `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 ${size} ${size}%22><rect fill=%22hsl(${c},40%25,25%25)%22 width=%22${size}%22 height=%22${size}%22/><text fill=%22%23fff%22 font-size=%22${size*0.45}%22 x=%22${size/2}%22 y=%22${size*0.62}%22 text-anchor=%22middle%22 font-weight=%22600%22>${encodeURIComponent(label)}</text></svg>`
  }

  async function renderArtists() {
    const el = $('#view-artists')
    if (!navidrome.configured) { el.innerHTML = '<div class="error-msg">Navidrome not configured</div>'; return }
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'
    try {
      const resp = await navidrome.getArtists()
      const artists = resp?.artists?.index?.flatMap(i => i.artist) || []
      el.innerHTML = `
        <h2 class="view-title">Artists</h2>
        <div class="artist-grid">${artists.map(a => {
          const cover = navidrome.coverUrl(a.id, 160)
          return `
          <div class="artist-card" onclick="showArtist('${a.id}')">
            <img class="artist-cover-img" src="${cover}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="artist-cover" style="display:none">${escHtml(a.name.charAt(0).toUpperCase())}</div>
            <div class="artist-name">${escHtml(a.name)}</div>
            <div class="artist-count">${a.albumCount} albums</div>
          </div>`
        }).join('')}</div>
      `
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  async function showArtist(id) {
    const el = $('#view-artists')
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'
    try {
      const resp = await navidrome.getArtist(id)
      const artist = resp?.artist
      const albums = artist?.album || []
      const cover = albums[0] ? navidrome.coverUrl(albums[0].id, 300) : ''
      el.innerHTML = `
        <button class="btn-back" onclick="renderArtists()">${icons.back} Back</button>
        <div class="artist-detail">
          <div class="artist-detail-header">
            <img class="artist-detail-img" src="${cover}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="artist-cover artist-cover-lg" style="display:${cover ? 'none' : 'flex'}">${escHtml(artist.name.charAt(0).toUpperCase())}</div>
            <div class="artist-detail-info">
              <h2>${escHtml(artist.name)}</h2>
              <p>${artist.albumCount} albums</p>
            </div>
          </div>
          <h3 class="section-title">Albums</h3>
          <div class="album-grid">${albums.map(a => albumCard(a)).join('')}</div>
        </div>
      `
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  function albumCard(album) {
    const cover = navidrome.coverUrl(album.id, 300)
    const year = album.year ? ` ${album.year}` : ''
    return `
      <div class="album-card" onclick="showAlbum('${album.id}')">
        <div class="album-art">
          <img src="${cover}" alt="${escHtml(album.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23333%22 width=%22300%22 height=%22300%22/><text fill=%22%23999%22 font-size=%2280%22 x=%22150%22 y=%22170%22 text-anchor=%22middle%22 font-family=%22monospace%22>&#x266C;</text></svg>'">
          <div class="album-play-overlay">${icons.play}</div>
        </div>
        <div class="album-name">${escHtml(album.name)}</div>
        <div class="album-artist">${escHtml(album.artist || '')}</div>
        ${year ? `<div class="album-year">${year}</div>` : ''}
      </div>
    `
  }

  function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return ''
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m} min`
  }

  function totalDuration(songs) {
    return songs.reduce((sum, s) => sum + (s.duration || 0), 0)
  }

  async function showAlbum(id) {
    albumHistoryView = currentView
    const el = $('#view-albums')
    el.classList.remove('hidden')
    $('#view-home')?.classList.add('hidden')
    $('#view-artists')?.classList.add('hidden')
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'
    try {
      const resp = await navidrome.getAlbum(id)
      const album = resp?.album
      const songs = album?.song || []
      const cover = navidrome.coverUrl(album.id, 400)

      const backTarget = albumHistoryView === 'home' ? 'home' : albumHistoryView === 'artists' ? 'artists' : 'albums'

      const tracksHtml = songs.map((s, i) => `
        <div class="track-row" onclick="playTrackFromAlbum(${i})" data-index="${i}">
          <span class="track-num">${s.track || i + 1}</span>
          <div class="track-info">
            <div class="track-name">${escHtml(s.title)}</div>
            <div class="track-artist">${escHtml(s.artist || album.artist || '')}</div>
          </div>
          <span class="track-duration">${player.formatTime(s.duration)}</span>
        </div>
      `).join('')

      window._currentAlbumSongs = songs.map(s => ({
        ...s,
        streamUrl: navidrome.streamUrl(s.id),
        coverUrl: navidrome.coverUrl(s.id, 300),
        albumName: album.name,
        albumArtist: album.artist
      }))

      const totalDur = formatDuration(totalDuration(songs))
      const metaParts = []
      if (album.year) metaParts.push(album.year)
      metaParts.push(`${songs.length} tracks`)
      if (totalDur) metaParts.push(totalDur)
      if (album.genre) metaParts.push(album.genre)

      el.innerHTML = `
        <button class="btn-back" onclick="albumBack()">${icons.back} Back</button>
        <div class="album-detail">
          <div class="album-detail-header">
            <img class="album-detail-cover" src="${cover}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23333%22 width=%22300%22 height=%22300%22/><text fill=%22%23999%22 font-size=%2280%22 x=%22150%22 y=%22170%22 text-anchor=%22middle%22 font-family=%22monospace%22>&#x266C;</text></svg>'">
            <div class="album-detail-info">
              <h1>${escHtml(album.name)}</h1>
              <p class="album-detail-artist">${escHtml(album.artist || '')}</p>
              <p class="album-detail-meta">${metaParts.join(' · ')}</p>
              <div class="album-detail-actions">
                <button class="btn btn-primary" onclick="playAll()">${icons.play} Play All</button>
              </div>
            </div>
          </div>
          <div class="track-list">${tracksHtml}</div>
        </div>
      `
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  function albumBack() {
    if (albumHistoryView === 'albums') {
      const savedSearch = libraryState.search
      renderAlbums()
      if (savedSearch) {
        libraryState.search = savedSearch
        const input = $('#library-search')
        if (input) input.value = savedSearch
        renderLibraryContent()
      }
      return
    }
    navigate(albumHistoryView)
  }

  window.playTrackFromAlbum = function (index) {
    const songs = window._currentAlbumSongs || []
    if (!songs[index]) return
    player.playQueue(songs, index)
  }

  window.playAll = function () {
    const songs = window._currentAlbumSongs || []
    if (songs.length) player.playQueue(songs, 0)
  }

  window.renderArtists = renderArtists
  window.renderAlbums = renderAlbums
  window.renderHome = renderHome
  window.showArtist = showArtist
  window.showAlbum = showAlbum
  window.navigate = navigate
  window.showNowPlaying = showNowPlaying
  window.hideNowPlaying = hideNowPlaying
  window.albumBack = albumBack
  window.playTrackFromAlbum = playTrackFromAlbum
  window.playAll = playAll

  function escHtml(s) {
    if (!s) return ''
    const d = document.createElement('div')
    d.textContent = String(s)
    return d.innerHTML
  }

  function bindSettings() {
    document.addEventListener('click', e => {
      if (e.target.closest('#settings-save')) saveSettings()
      if (e.target.closest('#settings-test-navidrome')) testNavidrome()
      if (e.target.closest('#settings-test-soulsync')) testSoulSync()
    })
  }

  function renderSettings() {
    const s = settings.load()
    $('#view-settings').innerHTML = `
      <h2 class="view-title">Settings</h2>
      <form id="settings-form" class="settings-form" onsubmit="return false">
        <section class="settings-section">
          <h3>Navidrome</h3>
          <p class="settings-desc">Your music library server (Subsonic API)</p>
          <label>Server URL <input type="url" class="input" id="s-nav-server" value="${escHtml(s.navidrome_server)}" placeholder="https://music.example.com"></label>
          <label>Username <input type="text" class="input" id="s-nav-user" value="${escHtml(s.navidrome_username)}"></label>
          <label>Password <input type="password" class="input" id="s-nav-pass" value="${escHtml(s.navidrome_password)}"></label>
          <label>CORS Proxy URL <input type="url" class="input" id="s-nav-proxy" value="${escHtml(s.navidrome_proxy)}" placeholder="http://localhost:8080"></label>
          <p class="settings-desc">If Navidrome is on a different domain, set proxy URL (e.g., <code>http://localhost:8080</code>)</p>
          <button type="button" class="btn btn-secondary" id="settings-test-navidrome" style="margin-top:8px">Test Connection</button>
        </section>
        <section class="settings-section">
          <h3>SoulSync</h3>
          <p class="settings-desc">Music discovery and download server</p>
          <label>Server URL <input type="url" class="input" id="s-ss-server" value="${escHtml(s.soulsync_server)}" placeholder="https://soulsync.example.com"></label>
          <label>API Key <input type="password" class="input" id="s-ss-key" value="${escHtml(s.soulsync_apikey)}" placeholder="sk_..."></label>
          <label>CORS Proxy URL <input type="url" class="input" id="s-ss-proxy" value="${escHtml(s.soulsync_proxy)}" placeholder="http://localhost:8080"></label>
          <p class="settings-desc">If SoulSync is on a different domain, run <code>python3 server.py</code> and enter <code>http://localhost:8080</code> here.</p>
          <button type="button" class="btn btn-secondary" id="settings-test-soulsync" style="margin-top:8px">Test Connection</button>
        </section>
        <button type="button" class="btn btn-primary" id="settings-save">Save Settings</button>
      </form>
      <div class="settings-section" id="settings-wishlist-section">
        <h3>Wishlist <span class="wishlist-count" id="sw-count"></span></h3>
        <div id="settings-wishlist-content"></div>
      </div>
    `
    loadWishlistInSettings()
  }

  function saveSettings() {
    const s = {
      navidrome_server: $('#s-nav-server')?.value || '',
      navidrome_username: $('#s-nav-user')?.value || '',
      navidrome_password: $('#s-nav-pass')?.value || '',
      navidrome_proxy: $('#s-nav-proxy')?.value || '',
      soulsync_server: $('#s-ss-server')?.value || '',
      soulsync_apikey: $('#s-ss-key')?.value || '',
      soulsync_proxy: $('#s-ss-proxy')?.value || ''
    }
    settings.save(s)
    Object.assign(navidrome, {
      server: s.navidrome_server,
      username: s.navidrome_username,
      password: s.navidrome_password,
      proxyUrl: s.navidrome_proxy
    })
    Object.assign(soulsync, {
      server: s.soulsync_server,
      apiKey: s.soulsync_apikey,
      proxyUrl: s.soulsync_proxy
    })
    updateSidebarStatus()
    showSuccess('Settings saved')
  }

  async function testNavidrome() {
    const btn = $('#settings-test-navidrome')
    btn.disabled = true
    btn.textContent = 'Testing...'
    try {
      const testNav = new NavidromeClient()
      testNav.server = $('#s-nav-server')?.value || ''
      testNav.username = $('#s-nav-user')?.value || ''
      testNav.password = $('#s-nav-pass')?.value || ''
      const resp = await testNav.ping()
      showSuccess(`Navidrome connected! v${resp.serverVersion}`)
    } catch (e) {
      showError(`Navidrome: ${e.message}`)
    } finally {
      btn.disabled = false
      btn.textContent = 'Test Connection'
    }
  }

  async function testSoulSync() {
    const btn = $('#settings-test-soulsync')
    btn.disabled = true
    btn.textContent = 'Testing...'
    try {
      const testSs = new SoulSyncClient()
      testSs.server = $('#s-ss-server')?.value || ''
      testSs.apiKey = $('#s-ss-key')?.value || ''
      testSs.proxyUrl = $('#s-ss-proxy')?.value || ''
      await testSs.searchTracks('test', 1)
      showSuccess('SoulSync connected!')
    } catch (e) {
      showError(`SoulSync: ${e.message}`)
    } finally {
      btn.disabled = false
      btn.textContent = 'Test Connection'
    }
  }

  function renderSearch() {
    $('#view-search').innerHTML = `
      <div class="search-container">
        <div class="search-bar">
          <input type="text" class="input search-input" id="search-input" placeholder="Search music, artists, albums..." autofocus>
          <button class="btn btn-primary" id="search-btn">${icons.search} Search</button>
        </div>
        <div class="search-filters">
          <label class="filter-chip active"><input type="checkbox" id="filter-nav" checked> Library</label>
          <label class="filter-chip active"><input type="checkbox" id="filter-ss" checked> SoulSync</label>
        </div>
        <div class="search-results" id="search-results"></div>
      </div>
    `
    $$('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cb = chip.querySelector('input[type=checkbox]')
        if (cb) { cb.checked = !cb.checked; chip.classList.toggle('active', cb.checked) }
      })
    })
    $('#search-btn').addEventListener('click', doSearch)
    $('#search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch()
    })
    $('#search-input').focus()
    document.addEventListener('click', e => {
      const btn = e.target.closest('.ss-wishlist-btn')
      if (btn) {
        const idx = parseInt(btn.dataset.idx)
        const data = window._ssData?.[idx]
        if (data) addToWishlist(data)
      }
    })
  }

  async function doSearch() {
    const query = $('#search-input')?.value.trim()
    if (!query) return
    const resultsEl = $('#search-results')
    resultsEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Searching...</div>'
    window._ssData = []
    searchResults = { navidrome: null, soulsync: null }

    const searchNav = $('#filter-nav')?.checked
    const searchSs = $('#filter-ss')?.checked

    try {
      if (searchNav && navidrome.configured) {
        const resp = await navidrome.search3(query, 10, 10, 20)
        searchResults.navidrome = resp?.searchResult3 || {}
      }
    } catch (e) {
      console.error('Navidrome search error:', e)
    }

    try {
      if (searchSs && soulsync.configured) {
        const [tracksRes, albumsRes, artistsRes] = await Promise.all([
          soulsync.searchTracks(query, 15).catch(() => null),
          soulsync.searchAlbums(query, 10).catch(() => null),
          soulsync.searchArtists(query, 10).catch(() => null)
        ])
        searchResults.soulsync = {
          tracks: tracksRes?.data?.tracks || [],
          albums: albumsRes?.data?.albums || [],
          artists: artistsRes?.data?.artists || []
        }
      }
    } catch (e) {
      console.error('SoulSync search error:', e)
    }

    window._lastSearchQuery = query
    renderSearchResults(query)
  }

  function renderSearchResults(query) {
    window._ssData = []
    const el = $('#search-results')
    const n = searchResults.navidrome
    const s = searchResults.soulsync

    const navSongs = n?.song || []
    const navAlbums = n?.album || []
    const navArtists = n?.artist || []

    const ssTracks = s?.tracks || []
    const ssAlbums = s?.albums || []
    const ssArtists = s?.artists || []

    const navCount = navSongs.length + navAlbums.length + navArtists.length
    const ssCount = ssTracks.length + ssAlbums.length + ssArtists.length

    if (navCount === 0 && ssCount === 0) {
      el.innerHTML = `<div class="search-none">No results found for "${escHtml(query)}"</div>`
      return
    }

    let html = ''

    if (navCount > 0) {
      html += `<h3 class="search-section-title">${icons.library} Library Results</h3>`

      if (navArtists.length) {
        html += `<h4 class="search-subtitle">Artists</h4><div class="search-compact">`
        navArtists.forEach(a => {
          const cover = navidrome.coverUrl(a.id, 64)
          const initial = escHtml(a.name.charAt(0).toUpperCase())
          html += `<div class="search-item search-item-clickable" onclick="showArtist('${a.id}')">
            <div class="search-thumb-wrap"><img class="search-thumb search-thumb-round" src="${cover}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.search-thumb-fallback').style.display='flex'"><div class="search-thumb-round search-thumb-fallback" style="display:none">${initial}</div></div>
            <div><strong>${escHtml(a.name)}</strong> <span class="search-item-meta">· ${a.albumCount || 0} albums</span></div>
          </div>`
        })
        html += `</div>`
      }

      if (navAlbums.length) {
        html += `<h4 class="search-subtitle">Albums</h4><div class="search-compact">`
        navAlbums.forEach(a => {
          const cover = navidrome.coverUrl(a.id, 64)
          const year = a.year ? ` · ${a.year}` : ''
          const initial = escHtml(a.name.charAt(0).toUpperCase())
          html += `
            <div class="search-item search-item-clickable" onclick="showAlbum('${a.id}')">
              <div class="search-thumb-wrap"><img class="search-thumb" src="${cover}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.search-thumb-fallback').style.display='flex'"><div class="search-thumb-fallback search-thumb-fallback-sq" style="display:none">${initial}</div></div>
              <div><strong>${escHtml(a.name)}</strong><span class="search-item-meta"> · ${escHtml(a.artist || '')}${year}</span></div>
            </div>`
        })
        html += `</div>`
      }

      if (navSongs.length) {
        html += `<h4 class="search-subtitle">Songs</h4><div class="track-list">`
        const songsWithStream = navSongs.map(s => ({
          ...s,
          streamUrl: navidrome.streamUrl(s.id),
          coverUrl: navidrome.coverUrl(s.id, 100),
          albumName: s.album || '',
          albumArtist: s.artist || ''
        }))
        window._searchSongs = songsWithStream
        navSongs.forEach((s, i) => {
          html += `
            <div class="track-row" onclick="playSearchSong(${i})">
              <span class="track-num">${s.track || i + 1}</span>
              <div class="track-info">
                <div class="track-name">${escHtml(s.title)}</div>
                <div class="track-artist">${escHtml(s.artist || '')} · ${escHtml(s.album || '')}</div>
              </div>
              <span class="track-duration">${player.formatTime(s.duration)}</span>
            </div>`
        })
        html += `</div>`
      }
    }

    if (ssCount > 0) {
      html += `<h3 class="search-section-title ss-section">${icons.star} SoulSync Results</h3>`

      if (ssArtists.length) {
        html += `<h4 class="search-subtitle">Artists</h4><div class="search-compact">`
        ssArtists.forEach(a => {
          const img = a.image_url || a.images?.[0]?.url || ''
          const initial = escHtml(a.name.charAt(0).toUpperCase())
          html += `<div class="search-item">
            <div class="search-thumb-wrap">${
              img
                ? `<img class="search-thumb search-thumb-round" src="${img}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.search-thumb-fallback').style.display='flex'"><div class="search-thumb-round search-thumb-fallback" style="display:none">${initial}</div>`
                : `<div class="search-thumb-round search-thumb-fallback">${initial}</div>`
            }</div>
            <div><strong>${escHtml(a.name)}</strong> <span class="search-item-meta">· ${a.genres?.slice(0, 2).join(', ') || ''}</span></div>
          </div>`
        })
        html += `</div>`
      }

      if (ssAlbums.length) {
        html += `<h4 class="search-subtitle">Albums</h4><div class="search-compact">`
        ssAlbums.forEach((a, idx) => {
          const data = { type: 'album', raw: a }
          window._ssData = window._ssData || []
          const dataIdx = window._ssData.length
          window._ssData.push(data)
          const year = a.release_date?.substring(0, 4) || ''
          const img = a.image_url || a.images?.[0]?.url || ''
          const initial = escHtml(a.name.charAt(0).toUpperCase())
          html += `<div class="search-item search-item-clickable" onclick="showSsAlbum(${dataIdx})">
            <div class="search-thumb-wrap">${
              img
                ? `<img class="search-thumb" src="${img}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.search-thumb-fallback').style.display='flex'"><div class="search-thumb-fallback search-thumb-fallback-sq" style="display:none">${initial}</div>`
                : `<div class="search-thumb-fallback search-thumb-fallback-sq">${initial}</div>`
            }</div>
            <div>
              <strong>${escHtml(a.name)}</strong>
              <span class="search-item-meta">· ${escHtml(a.artists?.join(', ') || '')}${year ? ` · ${year}` : ''}</span>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();addSsAlbumToWishlist(${dataIdx}, this)" style="margin-left:auto">+ Wishlist</button>
          </div>`
        })
        html += `</div>`
      }

      if (ssTracks.length) {
        html += `<h4 class="search-subtitle">Tracks</h4><div class="search-compact">`
        ssTracks.forEach(t => {
          const data = { type: 'track', raw: t }
          window._ssData = window._ssData || []
          const dataIdx = window._ssData.length
          window._ssData.push(data)
          const img = t.image_url || t.images?.[0]?.url || ''
          const initial = escHtml(t.name.charAt(0).toUpperCase())
          html += `<div class="search-item">
            <div class="search-thumb-wrap">${
              img
                ? `<img class="search-thumb" src="${img}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.search-thumb-fallback').style.display='flex'"><div class="search-thumb-fallback search-thumb-fallback-sq" style="display:none">${initial}</div>`
                : `<div class="search-thumb-fallback search-thumb-fallback-sq">${initial}</div>`
            }</div>
            <div>
              <strong>${escHtml(t.name)}</strong>
              <span class="search-item-meta">· ${escHtml(t.artists?.join(', ') || '')} · ${escHtml(t.album || '')}</span>
            </div>
            <button class="btn btn-sm btn-secondary ss-wishlist-btn" data-idx="${dataIdx}" style="margin-left:auto">+ Wishlist</button>
          </div>`
        })
        html += `</div>`
      }
    }

    el.innerHTML = html
  }

  window.playSearchSong = function (index) {
    const songs = window._searchSongs || []
    if (songs[index]) player.playQueue(songs, index)
  }

  window.addToWishlist = async function (data) {
    if (!soulsync.configured) { showError('SoulSync not configured'); return }
    const { raw } = data
    const name = raw.name
    try {
      const resp = await soulsync.addToWishlist({
        id: raw.id,
        name: raw.name,
        artists: raw.artists || [],
        album: raw.album || raw.name
      })
      if (resp.success) showSuccess(`Added "${name}" to wishlist`)
    } catch (e) {
      if (e.message.includes('already in wishlist')) {
        showSuccess(`"${name}" is already in your wishlist`)
      } else {
        showError(`Failed to add: ${e.message}`)
      }
    }
  }

  async function addAlbumTracksToWishlist(tracks, albumData, onUpdate) {
    const albumName = albumData.name
    const artistName = (albumData.artists && albumData.artists[0]) || ''
    const artist = { name: artistName, id: albumData.id }
    const album = { id: albumData.id, name: albumData.name }
    const sourceContext = {
      album_name: albumName,
      artist_name: artistName,
      album_type: albumData.album_type || 'album'
    }

    let added = 0, skipped = 0, failed = 0
    for (let i = 0; i < tracks.length; i++) {
      const tr = tracks[i]
      const trackObj = {
        id: tr.id,
        name: tr.name,
        artists: tr.artists || [],
        duration_ms: tr.duration_ms || 0,
        track_number: tr.track_number || 0
      }
      try {
        const resp = await soulsync.addAlbumTrackToWishlist(trackObj, artist, album, 'album', sourceContext)
        if (resp?.success) added++
        else failed++
      } catch (e) {
        if (e.message.includes('already in wishlist')) {
          skipped++
        } else {
          try {
            await soulsync.addToWishlist({
              id: tr.id,
              name: tr.name,
              artists: tr.artists || [],
              album: tr.album || albumName
            })
            added++
          } catch (e2) {
            if (e2.message.includes('already in wishlist')) {
              skipped++
            } else {
              failed++
            }
          }
        }
      }
      if (onUpdate) onUpdate(i + 1, tracks.length, added, skipped, failed)
    }
    return { added, skipped, failed }
  }

  window.addSsAlbumToWishlist = async function (dataIdx, btn) {
    const data = window._ssData?.[dataIdx]
    if (!data || data.type !== 'album') return
    const { raw } = data
    const albumName = raw.name
    const artistNames = raw.artists || []

    btn.disabled = true
    btn.textContent = 'Fetching...'

    try {
      const resp = await soulsync.getAlbumTracks(raw.id, albumName, artistNames[0] || '')
      const tracks = resp?.tracks || []

      if (!tracks.length) {
        showError(`No tracks found for "${albumName}"`)
        btn.disabled = false
        btn.textContent = '+ Wishlist'
        return
      }

      btn.textContent = `Adding (0/${tracks.length})...`

      const { added, skipped } = await addAlbumTracksToWishlist(tracks, raw, (done, total) => {
        btn.textContent = `Adding (${done}/${total})...`
      })

      if (added > 0) {
        showSuccess(`Added ${added} track${added !== 1 ? 's' : ''} from "${albumName}"`)
      } else if (skipped > 0) {
        showSuccess(`All ${skipped} track${skipped !== 1 ? 's' : ''} already in wishlist`)
      }
    } catch (e) {
      showError(`Failed: ${e.message}`)
    } finally {
      btn.disabled = false
      btn.textContent = '+ Wishlist'
    }
  }

  window.addAllAlbumTracks = async function (btn) {
    const tracks = window._currentSsAlbumTracks
    const albumData = window._currentSsAlbumData
    if (!tracks?.length || !albumData) return

    btn.disabled = true
    btn.textContent = 'Starting...'

    const { added, skipped } = await addAlbumTracksToWishlist(tracks, albumData, (done, total) => {
      btn.textContent = `Adding (${done}/${total})...`
    })

    if (added > 0) {
      showSuccess(`Added ${added} track${added !== 1 ? 's' : ''} from "${albumData.name}"`)
    } else if (skipped > 0) {
      showSuccess(`All ${skipped} track${skipped !== 1 ? 's' : ''} already in wishlist`)
    } else {
      showError('Failed to add tracks')
    }

    btn.disabled = false
    btn.textContent = 'Add All to Wishlist'
  }

  window.backToSearchResults = function () {
    renderSearch()
    if (window._lastSearchQuery) {
      renderSearchResults(window._lastSearchQuery)
    }
  }

  window.showSsAlbum = async function (dataIdx) {
    const data = window._ssData?.[dataIdx]
    if (!data || data.type !== 'album') return
    const { raw } = data
    const albumName = raw.name
    const artistNames = raw.artists || []
    const albumId = raw.id

    const el = $('#view-search')
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'

    try {
      let tracks = []

      try {
        const resp = await soulsync.getAlbumTracks(albumId, albumName, artistNames[0] || '')
        tracks = resp?.tracks || []
      } catch (e) {
        console.warn('Legacy album endpoint failed, falling back to search:', e.message)
        const [byAlbum, byArtist] = await Promise.all([
          soulsync.searchTracks(albumName, 100).catch(() => null),
          artistNames[0] ? soulsync.searchTracks(artistNames[0], 100).catch(() => null) : null
        ])
        const allTracks = []
        const seen = new Set()
        const merge = (src) => {
          if (!src?.data?.tracks) return
          src.data.tracks.forEach(t => {
            if (!seen.has(t.id)) { seen.add(t.id); allTracks.push(t) }
          })
        }
        merge(byAlbum)
        merge(byArtist)

        const albumNameLower = albumName.toLowerCase()
        tracks = allTracks.filter(t => {
          let trackAlbum = ''
          if (typeof t.album === 'string') trackAlbum = t.album
          else if (t.album?.name) trackAlbum = t.album.name
          else return false
          return trackAlbum.toLowerCase().includes(albumNameLower) ||
                 albumNameLower.includes(trackAlbum.toLowerCase())
        })
      }

      if (!tracks.length) {
        el.innerHTML = `
          <div class="search-container">
            <button class="btn-back" onclick="backToSearchResults()">${icons.back} Back to results</button>
            <div class="error-msg">No tracks found for this album on SoulSync</div>
          </div>`
        return
      }

      tracks.sort((a, b) => (a.track_number || 0) - (b.track_number || 0))

      window._currentSsAlbumTracks = tracks
      window._currentSsAlbumData = raw

      const year = raw.release_date?.substring(0, 4) || ''
      const metaParts = [year, `${tracks.length} tracks`].filter(Boolean)

      let html = `
        <div class="search-container">
          <button class="btn-back" onclick="backToSearchResults()">${icons.back} Back to results</button>
          <div class="album-detail">
            <div class="album-detail-header">
              <div class="album-detail-info">
                <h1>${escHtml(albumName)}</h1>
                <p class="album-detail-artist">${escHtml(artistNames.join(', '))}</p>
                <p class="album-detail-meta">${metaParts.join(' · ')}</p>
                <div class="album-detail-actions">
                  <button class="btn btn-primary" onclick="addAllAlbumTracks(this)">${icons.plus} Add All to Wishlist</button>
                </div>
              </div>
            </div>
            <div class="track-list">
      `

      tracks.forEach((track, i) => {
        const trackDataIdx = window._ssData.length
        window._ssData.push({ type: 'track', raw: track })
        html += `
          <div class="track-row">
            <span class="track-num">${i + 1}</span>
            <div class="track-info">
              <div class="track-name">${escHtml(track.name)}</div>
              <div class="track-artist">${escHtml(track.artists?.join(', ') || '')}</div>
            </div>
            <button class="btn btn-sm btn-secondary ss-wishlist-btn" data-idx="${trackDataIdx}">+ Wishlist</button>
          </div>`
      })

      html += `
            </div>
          </div>
        </div>
      `
      el.innerHTML = html
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  function renderQueue() {
    const state = player.getState()
    const el = $('#view-queue')
    if (!state.queue.length) {
      el.innerHTML = `
        <h2 class="view-title">Queue</h2>
        <div class="empty-state">Queue is empty. Browse and play some music!</div>
      `
      return
    }
    let html = `
      <div class="view-title-wrap">
        <h2 class="view-title" style="margin-bottom:0">Queue (${state.queue.length})</h2>
        <button class="btn btn-sm btn-danger" onclick="clearQueue()">${icons.delete} Clear</button>
      </div>
      <div class="track-list">
    `
    state.queue.forEach((track, i) => {
      const isCurrent = i === state.currentIndex
      html += `
        <div class="track-row ${isCurrent ? 'track-active' : ''}" onclick="jumpToQueueIndex(${i})">
          <span class="track-num">${isCurrent ? icons.play : (i + 1)}</span>
          <div class="track-info">
            <div class="track-name">${escHtml(track.title || track.name || 'Unknown')}</div>
            <div class="track-artist">${escHtml(track.artist || track.artist_name || track.albumArtist || '')}</div>
          </div>
          <button class="icon-btn" onclick="event.stopPropagation();removeFromQueue(${i})" title="Remove">${icons.close}</button>
        </div>
      `
    })
    html += '</div>'
    el.innerHTML = html
  }

  window.clearQueue = function () {
    player.clearQueue()
    renderQueue()
  }

  window.jumpToQueueIndex = function (i) {
    player.playQueue(player.queue, i)
    renderQueue()
  }

  window.removeFromQueue = function (i) {
    player.removeFromQueue(i)
    renderQueue()
  }

  /* ===== Playlists ===== */

  let _playlistsData = null
  let _currentPlaylistTracks = []

  async function renderPlaylists() {
    const el = $('#view-playlists')
    if (!navidrome.configured) {
      el.innerHTML = '<div class="error-msg" style="margin-top:40px">Navidrome not configured</div>'
      return
    }
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'
    try {
      const resp = await navidrome.getPlaylists()
      const playlists = resp?.playlists?.playlist || []
      _playlistsData = playlists

      let html = `
        <div class="view-title-wrap">
          <h2 class="view-title" style="margin-bottom:0">Playlists</h2>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="pl-create-btn">${icons.plus} New</button>
            <button class="btn btn-secondary btn-sm" id="pl-random-btn">${icons.shuffle} Random</button>
          </div>
        </div>
      `

      if (!playlists.length) {
        html += '<div class="empty-state">No playlists yet. Create one or generate a random playlist!</div>'
        el.innerHTML = html
        bindPlaylistActions()
        return
      }

      html += '<div class="track-list" style="margin-top:4px">'
      playlists.forEach(pl => {
        const dur = player.formatTime(pl.duration || 0)
        html += `
          <div class="track-row search-item-clickable" onclick="showPlaylistDetail('${pl.id}')">
            <div class="track-info">
              <div class="track-name">${escHtml(pl.name)}</div>
              <div class="track-artist">${pl.songCount || 0} tracks · ${dur}</div>
            </div>
            <button class="icon-btn" onclick="event.stopPropagation();deletePlaylist('${pl.id}')" title="Delete">${icons.delete}</button>
          </div>`
      })
      html += '</div>'

      el.innerHTML = html
      bindPlaylistActions()
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  function bindPlaylistActions() {
    $('#pl-create-btn')?.addEventListener('click', () => {
      const name = prompt('Playlist name:')
      if (name?.trim()) createPlaylist(name.trim())
    })
    $('#pl-random-btn')?.addEventListener('click', generateRandomPlaylist)
  }

  async function createPlaylist(name) {
    try {
      await navidrome.createPlaylist(name)
      showSuccess(`Created "${name}"`)
      renderPlaylists()
    } catch (e) {
      showError(`Failed: ${e.message}`)
    }
  }

  window.deletePlaylist = async function (id) {
    const pl = _playlistsData?.find(p => p.id === id)
    if (!pl) return
    if (!confirm(`Delete "${pl.name}"? This cannot be undone.`)) return
    try {
      await navidrome.deletePlaylist(id)
      showSuccess(`Deleted "${pl.name}"`)
      renderPlaylists()
    } catch (e) {
      showError(`Failed: ${e.message}`)
    }
  }

  window.showPlaylistDetail = async function (id) {
    const el = $('#view-playlists')
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'
    try {
      const resp = await navidrome.getPlaylist(id)
      const pl = resp?.playlist
      const songs = pl?.entry || []
      _currentPlaylistTracks = songs.map(s => ({
        ...s,
        streamUrl: navidrome.streamUrl(s.id),
        coverUrl: navidrome.coverUrl(s.id, 100),
        albumName: s.album || '',
        albumArtist: s.artist || ''
      }))
      const dur = player.formatTime(pl.duration || 0)

      let html = `
        <button class="btn-back" onclick="renderPlaylists()">${icons.back} Back</button>
        <div class="playlist-detail">
          <div class="view-title-wrap">
            <input type="text" class="input" id="pl-rename-input" value="${escHtml(pl.name)}" style="font-size:1.2rem;font-weight:700;max-width:300px">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" id="pl-save-btn">Save</button>
              <button class="btn btn-secondary btn-sm" id="pl-add-btn">${icons.plus} Add Tracks</button>
              <button class="btn btn-danger btn-sm" id="pl-delete-btn">${icons.delete} Delete</button>
            </div>
          </div>
          <div style="color:var(--text3);font-size:0.82rem;margin-bottom:12px">${pl.songCount || 0} tracks · ${dur}</div>
          <div id="pl-track-list" class="track-list">
      `

      songs.forEach((s, i) => {
        html += `
          <div class="track-row" onclick="playPlaylistTrack(${i})">
            <span class="track-num">${i + 1}</span>
            <div class="track-info">
              <div class="track-name">${escHtml(s.title)}</div>
              <div class="track-artist">${escHtml(s.artist || '')} · ${escHtml(s.album || '')}</div>
            </div>
            <button class="icon-btn" onclick="event.stopPropagation();removePlaylistTrack('${id}', '${escHtml(s.id)}', this)" title="Remove">${icons.close}</button>
          </div>`
      })

      html += `
          </div>
        </div>
      `

      if (songs.length === 0) {
        html = `
          <button class="btn-back" onclick="renderPlaylists()">${icons.back} Back</button>
          <div class="playlist-detail">
            <div class="view-title-wrap">
              <input type="text" class="input" id="pl-rename-input" value="${escHtml(pl.name)}" style="font-size:1.2rem;font-weight:700;max-width:300px">
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn btn-primary btn-sm" id="pl-save-btn">Save</button>
                <button class="btn btn-secondary btn-sm" id="pl-add-btn">${icons.plus} Add Tracks</button>
                <button class="btn btn-danger btn-sm" id="pl-delete-btn">${icons.delete} Delete</button>
              </div>
            </div>
            <div class="empty-state">This playlist is empty.</div>
          </div>`
      }

      el.innerHTML = html

      $('#pl-save-btn')?.addEventListener('click', () => savePlaylistChanges(id))
      $('#pl-add-btn')?.addEventListener('click', () => showPlaylistAddTracks(id))
      $('#pl-delete-btn')?.addEventListener('click', () => deletePlaylist(id))
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  async function savePlaylistChanges(id) {
    const nameInput = $('#pl-rename-input')
    const newName = nameInput?.value?.trim()
    if (!newName) return
    try {
      await navidrome.updatePlaylist(id, { name: newName })
      showSuccess('Playlist updated')
      renderPlaylists()
    } catch (e) {
      showError(`Failed: ${e.message}`)
    }
  }

  window.removePlaylistTrack = async function (plId, trackId, btn) {
    btn.disabled = true
    try {
      await navidrome.updatePlaylist(plId, { songIdsToRemove: [trackId] })
      showSuccess('Track removed')
      showPlaylistDetail(plId)
    } catch (e) {
      showError(`Failed: ${e.message}`)
      btn.disabled = false
    }
  }

  window.playPlaylistTrack = function (index) {
    const songs = _currentPlaylistTracks
    if (songs?.[index]) player.playQueue(songs, index)
  }

  async function showPlaylistAddTracks(plId) {
    const trackListEl = $('#pl-track-list')
    if (!trackListEl) return

    const existingSearch = trackListEl.querySelector('.pl-add-search')
    if (existingSearch) { existingSearch.remove(); return }

    const searchDiv = document.createElement('div')
    searchDiv.className = 'pl-add-search'
    searchDiv.style.cssText = 'padding:12px;border-bottom:1px solid var(--border)'
    searchDiv.innerHTML = `
      <div style="display:flex;gap:8px">
        <input type="text" class="input" id="pl-add-input" placeholder="Search tracks to add..." style="flex:1">
        <button class="btn btn-primary btn-sm" id="pl-add-search-btn">Search</button>
      </div>
      <div id="pl-add-results" style="margin-top:8px"></div>
    `
    trackListEl.prepend(searchDiv)

    async function doPlTrackSearch() {
      const q = $('#pl-add-input')?.value.trim()
      if (!q) return
      const resultsEl = $('#pl-add-results')
      resultsEl.innerHTML = '<div style="padding:8px;color:var(--text3)">Searching...</div>'
      try {
        const resp = await navidrome.search3(q, 0, 0, 20)
        const songs = resp?.searchResult3?.song || []
        if (!songs.length) {
          resultsEl.innerHTML = '<div style="padding:8px;color:var(--text3)">No tracks found</div>'
          return
        }
        resultsEl.innerHTML = ''
        songs.forEach(s => {
          const div = document.createElement('div')
          div.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.85rem'
          div.innerHTML = `
            <span style="flex:1;min-width:0"><strong>${escHtml(s.title)}</strong> <span style="color:var(--text2)">· ${escHtml(s.artist || '')}</span></span>
            <button class="btn btn-sm btn-secondary" style="flex-shrink:0">Add</button>
          `
          div.querySelector('button').addEventListener('click', async () => {
            const btn = div.querySelector('button')
            btn.disabled = true
            btn.textContent = 'Adding...'
            try {
              await navidrome.updatePlaylist(plId, { songIdsToAdd: [s.id] })
              btn.textContent = 'Added ✓'
              setTimeout(() => showPlaylistDetail(plId), 600)
            } catch (e) {
              showError(`Failed: ${e.message}`)
              btn.disabled = false
              btn.textContent = 'Add'
            }
          })
          resultsEl.appendChild(div)
        })
      } catch (e) {
        resultsEl.innerHTML = `<div style="padding:8px;color:var(--red)">${e.message}</div>`
      }
    }

    $('#pl-add-search-btn')?.addEventListener('click', doPlTrackSearch)
    $('#pl-add-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doPlTrackSearch()
    })
    setTimeout(() => $('#pl-add-input')?.focus(), 100)
  }

  async function generateRandomPlaylist() {
    const countStr = prompt('How many random songs?', '20')
    const count = parseInt(countStr)
    if (!count || count < 1 || count > 500) return
    try {
      const resp = await navidrome.getRandomSongs(count)
      const songs = resp?.randomSongs?.song || []
      if (!songs.length) {
        showError('No songs returned')
        return
      }
      const name = `Random ${count} (${new Date().toLocaleDateString()})`
      const songIds = songs.map(s => s.id)
      await navidrome.createPlaylist(name, songIds)
      showSuccess(`Created "${name}" with ${songs.length} songs`)
      renderPlaylists()
    } catch (e) {
      showError(`Failed: ${e.message}`)
    }
  }

  window.renderPlaylists = renderPlaylists
  window.createPlaylist = createPlaylist
  window.showPlaylistDetail = showPlaylistDetail
  window.playPlaylistTrack = playPlaylistTrack
  window.player = player
  window.navidrome = navidrome
  window.soulsync = soulsync

  function loadWishlistInSettings() {
    renderWishlistTo($('#settings-wishlist-content'))
  }

  function renderWishlistTo(el) {
    if (!el) return
    if (!soulsync.configured) {
      el.innerHTML = '<div class="empty-state" style="padding:20px">SoulSync not configured</div>'
      return
    }
    el.innerHTML = '<div class="loading" style="padding:20px"><div class="loading-spinner"></div></div>'

    Promise.all([
      soulsync.getWishlist(1, 200).catch(() => null),
      soulsync.getWishlistStats().catch(() => null)
    ]).then(([wishlistRes, statsRes]) => {
      const tracks = wishlistRes?.data?.tracks || []
      const stats = statsRes || {}
      const countEl = $('#sw-count')
      if (countEl) countEl.textContent = tracks.length || ''

      if (!tracks.length) {
        el.innerHTML = '<div class="empty-state" style="padding:20px">Wishlist is empty. Search and add tracks or albums!</div>'
        return
      }

      const total = stats.total || tracks.length
      const singles = stats.singles || 0
      const albums = stats.albums || 0
      const isProcessing = stats.is_auto_processing || false

      let html = `
        <div class="wishlist-actions" style="margin-bottom:10px">
          <button class="btn btn-primary btn-sm" id="sw-download-btn" ${isProcessing ? 'disabled' : ''}>
            ${isProcessing ? 'Processing...' : `${icons.download} Download All`}
          </button>
          <button class="btn btn-danger btn-sm" id="sw-clear-btn">${icons.delete} Clear</button>
        </div>
        <div class="wishlist-stats">
          <span class="wishlist-stat">${total} total</span>
          ${singles ? `<span class="wishlist-stat">${singles} singles</span>` : ''}
          ${albums ? `<span class="wishlist-stat">${albums} albums</span>` : ''}
        </div>
        <div class="track-list">
      `

      tracks.forEach(t => {
        const trackId = t.track_id || t.spotify_track_id || ''
        const hasFailed = t.retry_count > 0 || t.failure_reason
        const addedDate = t.date_added ? new Date(t.date_added).toLocaleDateString() : ''
        html += `
          <div class="track-row wishlist-track">
            <div class="track-info">
              <div class="track-name">${escHtml(t.track_name || 'Unknown')}</div>
              <div class="track-artist">
                ${escHtml(t.artist_name || '')}
                ${t.album_name ? `· <span class="wishlist-album">${escHtml(t.album_name)}</span>` : ''}
              </div>
              <div class="wishlist-track-meta">
                <span class="wishlist-date">${addedDate}</span>
                ${t.source_type ? `<span>${escHtml(t.source_type)}</span>` : ''}
                ${hasFailed ? `<span class="wishlist-failed" title="${escHtml(t.failure_reason || `Retries: ${t.retry_count}`)}">⚠ failed</span>` : ''}
              </div>
            </div>
            <span class="wishlist-source-type">${escHtml(t.source_type || '')}</span>
            <button class="icon-btn" onclick="removeWishlistTrackInSettings('${escHtml(trackId)}', this)" title="Remove">${icons.close}</button>
          </div>`
      })

      html += '</div>'
      el.innerHTML = html

      $('#sw-download-btn')?.addEventListener('click', async () => {
        const btn = $('#sw-download-btn')
        btn.disabled = true
        btn.textContent = 'Starting...'
        try {
          await soulsync.downloadWishlist()
          showSuccess('Wishlist download started')
        } catch (e) {
          if (e.message.includes('already processing')) {
            showError('Wishlist is already processing')
          } else {
            showError(`Failed: ${e.message}`)
          }
        } finally {
          btn.disabled = false
          btn.innerHTML = `${icons.download} Download All`
        }
      })

      $('#sw-clear-btn')?.addEventListener('click', async () => {
        if (!confirm('Clear entire wishlist? This cannot be undone.')) return
        const btn = $('#sw-clear-btn')
        btn.disabled = true
        btn.textContent = 'Clearing...'
        try {
          await soulsync.clearWishlist()
          showSuccess('Wishlist cleared')
          loadWishlistInSettings()
        } catch (e) {
          showError(`Failed: ${e.message}`)
          btn.disabled = false
          btn.innerHTML = `${icons.delete} Clear`
        }
      })
    }).catch(e => {
      el.innerHTML = `<div class="error-msg" style="padding:20px">${e.message}</div>`
    })
  }

  window.removeWishlistTrackInSettings = async function (trackId, btn) {
    if (!trackId) return
    btn.disabled = true
    try {
      await soulsync.removeFromWishlist(trackId)
      showSuccess('Track removed from wishlist')
      loadWishlistInSettings()
    } catch (e) {
      showError(`Failed: ${e.message}`)
      btn.disabled = false
    }
  }

  function renderWishlist() {
    loadWishlistInSettings()
  }

  function bindPlayer() {
    const playBtn = $('#ctrl-play')
    const prevBtn = $('#ctrl-prev')
    const nextBtn = $('#ctrl-next')
    const shuffleBtn = $('#ctrl-shuffle')
    const repeatBtn = $('#ctrl-repeat')
    const progressBar = $('#progress-bar')
    const volumeBar = $('#volume-bar')
    const npCover = $('#np-cover')
    const npTitle = $('#np-title')
    const npArtist = $('#np-artist')
    const npCurrent = $('#np-current')
    const npDuration = $('#np-duration')
    const progressFill = $('#np-progress-fill')

    const npOverlayPlay = $('#np-overlay-play')
    const npOverlayProgress = $('#np-overlay-progress')
    const npOverlayVolume = $('#np-overlay-volume')
    const npOverlayCover = $('#np-overlay-cover')
    const npOverlayTitle = $('#np-overlay-title')
    const npOverlayArtist = $('#np-overlay-artist')
    const npOverlayAlbum = $('#np-overlay-album')
    const npOverlayCurrent = $('#np-overlay-current')
    const npOverlayDuration = $('#np-overlay-duration')
    const npShuffleBtn = $('#np-ctrl-shuffle')
    const npRepeatBtn = $('#np-ctrl-repeat')

    const nowPlayingBar = $('#now-playing-bar')

    playBtn?.addEventListener('click', () => player.togglePlay())
    prevBtn?.addEventListener('click', () => player.prev())
    nextBtn?.addEventListener('click', () => player.next())
    shuffleBtn?.addEventListener('click', () => { player.toggleShuffle(); shuffleBtn.style.opacity = player.shuffle ? '1' : '0.4' })
    repeatBtn?.addEventListener('click', () => { player.toggleRepeat(); repeatBtn.style.opacity = player.repeat ? '1' : '0.4' })

    nowPlayingBar?.addEventListener('click', e => {
      if (e.target.closest('.ctrl-btn')) return
      showNowPlaying()
    })

    let scrubbing = false
    progressBar?.addEventListener('mousedown', () => { scrubbing = true })
    progressBar?.addEventListener('touchstart', () => { scrubbing = true })
    progressBar?.addEventListener('input', () => {
      if (scrubbing && player.audio.duration) {
        player.audio.currentTime = (progressBar.value / 100) * player.audio.duration
      }
    })
    progressBar?.addEventListener('mouseup', () => { scrubbing = false })
    progressBar?.addEventListener('touchend', () => { scrubbing = false })

    volumeBar?.addEventListener('input', () => {
      player.setVolume(volumeBar.value)
    })

    $('#np-back-btn')?.addEventListener('click', hideNowPlaying)

    npOverlayPlay?.addEventListener('click', () => player.togglePlay())
    $('#np-ctrl-prev')?.addEventListener('click', () => player.prev())
    $('#np-ctrl-next')?.addEventListener('click', () => player.next())
    npShuffleBtn?.addEventListener('click', () => { player.toggleShuffle(); npShuffleBtn.style.opacity = player.shuffle ? '1' : '0.4' })
    npRepeatBtn?.addEventListener('click', () => { player.toggleRepeat(); npRepeatBtn.style.opacity = player.repeat ? '1' : '0.4' })

    let npScrubbing = false
    npOverlayProgress?.addEventListener('mousedown', () => { npScrubbing = true })
    npOverlayProgress?.addEventListener('touchstart', () => { npScrubbing = true })
    npOverlayProgress?.addEventListener('input', () => {
      if (npScrubbing && player.audio.duration) {
        player.audio.currentTime = (npOverlayProgress.value / 100) * player.audio.duration
      }
    })
    npOverlayProgress?.addEventListener('mouseup', () => { npScrubbing = false })
    npOverlayProgress?.addEventListener('touchend', () => { npScrubbing = false })

    npOverlayVolume?.addEventListener('input', () => {
      player.setVolume(npOverlayVolume.value)
    })

    player.on('timeupdate', state => {
      const pct = state.duration ? (state.currentTime / state.duration) * 100 : 0
      if (!scrubbing && state.duration) {
        progressBar.value = pct
      }
      if (!npScrubbing && state.duration) {
        npOverlayProgress.value = pct
      }
      if (progressFill) progressFill.style.width = `${pct}%`
      if (npCurrent) npCurrent.textContent = player.formatTime(state.currentTime)
      if (npDuration) npDuration.textContent = player.formatTime(state.duration)
      if (npOverlayCurrent) npOverlayCurrent.textContent = player.formatTime(state.currentTime)
      if (npOverlayDuration) npOverlayDuration.textContent = player.formatTime(state.duration)
      if (npOverlayProgress) npOverlayProgress.value = pct
      if (npOverlayVolume) npOverlayVolume.value = state.volume
    })

    player.on('loaded', state => {
      const t = state.currentTrack
      if (t) {
        npTitle.textContent = t.title || t.name || 'Unknown'
        npArtist.textContent = [t.artist, t.artist_name, t.albumArtist, t.albumName].filter(Boolean).join(' · ')
        npCover.src = t.coverUrl || ''
        npOverlayTitle.textContent = t.title || t.name || 'Unknown'
        npOverlayArtist.textContent = [t.artist, t.artist_name, t.albumArtist].filter(Boolean).join(' · ')
        npOverlayAlbum.textContent = t.albumName || t.album || ''
        npOverlayCover.src = t.coverUrl || ''
      }
    })

    player.on('play', () => {
      playBtn.innerHTML = icons.pause
      npOverlayPlay.innerHTML = icons.pause
    })
    player.on('pause', () => {
      playBtn.innerHTML = icons.play
      npOverlayPlay.innerHTML = icons.play
    })
    player.on('error', () => {
      const t = player.getState().currentTrack
      const msg = t ? `Failed to play: ${t.title || 'unknown'}` : 'Playback failed'
      showError(msg)
    })
  }

  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return
      switch (e.code) {
        case 'Space': e.preventDefault(); player.togglePlay(); break
        case 'ArrowRight': player.next(); break
        case 'ArrowLeft': player.prev(); break
        case 'KeyS': navigate('search'); break
        case 'KeyH': navigate('home'); break
      }
    })
  }

  document.addEventListener('DOMContentLoaded', init)
})()
