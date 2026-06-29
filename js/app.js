(function () {
  const navidrome = new NavidromeClient()
  window.__navidrome = navidrome
  const soulsync = new SoulSyncClient()
  const settings = new SettingsManager()
  const player = new MusicPlayer()

  let currentView = 'home'
  let previousView = 'home'
  let searchResults = { navidrome: null, soulsync: null }
  let albumHistoryView = 'home'
  let libraryState = { tab: 'albums', search: '', sortBy: 'name', albums: null, artists: null, tracks: null }
  let _allGenres = []
  let _cachedTracks = {}
  let _cachingTracks = {}
  let _origStreamUrl = null

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
    menu: '<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.31C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z"/></svg>',
    heartFilled: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    genre: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>'
  }

  let _wizardStep = 0
  let _tourStop = 0

  const _wizardSteps = ['Welcome', 'Navidrome', 'SoulSync', 'Done']
  const _tourStops = [
    { view: 'home', selector: '#view-home', title: 'Home', text: 'Your dashboard — see recently played, new releases, and random picks from your library.' },
    { view: 'search', selector: '#search-input', title: 'Search', text: 'Find any song, album, or artist in your library.' },
    { view: 'albums', selector: '.library-tabs', title: 'Library', text: 'Browse your collection by Albums, Artists, or Tracks. Filter and sort as you like.' },
    { view: 'playlists', selector: '#view-playlists .view-title', title: 'Playlists', text: 'Access all your Navidrome playlists in one place.' },
    { view: 'home', selector: '#np-title', title: 'Now Playing', text: 'Tap the bottom bar to open full player controls, queue, EQ, and sleep timer.' },
    { view: 'home', selector: '.top-bar-brand', title: 'Menu', text: 'Tap the Fynix logo to open the sidebar with full navigation to all sections.' },
    { view: 'settings', selector: '.settings-tabs', title: 'Settings', text: 'Configure servers, audio (crossfade, gapless, EQ), and more.' }
  ]

  function startWizard() {
    _wizardStep = 0
    renderWizardOverlay()
    renderWizardStep(0)
  }

  function renderWizardOverlay() {
    let el = $('#wizard-overlay')
    if (el) { el.classList.remove('hidden'); return }
    el = document.createElement('div')
    el.id = 'wizard-overlay'
    el.className = 'wizard-overlay'
    el.innerHTML = `
      <div class="wizard-card">
        <div class="wizard-header" id="wizard-dots"></div>
        <div class="wizard-step active" id="wizard-body"></div>
        <div class="wizard-footer">
          <button class="wizard-btn wizard-btn-ghost" id="wizard-skip" onclick="wizardSkip()">Skip</button>
          <div class="wizard-footer-right">
            <button class="wizard-btn" id="wizard-back" onclick="wizardBack()" style="display:none">Back</button>
            <button class="wizard-btn wizard-btn-primary" id="wizard-next" onclick="wizardNext()">Next</button>
          </div>
        </div>
      </div>`
    document.body.appendChild(el)
  }

  function renderWizardDots(active) {
    const el = $('#wizard-dots')
    if (!el) return
    el.innerHTML = _wizardSteps.map((_, i) =>
      `<span class="wizard-dot${i === active ? ' active' : ''}${i < active ? ' done' : ''}"></span>`
    ).join('')
  }

  function renderWizardStep(idx) {
    _wizardStep = idx
    renderWizardDots(idx)
    const body = $('#wizard-body')
    const backBtn = $('#wizard-back')
    const nextBtn = $('#wizard-next')
    backBtn.style.display = idx === 0 ? 'none' : ''
    switch (idx) {
      case 0:
        body.innerHTML = `
          <img src="assets/logo.png" class="wizard-logo" alt="">
          <h2>Welcome to Fynix</h2>
          <p>Your personal music player. Connect your Navidrome and SoulSync servers to start listening, managing your wishlist, and more.</p>
          <p style="margin-bottom:0">Let's get you set up in a few steps.</p>`
        nextBtn.textContent = 'Get Started'
        break
      case 1:
        body.innerHTML = `
          <h2>Connect Navidrome</h2>
          <p>Enter your Navidrome server details to access your music library.</p>
          <div class="wizard-input-group">
            <label>Server URL</label>
            <input class="wizard-input" id="wiz-nav-server" placeholder="http://server:4533">
          </div>
          <div class="wizard-input-group">
            <label>Username</label>
            <input class="wizard-input" id="wiz-nav-user" placeholder="Username">
          </div>
          <div class="wizard-input-group">
            <label>Password</label>
            <input class="wizard-input" id="wiz-nav-pass" type="password" placeholder="password">
          </div>
          <div>
            <button class="wizard-test-btn" id="wiz-nav-test">Test Connection</button>
            <div class="wizard-test-msg" id="wiz-nav-msg"></div>
          </div>`
        nextBtn.textContent = 'Next'
        $('#wiz-nav-test').onclick = wizardTestNavidrome
        break
      case 2:
        body.innerHTML = `
          <h2>Connect SoulSync</h2>
          <p>SoulSync adds wishlist management and download tracking. Set up your server URL and API key.</p>
          <div class="wizard-input-group">
            <label>Server URL</label>
            <input class="wizard-input" id="wiz-ss-server" placeholder="http://server:8008">
          </div>
          <div class="wizard-input-group">
            <label>API Key</label>
            <input class="wizard-input" id="wiz-ss-key" placeholder="sk_...">
          </div>
          <p style="font-size:.75rem;color:var(--text3);margin-top:-8px">Generate an API key from your SoulSync server's settings page.</p>
          <div>
            <button class="wizard-test-btn" id="wiz-ss-test">Test Connection</button>
            <div class="wizard-test-msg" id="wiz-ss-msg"></div>
          </div>`
        nextBtn.textContent = 'Next'
        $('#wiz-ss-test').onclick = wizardTestSoulSync
        break
      case 3:
        body.innerHTML = `
          <h2 style="text-align:center;margin-top:8px">You're all set!</h2>
          <p style="text-align:center">Your servers are configured. Take a quick tour to learn the interface, or jump right in.</p>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
            <button class="wizard-btn wizard-btn-primary" id="wiz-tour-btn" onclick="wizardFinish(true)" style="text-align:center">${icons.shuffle} Take a Tour</button>
            <button class="wizard-btn" id="wiz-start-btn" onclick="wizardFinish(false)" style="text-align:center">${icons.play} Get Started</button>
          </div>`
        backBtn.style.display = 'none'
        nextBtn.style.display = 'none'
        $('#wizard-skip').style.display = 'none'
        return
    }
    nextBtn.style.display = ''
    $('#wizard-skip').style.display = ''
  }

  window.wizardNext = function () {
    const s = settings.load()
    if (_wizardStep === 1) {
      s.navidrome_server = $('#wiz-nav-server')?.value || ''
      s.navidrome_username = $('#wiz-nav-user')?.value || ''
      s.navidrome_password = $('#wiz-nav-pass')?.value || ''
      Object.assign(navidrome, { server: s.navidrome_server, username: s.navidrome_username, password: s.navidrome_password, proxyUrl: s.navidrome_proxy })
      updateSidebarStatus()
    }
    if (_wizardStep === 2) {
      s.soulsync_server = $('#wiz-ss-server')?.value || ''
      s.soulsync_apikey = $('#wiz-ss-key')?.value || ''
      Object.assign(soulsync, { server: s.soulsync_server, apiKey: s.soulsync_apikey, proxyUrl: s.soulsync_proxy })
      updateSidebarStatus()
    }
    settings.save(s)
    if (_wizardStep < 3) renderWizardStep(_wizardStep + 1)
  }

  window.wizardBack = function () {
    if (_wizardStep > 0) renderWizardStep(_wizardStep - 1)
  }

  window.wizardSkip = function () {
    settings.save({ _wizard_done: 'true' })
    const overlay = $('#wizard-overlay')
    if (overlay) overlay.classList.add('hidden')
    if (!navidrome.configured) navigate('settings')
    else navigate('home')
  }

  window.wizardFinish = function (tour) {
    const s = settings.load()
    s._wizard_done = 'true'
    settings.save(s)
    const overlay = $('#wizard-overlay')
    if (overlay) overlay.classList.add('hidden')
    if (tour) {
      _tourStop = 0
      startTour()
    } else {
      navigate('home')
    }
  }

  async function wizardTestNavidrome() {
    const btn = $('#wiz-nav-test')
    const msg = $('#wiz-nav-msg')
    btn.disabled = true
    btn.textContent = 'Testing...'
    msg.className = 'wizard-test-msg'
    msg.textContent = ''
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 20000)
    try {
      const testNav = new NavidromeClient()
      testNav.server = $('#wiz-nav-server')?.value || ''
      testNav.username = $('#wiz-nav-user')?.value || ''
      testNav.password = $('#wiz-nav-pass')?.value || ''
      if (window.AndroidBridge) testNav.proxyUrl = 'http://localhost:8080'
      const origRequest = testNav._request.bind(testNav)
      const abortPromise = new Promise((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(new Error('Connection timed out')))
      )
      testNav._request = (endpoint, params) =>
        Promise.race([origRequest(endpoint, params), abortPromise])
      const resp = await testNav.ping()
      msg.className = 'wizard-test-msg success'
      msg.textContent = `Connected! v${resp.serverVersion}`
    } catch (e) {
      msg.className = 'wizard-test-msg error'
      msg.textContent = e.message
    } finally {
      clearTimeout(t)
      btn.disabled = false
      btn.textContent = 'Test Connection'
    }
  }

  async function wizardTestSoulSync() {
    const btn = $('#wiz-ss-test')
    const msg = $('#wiz-ss-msg')
    btn.disabled = true
    btn.textContent = 'Testing...'
    msg.className = 'wizard-test-msg'
    msg.textContent = ''
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 15000)
    try {
      const testSs = new SoulSyncClient()
      testSs.server = $('#wiz-ss-server')?.value || ''
      testSs.apiKey = $('#wiz-ss-key')?.value || ''
      if (window.AndroidBridge) testSs.proxyUrl = 'http://localhost:8080'
      await testSs.searchTracks('test', 1)
      msg.className = 'wizard-test-msg success'
      msg.textContent = 'Connected!'
    } catch (e) {
      msg.className = 'wizard-test-msg error'
      msg.textContent = e.message
    } finally {
      clearTimeout(t)
      btn.disabled = false
      btn.textContent = 'Test Connection'
    }
  }

  function startTour() {
    let overlay = $('#tour-overlay')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = 'tour-overlay'
      overlay.className = 'tour-overlay'
      overlay.innerHTML = '<div class="tour-highlight" id="tour-highlight"></div>'
      document.body.appendChild(overlay)
    }
    overlay.style.display = ''
    let tooltip = $('#tour-tooltip')
    if (!tooltip) {
      tooltip = document.createElement('div')
      tooltip.className = 'tour-tooltip'
      tooltip.id = 'tour-tooltip'
      document.body.appendChild(tooltip)
    }
    tooltip.style.display = ''
    showTourStop(0)
  }

  function showTourStop(idx) {
    _tourStop = idx
    const stop = _tourStops[idx]
    if (!stop) return
    navigate(stop.view)
    setTimeout(() => {
      const el = document.querySelector(stop.selector)
      const highlight = $('#tour-highlight')
      const tooltip = $('#tour-tooltip')
      if (!tooltip) return
      if (el) {
        const rect = el.getBoundingClientRect()
        highlight.style.display = 'block'
        highlight.style.left = (rect.left - 6) + 'px'
        highlight.style.top = (rect.top - 6) + 'px'
        highlight.style.width = (rect.width + 12) + 'px'
        highlight.style.height = (rect.height + 12) + 'px'
      } else {
        highlight.style.display = 'none'
      }
      if (document.activeElement?.blur) document.activeElement.blur()
      tooltip.innerHTML = `
        <h4>${stop.title}</h4>
        <p>${stop.text}</p>
        <div class="tour-tooltip-nav">
          <span style="font-size:.7rem;color:var(--text3)">${idx + 1} / ${_tourStops.length}</span>
          <div style="display:flex;gap:6px">
            ${idx > 0 ? '<button class="wizard-btn wizard-btn-ghost" id="tour-prev">Prev</button>' : ''}
            ${idx < _tourStops.length - 1
              ? '<button class="wizard-btn wizard-btn-primary" id="tour-next">Next</button>'
              : '<button class="wizard-btn wizard-btn-primary" id="tour-finish">Finish Tour</button>'}
          </div>
        </div>`
      tooltip.style.display = 'block'
      $('#tour-prev')?.addEventListener('click', tourPrev)
      $('#tour-next')?.addEventListener('click', tourNext)
      $('#tour-finish')?.addEventListener('click', tourFinish)
    }, 100)
  }

  function tourNext() {
    if (_tourStop < _tourStops.length - 1) showTourStop(_tourStop + 1)
  }

  function tourPrev() {
    if (_tourStop > 0) showTourStop(_tourStop - 1)
  }

  function tourFinish() {
    const highlight = $('#tour-highlight')
    const tooltip = $('#tour-tooltip')
    const overlay = $('#tour-overlay')
    if (highlight) highlight.style.display = 'none'
    if (tooltip) tooltip.style.display = 'none'
    if (overlay) overlay.style.display = 'none'
    navigate('home')
  }

  window.restartWizard = function () {
    settings.save({ _wizard_done: 'false' })
    startWizard()
  }

  function init() {
    try {
      renderLayout()
      bindNavigation()
      bindSettings()
      bindPlayer()
      bindSearch()
      bindKeyboard()
      applySavedSettings()
      if (window.AndroidBridge) {
        _refreshCachedTracks()
        const mb = parseInt(settings.load().max_cache_size_mb) || 500
        AndroidBridge.setCacheMaxSize(mb * 1048576)
        _origStreamUrl = navidrome.streamUrl.bind(navidrome)
        navidrome.streamUrl = (id) => _getCachedUrl(id) || _origStreamUrl(id)
      }
      _initKofi()
      const s = settings.load()
      if (s._wizard_done !== 'true' && s._wizard_done !== true) {
        navigate('home')
        startWizard()
        return
      }
      if (!navidrome.configured) {
        navigate('settings')
      } else {
        navigate('home')
        setTimeout(() => {
          try { restorePlaybackState() } catch (_) {}
        }, 0)
      }
    } finally {
      hideSplash()
      setTimeout(hideSplash, 3000)
    }
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
    const artistText = [...new Set([track.artist, track.artist_name, track.albumArtist].filter(Boolean))].join(' · ')
    const albumNameText = track.albumName || track.album || ''
    const coverSrc = track.coverUrl || ''
    const byId = id => document.getElementById(id)
    // Bottom bar
    const nt = byId('np-title'); if (nt) nt.textContent = titleText
    const na = byId('np-artist'); if (na) na.innerHTML = artistText ? `<a class="meta-link" onclick="event.stopPropagation();showArtistFromNowPlaying()">${escHtml(artistText)}</a>` : ''
    const nab = byId('np-album'); if (nab) nab.innerHTML = albumNameText ? `<a class="meta-link" onclick="event.stopPropagation();showAlbumFromNowPlaying()">${escHtml(albumNameText)}</a>` : ''
    const nc = byId('np-cover'); if (nc) nc.src = coverSrc
    // Now playing overlay
    const noc = byId('np-overlay-cover'); if (noc) noc.src = coverSrc
    const not = byId('np-overlay-title'); if (not) not.textContent = titleText
    const noal = byId('np-overlay-artist-link'); if (noal) { noal.textContent = artistText; noal.onclick = () => window.showArtistFromNowPlaying() }
    const noabl = byId('np-overlay-album-link'); if (noabl) { noabl.textContent = albumNameText; noabl.onclick = () => window.showAlbumFromNowPlaying() }
    // Progress
    const pb = byId('progress-bar'); if (pb) pb.value = pct
    const pf = byId('np-progress-fill'); if (pf) pf.style.width = pct + '%'
    const nc2 = byId('np-current'); if (nc2) nc2.textContent = player.formatTime(savedTime)
    const nd = byId('np-duration'); if (nd) nd.textContent = player.formatTime(dur)
    const op = byId('np-overlay-progress'); if (op) op.value = pct
    const oc = byId('np-overlay-current'); if (oc) oc.textContent = player.formatTime(savedTime)
    const od = byId('np-overlay-duration'); if (od) od.textContent = player.formatTime(dur)
    // Play button morph
    const cpEl = byId('ctrl-play'); if (cpEl) cpEl.classList.toggle('is-playing', wasPlaying)
    const npEl = byId('np-overlay-play'); if (npEl) npEl.classList.toggle('is-playing', wasPlaying)
    // Show now-playing bar
    const npb = byId('now-playing-bar')
    if (npb) npb.style.display = ''
    // Bottom bar star
    const barStar = byId('np-bar-star')
    if (barStar && track.id) {
      barStar.style.display = ''
      barStar.dataset.id = track.id
      const starred = !!track.starred
      barStar.dataset.starred = starred
      barStar.classList.toggle('starred', starred)
      barStar.innerHTML = icons[starred ? 'heartFilled' : 'heart']
    }
    // Overlay star
    const overlayStar = byId('np-overlay-star')
    if (overlayStar && track.id) {
      overlayStar.style.display = ''
      overlayStar.dataset.id = track.id
      const starred = !!track.starred
      overlayStar.dataset.starred = starred
      overlayStar.classList.toggle('starred', starred)
      overlayStar.innerHTML = icons[starred ? 'heartFilled' : 'heart']
    }
    // Background + color extraction
    const bgImg = byId('np-overlay-bg-img')
    if (bgImg) bgImg.src = coverSrc
    _extractColors(coverSrc)
    // Remaining time
    const remEl = byId('np-remaining')
    const remOverlay = byId('np-overlay-remaining')
    const remText = dur ? '-' + player.formatTime(dur - savedTime) : ''
    if (remEl) { remEl.textContent = remText; remEl.style.display = remText ? '' : 'none' }
    if (remOverlay) { remOverlay.textContent = remText; remOverlay.style.display = remText ? '' : 'none' }
    // Load audio to get correct duration/currentTime, seek to saved position
    player._loadCurrent(wasPlaying)
  }

  function applySavedSettings() {
    const s = settings.load()
    if (s.crossfade) player.setCrossfade(parseFloat(s.crossfade) || 0)
    player.setGapless(s.gapless !== false)
    if (s.eqEnabled && s.equalizer) player.setEq(s.equalizer)
    // On Android, default to embedded proxy (CORS bypass)
    if (window.AndroidBridge) {
      if (!s.soulsync_proxy) {
        s.soulsync_proxy = 'http://localhost:8080'
        settings.save({ soulsync_proxy: 'http://localhost:8080' })
      }
      if (!s.navidrome_proxy) {
        s.navidrome_proxy = 'http://localhost:8080'
        settings.save({ navidrome_proxy: 'http://localhost:8080' })
      }
    }
    if (s.navidrome_server) {
      Object.assign(navidrome, {
        server: s.navidrome_server,
        username: s.navidrome_username,
        password: s.navidrome_password,
        proxyUrl: s.navidrome_proxy,
        streamFormat: s.navidrome_stream_format
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
          <div class="top-bar-brand" onclick="document.getElementById('sidebar')?.classList.toggle('open');document.getElementById('sidebar-backdrop')?.classList.toggle('show')">
            <img src="assets/logo.png" class="top-bar-logo" alt="Fynix">
          </div>
        </div>
        <span class="top-bar-center" id="top-bar-title">Home</span>
        <div class="top-bar-right"></div>
      </header>

      <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="this.classList.remove('show');document.getElementById('sidebar')?.classList.remove('open')"></div>

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
          <a href="#" data-view="genres" class="nav-item">${icons.genre} Genres</a>
          <a href="#" data-view="settings" class="nav-item">${icons.settings} Settings</a>
        </nav>
        <div class="sidebar-kofi" id="sidebar-kofi"></div>
        <div class="sidebar-status" id="sidebar-status"></div>
      </aside>

      <main class="main-content" id="main-content">
        <div class="view" id="view-home"></div>
        <div class="view hidden" id="view-albums"></div>
        <div class="view hidden" id="view-artists"></div>
        <div class="view hidden" id="view-search"></div>
        <div class="view hidden" id="view-settings"></div>
        <div class="view hidden" id="view-queue"></div>
        <div class="view hidden" id="view-genres"></div>
        <div class="view hidden" id="view-playlists"></div>
        <div class="view hidden" id="view-genre-tracks"></div>
        <div class="context-menu" id="context-menu" onclick="closeContextMenu()">
          <div class="context-menu-content" onclick="event.stopPropagation()"></div>
        </div>
        <div class="bio-modal" id="bio-modal" onclick="closeBioModal()">
          <div class="bio-modal-content" onclick="event.stopPropagation()">
            <button class="bio-modal-close" onclick="closeBioModal()">&times;</button>
            <h3 class="bio-modal-title"></h3>
            <div class="bio-modal-text"></div>
          </div>
        </div>
      </main>

      <footer class="now-playing-bar" id="now-playing-bar">
        <div class="np-progress-line"><div class="np-progress-line-fill" id="np-progress-fill"></div></div>
        <div class="np-left">
          <img class="np-cover" id="np-cover" src="" alt="" onerror="this.style.display='none'" onload="this.style.display=''">
          <div class="np-info">
            <div class="np-title" id="np-title">No track</div>
            <div class="np-artist" id="np-artist"></div>
            <div class="np-album" id="np-album"></div>
          </div>
          <button class="star-btn np-star" id="np-bar-star" style="display:none" onclick="event.stopPropagation();toggleStar(this)" title="Love"></button>
        </div>
        <div class="np-center">
          <div class="np-controls">
            <button class="ctrl-btn" id="ctrl-shuffle" title="Shuffle">${icons.shuffle}</button>
            <button class="ctrl-btn" id="ctrl-prev" title="Previous">${icons.prev}</button>
            <button class="ctrl-btn ctrl-play" id="ctrl-play" title="Play/Pause"><span class="icon-wrap"><span class="icon-play">${icons.play}</span><span class="icon-pause">${icons.pause}</span></span></button>
            <button class="ctrl-btn" id="ctrl-next" title="Next">${icons.next}</button>
            <button class="ctrl-btn" id="ctrl-repeat" title="Repeat">${icons.repeat}</button>
          </div>
        </div>
        <div class="np-right">
          <div class="np-progress" id="np-progress-desktop">
            <span class="np-time" id="np-current">0:00</span>
            <span class="np-time np-remaining" id="np-remaining"></span>
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
        <div class="np-overlay-bg" id="np-overlay-bg"><img id="np-overlay-bg-img" alt=""></div>
        <div class="np-overlay-header">
          <button class="icon-btn" id="np-back-btn" aria-label="Close">${icons.back}</button>
          <span class="np-overlay-title-text" id="np-queue-pos">Now Playing</span>
          <div style="display:flex;gap:4px">
            <button class="icon-btn sleep-btn" id="np-sleep-btn" aria-label="Sleep Timer">${icons.clock}</button>
            <button class="icon-btn" id="np-pip-btn" aria-label="Picture in Picture" style="display:none">${icons.pip}</button>
            <button class="icon-btn" id="np-queue-btn" aria-label="Queue">${icons.queue}</button>
          </div>
        </div>
        <div class="sleep-popup" id="np-sleep-popup" style="display:none">
          <div class="sleep-popup-item" data-duration="15">15 minutes</div>
          <div class="sleep-popup-item" data-duration="30">30 minutes</div>
          <div class="sleep-popup-item" data-duration="60">1 hour</div>
          <div class="sleep-popup-item" data-duration="track">End of track</div>
          <div class="sleep-popup-item sleep-popup-off" data-duration="off">Off</div>
        </div>
        <div class="np-overlay-body">
          <div class="np-overlay-artwork">
            <img id="np-overlay-cover" src="" alt="">
          </div>
          <div class="np-overlay-queue" id="np-overlay-queue" style="display:none">
            <div class="track-list" id="np-queue-tracks"></div>
          </div>
          <div class="np-overlay-info">
            <div class="np-overlay-track" id="np-overlay-title">No track</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px">
              <div class="np-overlay-artist" id="np-overlay-artist"><a class="meta-link" id="np-overlay-artist-link"></a></div>
              <button class="star-btn overlay-star" id="np-overlay-star" style="display:none" onclick="toggleStar(this)" title="Love"></button>
            </div>
            <div class="np-overlay-album" id="np-overlay-album"><a class="meta-link" id="np-overlay-album-link"></a></div>
          </div>
          <div class="np-overlay-progress">
            <input type="range" class="progress-bar" id="np-overlay-progress" min="0" max="100" value="0">
            <div class="np-overlay-time-row">
              <span class="np-time" id="np-overlay-current">0:00</span>
              <span class="np-time np-remaining" id="np-overlay-remaining"></span>
              <span class="np-time" id="np-overlay-duration">0:00</span>
            </div>
          </div>
          <div class="np-overlay-controls">
            <button class="ctrl-btn" id="np-ctrl-shuffle" title="Shuffle">${icons.shuffle}</button>
            <button class="ctrl-btn" id="np-ctrl-prev" title="Previous">${icons.prev}</button>
            <button class="ctrl-btn ctrl-play" id="np-overlay-play" title="Play/Pause"><span class="icon-wrap"><span class="icon-play">${icons.play}</span><span class="icon-pause">${icons.pause}</span></span></button>
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
    const status = []
    status.push(navidrome.configured ? '\u2705 Navidrome' : '\u274C Navidrome')
    status.push(soulsync.configured ? '\u2705 SoulSync' : '\u274C SoulSync')
    const verHtml = window.AndroidBridge
      ? '<span style="color:inherit;text-decoration:none;cursor:pointer" onclick="AndroidBridge.openUrl(\'https://github.com/Boc86/fynix-player\')">v' + getAppVersion() + '</span>'
      : '<a href="https://github.com/Boc86/fynix-player" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">v' + getAppVersion() + '</a>'
    el.innerHTML = '<span>' + status.join(' | ') + '</span><span>' + verHtml + '</span>'
  }

  function getAppVersion() {
    return window.AndroidBridge?.getVersion?.() || '1.2.2'
  }

  // --- Offline Cache ---

  function _refreshCachedTracks() {
    if (!window.AndroidBridge) return
    try {
      const arr = JSON.parse(AndroidBridge.getCachedTracks())
      _cachedTracks = {}
      arr.forEach(t => { _cachedTracks[t.trackId] = t })
    } catch (_) {}
  }
  window._refreshCachedTracks = _refreshCachedTracks

  function _isCached(trackId) { return !!_cachedTracks[trackId] }

  function _getCachedUrl(trackId) {
    return _isCached(trackId) ? 'http://localhost:8080/api/cached/' + trackId : ''
  }

  function cacheTrack(track) {
    console.log('cacheTrack called: id=' + (track?.id || 'none') + ' caching=' + _cachingTracks[track?.id] + ' isCached=' + _isCached(track?.id))
    if (!window.AndroidBridge || _cachingTracks[track.id] || _isCached(track.id)) return
    _cachingTracks[track.id] = true
    let url = navidrome.streamUrl(track.id)
    url = url.replace(/format=[^&]+/, 'format=mp3')
    if (url.indexOf('format=') === -1) {
      url += (url.includes('?') ? '&' : '?') + 'format=mp3'
    }
    AndroidBridge.cacheTrack(
      track.id, url,
      track.title || track.name || '',
      track.artist || track.artist_name || track.albumArtist || '',
      track.albumName || track.album || '',
      track.duration || 0
    )
    const poll = setInterval(() => {
      try {
        if (AndroidBridge.isCached(track.id)) {
          clearInterval(poll)
          delete _cachingTracks[track.id]
          _refreshCachedTracks()
          ;(function(id) {
            const el = document.querySelector('.cache-btn[data-track-id="' + id + '"]')
            if (el) {
              el.classList.remove('caching')
              el.textContent = '\u2713'
              el.title = 'Cached'
              el.style.opacity = '1'
            }
          })(track.id)
        }
      } catch (_) {}
    }, 1000)
  }
  window.cacheTrack = cacheTrack

  function _onCacheBtnClick(e) {
    const btn = e.target.closest('.cache-btn')
    if (!btn || btn.classList.contains('caching')) return
    const trackId = btn.dataset.trackId
    if (!trackId) return
    if (_isCached(trackId) || btn.dataset.action === 'delete') {
      AndroidBridge.deleteCachedTrack(trackId)
      _refreshCachedTracks()
      _updateCacheUI()
      _renderCachedTracks()
      return
    }
    const track = {
      id: trackId,
      title: btn.dataset.title || '',
      artist: btn.dataset.artist || '',
      album: btn.dataset.album || '',
      duration: parseInt(btn.dataset.duration) || 0
    }
    cacheTrack(track)
  }

  function _cacheBtnHtml(trackId, title, artist, album, duration) {
    if (!window.AndroidBridge) return ''
    if (_cachingTracks[trackId]) return '<span class="cache-btn caching" title="Downloading...">\u23F3</span>'
    const cached = _isCached(trackId)
    const escapedTitle = escHtml(title || '')
    const escapedArtist = escHtml(artist || '')
    const escapedAlbum = escHtml(album || '')
    const dur = duration || 0
    return '<span class="cache-btn" data-track-id="' + trackId + '" data-title="' + escapedTitle + '" data-artist="' + escapedArtist + '" data-album="' + escapedAlbum + '" data-duration="' + dur + '" title="' + (cached ? 'Cached' : 'Cache for offline') + '" style="cursor:pointer;opacity:' + (cached ? '1' : '.5') + '">' + (cached ? '\u2713' : '\u2B07') + '</span>'
  }

  function _updateCacheUI() {
    $$('.cache-btn:not(.caching)').forEach(el => {
      const id = el.dataset.trackId
      if (!id) return
      const cached = _isCached(id)
      el.textContent = cached ? '\u2713' : '\u2B07'
      el.title = cached ? 'Cached' : 'Cache for offline'
      el.style.opacity = cached ? '1' : '.5'
    })
    const stats = $('#cache-stats')
    if (stats && window.AndroidBridge) {
      try {
        const s = JSON.parse(AndroidBridge.getCacheStats())
        const maxMb = parseInt(settings.load().max_cache_size_mb) || 500
        stats.textContent = s.count + ' tracks, ' + (s.sizeBytes / 1048576).toFixed(1) + ' MB / ' + maxMb + ' MB max'
      } catch (_) {}
    }
  }

  function _renderCachedTracks() {
    const list = $('#cached-tracks-list')
    if (!list) return
    const ids = Object.keys(_cachedTracks)
    if (!ids.length) {
      list.innerHTML = '<p class="settings-desc" style="margin-top:8px">No cached tracks yet. Tap the download icon next to a track to cache it.</p>'
      return
    }
    list.innerHTML = '<ul class="cached-tracks-list">' + ids.map(id => {
      const t = _cachedTracks[id]
      return '<li style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border-color)">' +
        '<span style="flex:1">' + escHtml(t.title) + ' — ' + escHtml(t.artist) + '</span>' +
        '<span style="font-size:.8em;opacity:.6">' + (t.fileSize ? (t.fileSize / 1048576).toFixed(1) + ' MB' : '') + '</span>' +
        '<span class="cache-btn" data-action="delete" data-track-id="' + id + '" title="Remove from cache" style="cursor:pointer;opacity:.7;font-size:1.1em">\u2716</span>' +
        '</li>'
    }).join('') + '</ul>'
  }

  function _bindCacheSizeSlider() {
    const slider = $('#s-max-cache')
    const valEl = $('#s-max-cache-val')
    if (!slider || !valEl) return
    slider.addEventListener('input', () => {
      valEl.textContent = slider.value + ' MB'
    })
    slider.addEventListener('change', () => {
      const mb = parseInt(slider.value) || 500
      settings.save({ max_cache_size_mb: String(mb) })
      if (window.AndroidBridge) {
        AndroidBridge.setCacheMaxSize(mb * 1048576)
        AndroidBridge.enforceCacheLimit()
      }
      _refreshCachedTracks()
      _updateCacheUI()
      _renderCachedTracks()
    })
  }

  // --- Custom Dropdown ---

  function _initKofi() {
    const container = $('#sidebar-kofi')
    if (!container) return
    container.innerHTML = '<a href="https://ko-fi.com/X5Q621P6WX" target="_blank" rel="noopener" onclick="if(window.AndroidBridge){AndroidBridge.openUrl(\'https://ko-fi.com/X5Q621P6WX\');return false}"><img height="32" style="border:0;height:32px;opacity:.8" src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" alt="Buy Me a Coffee at ko-fi.com"></a>'
  }

  function _customSelect(id, options, value, onChange) {
    const html = '<div class="custom-select" id="' + id + '">' +
      '<button class="custom-select-trigger" type="button">' +
        '<span class="custom-select-label">' + escHtml(options[value] || value || '') + '</span>' +
      '</button>' +
      '<div class="custom-select-popup">' +
        Object.entries(options).map(([k, v]) =>
          '<div class="custom-select-option' + (k === value ? ' selected' : '') + '" data-value="' + k + '">' + escHtml(v) + '</div>'
        ).join('') +
      '</div>' +
    '</div>'

    return html
  }

  function _bindCustomSelect(id, options, onChange) {
    const container = $('#' + id)
    if (!container) return
    const trigger = container.querySelector('.custom-select-trigger')
    const label = container.querySelector('.custom-select-label')
    const popup = container.querySelector('.custom-select-popup')

    function close() {
      container.classList.remove('open')
      popup.style.display = 'none'
      popup.style.top = ''
      popup.style.left = ''
      popup.style.width = ''
    }

    function positionPopup() {
      const rect = trigger.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const popupHeight = Math.min(popup.scrollHeight || 200, 240)
      popup.style.width = Math.max(rect.width, 140) + 'px'
      popup.style.left = rect.left + 'px'
      if (spaceBelow >= popupHeight + 8 || spaceBelow >= rect.top) {
        popup.style.top = (rect.bottom + 4) + 'px'
        popup.style.bottom = 'auto'
      } else {
        popup.style.top = 'auto'
        popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px'
      }
    }

    trigger.addEventListener('click', e => {
      e.stopPropagation()
      const opening = !container.classList.contains('open')
      close()
      if (opening) {
        container.classList.add('open')
        popup.style.display = 'block'
        positionPopup()
      }
    })

    popup.addEventListener('click', e => {
      const opt = e.target.closest('.custom-select-option')
      if (!opt) return
      const val = opt.dataset.value
      container.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o.dataset.value === val))
      label.textContent = options[val]
      close()
      if (onChange) onChange(val)
    })

    document.addEventListener('click', close, { capture: true })

    // Reposition on scroll/resize
    const scrollable = container.closest('.main-content')
    if (scrollable) {
      scrollable.addEventListener('scroll', () => {
        if (container.classList.contains('open')) positionPopup()
      })
    }
    window.addEventListener('resize', () => {
      if (container.classList.contains('open')) positionPopup()
    })
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

    const prevViewEl = $(`#view-${previousView}`)
    if (prevViewEl && previousView) {
      prevViewEl.classList.add('view-fade-out')
      setTimeout(() => prevViewEl.classList.remove('view-fade-out'), 150)
    }

    $$('.view').forEach(v => v.classList.add('hidden'))
    const target = $(`#view-${view}`)
    if (target) {
      target.classList.remove('hidden')
      target.classList.remove('view-fade-in')
      // Force reflow
      void target.offsetWidth
      target.classList.add('view-fade-in')
    }
    $('#sidebar').classList.remove('open')
    $('#sidebar-backdrop')?.classList.remove('show')

    const titles = { home: 'Home', search: 'Search', albums: 'Library', artists: 'Artists', queue: 'Queue', playlists: 'Playlists', settings: 'Settings', genres: 'Genres', 'genre-tracks': 'Genre' }
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
      case 'genres': renderGenres(); break
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

  window.goBack = function () {
    const np = $('#now-playing-screen')
    if (np && !np.classList.contains('hidden') && np.classList.contains('open')) {
      hideNowPlaying()
      return
    }
    const sidebar = $('#sidebar')
    if (sidebar?.classList.contains('open')) {
      sidebar.classList.remove('open')
      $('#sidebar-backdrop')?.classList.remove('show')
      return
    }
    const tour = $('#tour-overlay')
    if (tour && tour.style.display !== 'none') {
      $('#tour-highlight')?.style ? ($('#tour-highlight').style.display = 'none') : null
      $('#tour-tooltip')?.style ? ($('#tour-tooltip').style.display = 'none') : null
      tour.style.display = 'none'
      navigate('home')
      return
    }
    const wizard = $('#wizard-overlay')
    if (wizard && !wizard.classList.contains('hidden')) {
      wizard.classList.add('hidden')
      return
    }
    const prev = previousView || 'home'
    navigate(prev === currentView ? 'home' : prev)
  }

  function updateNowPlaying() {
    const state = player.getState()
    const t = state.currentTrack
    const el = $('#now-playing-screen')
    if (!t) return
    const displayDur = state.duration || state.trackDuration || 0
    const artistName = [...new Set([t.artist, t.artist_name, t.albumArtist].filter(Boolean))].join(' · ')
    const albumName = t.albumName || t.album || ''
    const artistId = t.artistId || ''
    const albumId = t.albumId || ''

    $('#np-overlay-cover').src = t.coverUrl || ''
    $('#np-overlay-title').textContent = t.title || t.name || 'Unknown'

    const al = $('#np-overlay-artist-link')
    if (al) {
      al.textContent = artistName
      al.onclick = () => showArtistFromNowPlaying()
    }

    const abl = $('#np-overlay-album-link')
    if (abl) {
      abl.textContent = albumName
      abl.onclick = () => showAlbumFromNowPlaying()
    }

    $('#np-overlay-play').classList.toggle('is-playing', state.playing)
    $('#np-overlay-progress').value = displayDur ? (state.currentTime / displayDur) * 100 : 0
    $('#np-overlay-current').textContent = player.formatTime(state.currentTime)
    $('#np-overlay-duration').textContent = player.formatTime(displayDur)
    $('#np-overlay-volume').value = state.volume
    $('#np-ctrl-shuffle').style.opacity = state.shuffle ? '1' : '0.4'
    $('#np-ctrl-repeat').style.opacity = state.repeat ? '1' : '0.4'

    const nab = $('#np-album')
    if (nab) {
      nab.innerHTML = albumName ? `<a class="meta-link" onclick="event.stopPropagation();showAlbumFromNowPlaying()">${escHtml(albumName)}</a>` : ''
    }
    const na = $('#np-artist')
    if (na) {
      na.innerHTML = artistName ? `<a class="meta-link" onclick="event.stopPropagation();showArtistFromNowPlaying()">${escHtml(artistName)}</a>` : ''
    }
    // Background image
    const bgImg = document.getElementById('np-overlay-bg-img')
    if (bgImg) bgImg.src = t.coverUrl || ''
    // Overlay star
    const overlayStar = document.getElementById('np-overlay-star')
    if (overlayStar) {
      if (t.id) {
        overlayStar.style.display = ''
        const starred = !!t.starred
        overlayStar.dataset.id = t.id
        overlayStar.dataset.starred = starred
        overlayStar.classList.toggle('starred', starred)
        overlayStar.innerHTML = icons[starred ? 'heartFilled' : 'heart']
      } else {
        overlayStar.style.display = 'none'
      }
    }

    // Queue position
    const qp = $('#np-queue-pos')
    if (qp) {
      const total = state.queue.length
      qp.textContent = total > 0 ? `${state.currentIndex + 1} / ${total}` : 'Now Playing'
    }
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
      const [newestRes, recentRes, randomRes, frequentRes, artistsRes] = await Promise.all([
        navidrome.getAlbumList2('newest', 24).catch(() => null),
        navidrome.getAlbumList2('recent', 12).catch(() => null),
        navidrome.getAlbumList2('random', 12).catch(() => null),
        navidrome.getAlbumList2('frequent', 12).catch(() => null),
        navidrome.getArtists().catch(() => null)
      ])
      const newest = newestRes?.albumList2?.album || []
      const recent = recentRes?.albumList2?.album || []
      const random = randomRes?.albumList2?.album || []
      const frequent = frequentRes?.albumList2?.album || []
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
        html += `<h3 class="section-title">New Releases</h3><div class="album-grid section-scroll">${newest.map(a => albumCard(a)).join('')}</div>`
      }

      if (recent.length) {
        html += `<h3 class="section-title">Recently Played</h3><div class="album-grid section-scroll">${recent.map(a => albumCard(a)).join('')}</div>`
      }

      if (frequent.length) {
        html += `<h3 class="section-title">Most Played</h3><div class="album-grid section-scroll">${frequent.map(a => albumCard(a)).join('')}</div>`
      }

      if (random.length) {
        html += `<h3 class="section-title">Random Albums</h3><div class="album-grid section-scroll">${random.map(a => albumCard(a)).join('')}</div>`
      }

      if (!newest.length && !recent.length) {
        html = '<div class="empty-state">No albums found in your library.</div>'
      }

      el.innerHTML = html
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  async function renderGenres() {
    const el = $('#view-genres')
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'
    try {
      const resp = await navidrome.getGenres()
      const genres = resp?.genres?.genre || []
      _allGenres = genres
      if (!genres.length) { el.innerHTML = '<div class="empty-state">No genres available</div>'; return }
      el.innerHTML = `
        <h3 class="section-title">Genres</h3>
        <div class="genre-grid">${genres.map(g => `
          <div class="genre-chip" onclick="showGenreTracks('${escHtml(g.value || g.name || '').replace(/'/g, "\\'")}')">
            <span class="genre-name">${escHtml(g.value || g.name || 'Unknown')}</span>
            <span class="genre-count">${g.songCount || 0} songs</span>
          </div>
        `).join('')}</div>
      `
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  window.showGenreTracks = async function (genre) {
    navigate('genre-tracks')
    const el = $('#view-genre-tracks')
    el.innerHTML = `<div class="loading"><div class="loading-spinner"></div> Loading...</div>`
    try {
      const resp = await navidrome.getSongsByGenre(genre, 200)
      const songs = resp?.songsByGenre?.song || []
      if (!songs.length) { el.innerHTML = '<div class="empty-state">No songs found in this genre</div>'; return }
      const tracks = songs.map(s => ({
        ...s, streamUrl: navidrome.streamUrl(s.id),
        coverUrl: navidrome.coverUrl(s.id, 100),
        albumName: s.album || '', albumArtist: s.artist || ''
      }))
      window._libraryTracks = tracks
      el.innerHTML = `
        <div class="library-header">
          <h3 class="section-title">${escHtml(genre)}</h3>
          <div class="library-actions">
            <button class="btn btn-primary btn-sm" onclick="playAll()">${icons.play} Play All</button>
            <button class="btn btn-secondary btn-sm" onclick="shufflePlay()">${icons.shuffle} Shuffle</button>
            <button class="btn btn-sm" onclick="navigate('genres')">${icons.back} Back</button>
          </div>
        </div>
        <div class="track-list">${tracks.map((t, i) => `
          <div class="track-row" onclick="playLibraryTrack(${i})"${_ctxAttr(t)}>
            <span class="track-num">${i + 1}</span>
            <div class="track-info">
              <div class="track-name">${escHtml(t.title)}</div>
              <div class="track-artist"><a class="meta-link" onclick="event.stopPropagation();showArtist(null,'${escHtml(t.artist || '').replace(/'/g, "\\'")}')">${escHtml(t.artist || '')}</a> · <a class="meta-link" onclick="event.stopPropagation();showAlbum(null,'${escHtml(t.album || '').replace(/'/g, "\\'")}','${escHtml(t.artist || '').replace(/'/g, "\\'")}')">${escHtml(t.album || '')}</a></div>
            </div>
            ${_starBtnHtml(t.id, !!t.starred)}
            ${_cacheBtnHtml(t.id, t.title, t.artist || t.albumArtist, t.album || t.albumName, t.duration)}
            <span class="track-duration">${player.formatTime(t.duration)}</span>
          </div>`).join('')}</div>
      `
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
        <div class="library-controls">
          <input type="text" class="input library-search" id="library-search" placeholder="Filter library..." autocomplete="off">
          <select class="input library-sort" id="library-sort">
            <option value="name" ${libraryState.sortBy === 'name' ? 'selected' : ''}>Name</option>
            <option value="artist" ${libraryState.sortBy === 'artist' ? 'selected' : ''}>Artist</option>
            <option value="year" ${libraryState.sortBy === 'year' ? 'selected' : ''}>Year</option>
            <option value="recent" ${libraryState.sortBy === 'recent' ? 'selected' : ''}>Recently Added</option>
          </select>
        </div>
      </div>
      <div class="library-content" id="library-content">
        <div class="loading"><div class="loading-spinner"></div> Loading...</div>
      </div>
    `

    bindLibraryTabs()
    bindLibrarySearch()
    bindLibrarySort()
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

  function bindLibrarySort() {
    const sel = $('#library-sort')
    if (!sel) return
    sel.addEventListener('change', () => {
      libraryState.sortBy = sel.value
      renderLibraryContent()
    })
  }

  async function loadLibraryTab() {
    const content = $('#library-content')
    const skelType = libraryState.tab === 'tracks' ? 'tracks' : libraryState.tab === 'artists' ? 'artists' : 'albums'
    content.innerHTML = `<div class="${skelType === 'tracks' ? 'skel-list' : 'skel-grid'}">${_renderSkeletons(skelType)}</div>`

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

  const BATCH_SIZE = 30
  let _libObserver = null

  function renderLibraryContent() {
    const content = $('#library-content')
    if (!content) return
    const q = libraryState.search.toLowerCase()

    let items, emptyMsg
    switch (libraryState.tab) {
      case 'albums': {
        items = (libraryState.albums || []).filter(a =>
          !q || (a.name || '').toLowerCase().includes(q) ||
               (a.artist || '').toLowerCase().includes(q)
        )
        emptyMsg = q ? 'No matching albums' : 'No albums found'
        break
      }
      case 'artists': {
        items = (libraryState.artists || []).filter(a =>
          !q || (a.name || '').toLowerCase().includes(q)
        )
        emptyMsg = q ? 'No matching artists' : 'No artists found'
        break
      }
      case 'tracks': {
        items = (libraryState.tracks || []).filter(t =>
          !q || (t.title || '').toLowerCase().includes(q) ||
               (t.artist || '').toLowerCase().includes(q) ||
               (t.album || '').toLowerCase().includes(q)
        )
        const songsWithStream = items.map(s => ({
          ...s,
          streamUrl: navidrome.streamUrl(s.id),
          coverUrl: navidrome.coverUrl(s.id, 100),
          albumName: s.album || '',
          albumArtist: s.artist || ''
        }))
        window._libraryTracks = songsWithStream
        emptyMsg = q ? 'No matching tracks' : 'No tracks found'
        break
      }
    }

    if (!items || !items.length) {
      content.innerHTML = `<div class="empty-state">${emptyMsg}</div>`
      return
    }

    const sortBy = libraryState.sortBy
    if (sortBy && sortBy !== 'name') {
      items = [...items].sort((a, b) => {
        if (sortBy === 'artist') return (a.artist || '').localeCompare(b.artist || '')
        if (sortBy === 'year') return (a.year || 0) - (b.year || 0)
        if (sortBy === 'recent') return new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0)
        return 0
      })
    }

    window._libItems = items
    window._libPage = 0
    _renderLibraryPage()
  }

  function _renderLibraryPage() {
    const content = $('#library-content')
    const items = window._libItems || []
    const page = window._libPage || 0
    const end = Math.min((page + 1) * BATCH_SIZE, items.length)
    const slice = items.slice(0, end)
    const hasMore = end < items.length

    if (_libObserver) { _libObserver.disconnect(); _libObserver = null }

    switch (libraryState.tab) {
      case 'albums':
        content.innerHTML = `<div class="album-grid">${slice.map(a => albumCard(a)).join('')}</div>`
        break
      case 'artists':
        content.innerHTML = `<div class="artist-grid">${slice.map(a => {
          const cover = navidrome.coverUrl(a.id, 160)
          return `
          <div class="artist-card" onclick="showArtist('${a.id}','${escHtml(a.name).replace(/'/g, "\\'")}')">
            <img class="artist-cover-img" src="${cover}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="artist-cover" style="display:none">${escHtml(a.name.charAt(0).toUpperCase())}</div>
            <div class="artist-name">${escHtml(a.name)}</div>
            <div class="artist-count">${a.albumCount} albums</div>
          </div>`
        }).join('')}</div>`
        break
      case 'tracks':
        content.innerHTML = `
          <div class="track-list">${slice.map((t, i) => `
            <div class="track-row" onclick="playLibraryTrack(${i})"${_ctxAttr(t)}>
              <span class="track-num">${i + 1}</span>
              <div class="track-info">
                <div class="track-name">${escHtml(t.title)}</div>
                <div class="track-artist"><a class="meta-link" onclick="event.stopPropagation();showArtist(null,'${escHtml(t.artist || '').replace(/'/g, "\\'")}')">${escHtml(t.artist || '')}</a> · <a class="meta-link" onclick="event.stopPropagation();showAlbum(null,'${escHtml(t.album || '').replace(/'/g, "\\'")}','${escHtml(t.artist || '').replace(/'/g, "\\'")}')">${escHtml(t.album || '')}</a></div>
              </div>
              ${_starBtnHtml(t.id, !!t.starred)}
              ${_cacheBtnHtml(t.id, t.title, t.artist || t.artist_name || t.albumArtist, t.album || t.albumName, t.duration)}
              <span class="track-duration">${player.formatTime(t.duration)}</span>
            </div>
          `).join('')}</div>`
        break
    }

    if (hasMore) {
      const sentinel = document.createElement('div')
      sentinel.className = 'lib-sentinel'
      sentinel.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>'
      content.appendChild(sentinel)
      _libObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          window._libPage++
          _renderLibraryPage()
        }
      }, { rootMargin: '300px' })
      _libObserver.observe(sentinel)
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

  async function showArtist(id, artistName) {
    previousView = currentView
    currentView = 'artists'
    $$('.view').forEach(v => v.classList.add('hidden'))
    const el = $('#view-artists')
    el.classList.remove('hidden')
    el.innerHTML = _renderSkeletons('artists')

    let artist, albums
    let found = false

    if (id) {
      try {
        const resp = await navidrome.getArtist(id)
        artist = resp?.artist
        if (artist) {
          albums = artist?.album || []
          artistName = artist.name
          found = true
        }
      } catch {}
    }

    if (!found && artistName) {
      try {
        const searchResp = await navidrome.search3(artistName, 5, 0, 0)
        const matches = searchResp?.searchResult3?.artist || []
        const match = matches.find(a =>
          a.name?.toLowerCase() === artistName.toLowerCase()
        ) || matches[0]
        if (match) {
          id = match.id
          const resp = await navidrome.getArtist(id)
          artist = resp?.artist
          if (artist) {
            albums = artist?.album || []
            artistName = artist.name
            found = true
          }
        }
      } catch {}
    }

    const cover = id ? navidrome.coverUrl(id, 300) : (albums?.[0] ? navidrome.coverUrl(albums[0].id, 300) : '')

    const mbid = artist?.musicBrainzId || ''
    const mb = await _fetchMBInfo(artistName || '', mbid)

    const hasBio = mb?.wikiTitle || (artistName && !mb?.wikiTitle)
    const tagsHtml = mb?.tags?.length
      ? `<div class="artist-tags">${mb.tags.map(t =>
          `<span class="tag">${escHtml(t)}</span>`
        ).join('')}</div>`
      : ''

    let html = `
      <button class="btn-back" onclick="renderArtists()">${icons.back} Back</button>
      <div class="artist-detail">
        <div class="artist-detail-header">
          <img class="artist-detail-img" src="${cover}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="artist-cover artist-cover-lg" style="display:${cover ? 'none' : 'flex'}">${(artistName || '?').charAt(0).toUpperCase()}</div>
          <div class="artist-detail-info">
            <h2>${escHtml(artistName || 'Unknown')}</h2>
            <p>${found ? `${artist?.albumCount || albums?.length || 0} albums` : 'Unknown'}${mb?.country ? ` · ${mb.country}` : ''}${mb?.begin ? ` · ${mb.begin}${mb?.end ? `-${mb.end}` : ''}` : ''}</p>
            ${tagsHtml}
          </div>
        </div>
    `

    if (hasBio) {
      html += `<button class="btn-bio" onclick="showBioModal('${escHtml(artistName || '').replace(/'/g, "\\'")}')">${icons.info} Bio</button>`
    }
    if (artistName) {
      html += `<button class="btn-bio btn-bio--alt" onclick="searchDiscography('${escHtml(artistName || '').replace(/'/g, "\\'")}')">${icons.search} Discography</button>`
    }

    if (found && albums?.length) {
      html += `
        <h3 class="section-title">Albums</h3>
        <div class="album-grid">${albums.map(a => `
          <div class="album-card" onclick="showAlbum('${a.id}')">
            <div class="album-art">
              <img src="${navidrome.coverUrl(a.id, 300)}" alt="${escHtml(a.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23333%22 width=%22300%22 height=%22300%22/><text fill=%22%23999%22 font-size=%2280%22 x=%22150%22 y=%22170%22 text-anchor=%22middle%22 font-family=%22monospace%22>&#x266C;</text></svg>'">
              <div class="album-play-overlay">${icons.play}</div>
            </div>
            <div class="album-name">${escHtml(a.name)}</div>
            <div class="album-artist">${escHtml(a.artist || '')}</div>
            ${a.year ? `<div class="album-year">${a.year}</div>` : ''}
          </div>
        `).join('')}</div>
      `
    } else {
      html += `<div class="empty-state">No albums found for this artist in library.</div>`
    }

    html += `</div>`
    el.innerHTML = html
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

  const _mbCache = {}
  const _wikiCache = {}

  async function _fetchMBInfo(artistName, mbid) {
    if (!artistName && !mbid) return null
    const key = mbid || artistName.toLowerCase().trim()
    if (_mbCache[key] !== undefined) return _mbCache[key]

    try {
      let id = mbid
      if (!id) {
        const searchUrl = `https://musicbrainz.org/ws/2/artist/?query=artist:${encodeURIComponent(artistName)}&fmt=json`
        const sr = await fetch(searchUrl, { headers: { 'User-Agent': 'FynixPlayer/0.2.1 (boc86@users.noreply.github.com)' } })
        if (!sr.ok) { _mbCache[key] = null; return null }
        const sd = await sr.json()
        id = sd?.artists?.[0]?.id
        if (!id) { _mbCache[key] = null; return null }
      }

      const detailUrl = `https://musicbrainz.org/ws/2/artist/${id}?inc=tags+url-rels&fmt=json`
      const dr = await fetch(detailUrl, { headers: { 'User-Agent': 'FynixPlayer/0.2.1 (boc86@users.noreply.github.com)' } })
      if (!dr.ok) { _mbCache[key] = null; return null }
      const dd = await dr.json()

      const rels = dd?.relations || []
      let wikiTitle = ''

      const wikiRel = rels.find(r => r.type === 'wikipedia' && r.url?.resource?.includes('wikipedia.org'))
      if (wikiRel?.url?.resource) {
        wikiTitle = wikiRel.url.resource.split('/wiki/').pop()
      }

      if (!wikiTitle) {
        const wikidataRel = rels.find(r => r.type === 'wikidata' && r.url?.resource?.includes('wikidata.org'))
        if (wikidataRel?.url?.resource) {
          try {
            const wdId = wikidataRel.url.resource.split('/wiki/').pop() || wikidataRel.url.resource.split('/').pop()
            const wdUrl = `https://www.wikidata.org/wiki/Special:EntityData/${wdId}.json`
            const wdr = await fetch(wdUrl)
            if (wdr.ok) {
              const wdd = await wdr.json()
              const entity = wdd?.entities?.[wdId]
              wikiTitle = entity?.sitelinks?.enwiki?.title || ''
            }
          } catch {}
        }
      }

      const result = {
        mbid: id,
        tags: (dd?.tags || []).slice(0, 8).map(t => t.name),
        type: dd?.type || '',
        country: dd?.country || '',
        begin: dd?.['life-span']?.begin || '',
        end: dd?.['life-span']?.end || '',
        wikiTitle
      }
      _mbCache[key] = result
      return result
    } catch {
      _mbCache[key] = null
      return null
    }
  }

  async function _fetchWikipediaData(wikiTitle, artistName) {
    const lookupName = artistName ? artistName.split(' · ')[0] : ''
    const cacheKey = wikiTitle || lookupName.toLowerCase().trim()
    if (_wikiCache[cacheKey]) return _wikiCache[cacheKey]

    if (!wikiTitle && lookupName) {
      const mbEntry = _mbCache[lookupName.toLowerCase().trim()]
      if (mbEntry?.wikiTitle) wikiTitle = mbEntry.wikiTitle
    }

    let title = wikiTitle
    let bio = ''
    let thumbnail = ''

    if (title) {
      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(decodeURIComponent(title))}`
        const r = await fetch(url)
        if (r.ok) {
          const d = await r.json()
          bio = d?.extract || ''
          thumbnail = d?.thumbnail?.source || ''
        }
      } catch {}
    }

    if (!bio && lookupName) {
      try {
        const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(lookupName)}`
        const wr = await fetch(searchUrl)
        if (wr.ok) {
          const wd = await wr.json()
          if (wd?.title && wd?.extract) {
            const titleLower = wd.title.toLowerCase()
            const nameLower = lookupName.toLowerCase()
            if (titleLower.includes(nameLower) || nameLower.includes(titleLower)) {
              bio = wd.extract
              thumbnail = wd?.thumbnail?.source || ''
              if (!title) title = wd.title
            }
          }
        }
      } catch {}
    }

    const result = { bio, thumbnail, wikiTitle: title }
    _wikiCache[cacheKey] = result
    if (wikiTitle && lookupName) _wikiCache[lookupName.toLowerCase().trim()] = result
    if (!wikiTitle && lookupName && title) _wikiCache[title.toLowerCase().trim()] = result
    return result
  }

  function _extractColors(imgSrc) {
    if (!imgSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 50; c.height = 50
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0, 50, 50)
        const d = ctx.getImageData(0, 0, 50, 50).data
        const freq = {}
        for (let i = 0; i < d.length; i += 4) {
          const r = Math.round(d[i] / 32) * 32
          const g = Math.round(d[i+1] / 32) * 32
          const b = Math.round(d[i+2] / 32) * 32
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          if (lum < 30 || lum > 700) continue
          const key = `${r},${g},${b}`
          freq[key] = (freq[key] || 0) + 1
        }
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
        if (!sorted.length) return
        const [r, g, b] = sorted[0][0].split(',').map(Number)
        document.documentElement.style.setProperty('--accent', `rgb(${r},${g},${b})`)
        document.documentElement.style.setProperty('--accent-rgb', `${r},${g},${b}`)
        document.documentElement.style.setProperty('--accent-dim', `rgba(${r},${g},${b},0.15)`)
        document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.35)`)
      } catch {}
    }
    img.src = imgSrc
  }

  function _renderSkeletons(type) {
    const n = 12
    if (type === 'tracks') {
      return `<div class="skel-list">${Array(n).fill('<div class="skel-track"><div class="skel-track-num"></div><div class="skel-track-line"></div><div class="skel-track-dur"></div></div>').join('')}</div>`
    }
    if (type === 'artists') {
      return `<div class="skel-grid">${Array(n).fill('<div class="skel-card"><div class="skel-artist-img"></div><div class="skel-line" style="margin:0 auto;width:60%"></div></div>').join('')}</div>`
    }
    return `<div class="skel-grid">${Array(n).fill('<div class="skel-card"><div class="skel-img"></div><div class="skel-line"></div><div class="skel-line-sm"></div></div>').join('')}</div>`
  }

  function _starBtnHtml(songId, starred) {
    const filled = starred ? 'heartFilled' : 'heart'
    return `<button class="star-btn${starred ? ' starred' : ''}" data-starred="${!!starred}" data-id="${escHtml(songId)}" onclick="event.stopPropagation();toggleStar(this)" title="Love">${icons[filled]}</button>`
  }

  window.toggleStar = function(btn) {
    const id = btn.dataset.id
    const was = btn.dataset.starred === 'true'
    const next = !was
    if (next) {
      navidrome.star(id).catch(() => {})
    } else {
      navidrome.unstar(id).catch(() => {})
    }
    btn.dataset.starred = next
    btn.classList.toggle('starred', next)
    btn.innerHTML = icons[next ? 'heartFilled' : 'heart']
  }

  async function showAlbum(id, albumName, artistName) {
    albumHistoryView = currentView
    const el = $('#view-albums')
    el.classList.remove('hidden')
    $('#view-home')?.classList.add('hidden')
    $('#view-artists')?.classList.add('hidden')
    el.innerHTML = _renderSkeletons('albums')

    let album, songs, cover
    let found = false

    if (id) {
      try {
        const resp = await navidrome.getAlbum(id)
        album = resp?.album
        if (album) {
          songs = album?.song || []
          cover = navidrome.coverUrl(album.id, 400)
          albumName = album.name
          artistName = album.artist
          found = true
        }
      } catch {}
    }

    if (!found && albumName && artistName) {
      try {
        const searchResp = await navidrome.search3(`${albumName} ${artistName}`, 0, 5, 0)
        const matches = searchResp?.searchResult3?.album || []
        const match = matches.find(a =>
          a.name?.toLowerCase() === albumName.toLowerCase() &&
          a.artist?.toLowerCase().includes(artistName.toLowerCase())
        ) || matches[0]
        if (match) {
          id = match.id
          const resp = await navidrome.getAlbum(id)
          album = resp?.album
          if (album) {
            songs = album?.song || []
            cover = navidrome.coverUrl(album.id, 400)
            albumName = album.name
            artistName = album.artist
            found = true
          }
        }
      } catch {}
    }

    const backTarget = albumHistoryView === 'home' ? 'home' : albumHistoryView === 'artists' ? 'artists' : 'albums'

    if (!found) {
      el.innerHTML = `
        <button class="btn-back" onclick="albumBack()">${icons.back} Back</button>
        <div class="album-detail">
          <div class="album-detail-info" style="padding:24px 0">
            <h1>${escHtml(albumName || 'Unknown Album')}</h1>
            <p class="album-detail-artist" style="cursor:pointer;color:var(--primary)" onclick="showArtist(null,'${escHtml(artistName || '').replace(/'/g, "\\'")}')">${escHtml(artistName || '')}</p>
          </div>
        </div>
      `
      return
    }

    const tracksHtml = songs.map((s, i) => `
      <div class="track-row" onclick="playTrackFromAlbum(${i})"${_ctxAttr(s)}>
        <span class="track-num">${s.track || i + 1}</span>
        <div class="track-info">
          <div class="track-name">${escHtml(s.title)}</div>
          <div class="track-artist"><a class="meta-link" onclick="event.stopPropagation();showArtist('${escHtml(s.artistId || '')}','${escHtml(s.artist || album.artist || '').replace(/'/g, "\\'")}')">${escHtml(s.artist || album.artist || '')}</a></div>
        </div>
        ${_starBtnHtml(s.id, !!s.starred)}
        ${_cacheBtnHtml(s.id, s.title, s.artist || album.artist, album.name, s.duration)}
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

    const artistEscaped = escHtml(artistName || '').replace(/'/g, "\\'")
    const artistId = album.artistId || ''

    el.innerHTML = `
      <button class="btn-back" onclick="albumBack()">${icons.back} Back</button>
      <div class="album-detail">
        <div class="album-detail-header">
          <img class="album-detail-cover" src="${cover}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23333%22 width=%22300%22 height=%22300%22/><text fill=%22%23999%22 font-size=%2280%22 x=%22150%22 y=%22170%22 text-anchor=%22middle%22 font-family=%22monospace%22>&#x266C;</text></svg>'">
          <div class="album-detail-info">
            <h1>${escHtml(albumName)}</h1>
            <p class="album-detail-artist"><a class="meta-link" onclick="showArtist('${artistId}','${artistEscaped}')">${escHtml(artistName || '')}</a></p>
            <p class="album-detail-meta">${metaParts.join(' · ')}</p>
            <div class="album-detail-actions">
              <button class="btn btn-primary" onclick="playAll()">${icons.play} Play All</button>
            </div>
          </div>
        </div>
        <div class="track-list">${tracksHtml}</div>
      </div>
    `
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
    const songs = window._currentAlbumSongs?.length ? window._currentAlbumSongs : (window._libraryTracks || [])
    if (songs.length) player.playQueue(songs, 0)
  }

  window.shufflePlay = function () {
    const songs = window._currentAlbumSongs?.length ? window._currentAlbumSongs : (window._libraryTracks || [])
    if (songs.length) {
      const idx = Math.floor(Math.random() * songs.length)
      player.playQueue(songs, idx)
    }
  }

  window.playMediaId = async function (songId, parentType, parentId) {
    console.log('playMediaId start: songId=' + songId + ' type=' + parentType + ' pid=' + parentId + ' player=' + (typeof player) + ' navidrome=' + (typeof navidrome));
    try {
      if (parentType === 'album' && parentId) {
        console.log('playMediaId: loading album ' + parentId);
        const resp = await navidrome.getAlbum(parentId)
        const album = resp?.album
        const songs = (album?.song || []).map(s => ({
          ...s,
          streamUrl: navidrome.streamUrl(s.id),
          coverUrl: navidrome.coverUrl(s.id, 300),
          albumName: album.name,
          albumArtist: album.artist
        }))
        const idx = songs.findIndex(s => s.id === songId)
        console.log('playMediaId: songs=' + songs.length + ' idx=' + idx + ' firstUrl=' + (songs[0]?.streamUrl || 'none'));
        try {
          player.playQueue(songs, idx >= 0 ? idx : 0)
          console.log('playMediaId: playQueue OK');
        } catch(e) { console.error('playMediaId: playQueue threw', e); }
      } else if (parentType === 'playlist' && parentId) {
        console.log('playMediaId: loading playlist ' + parentId);
        const resp = await navidrome.getPlaylist(parentId)
        const entries = resp?.playlist?.entry || []
        const songs = entries.map(s => ({
          ...s,
          streamUrl: navidrome.streamUrl(s.id),
          coverUrl: navidrome.coverUrl(s.id, 300)
        }))
        const idx = songs.findIndex(s => s.id === songId)
        console.log('playMediaId: songs=' + songs.length + ' idx=' + idx);
        try {
          player.playQueue(songs, idx >= 0 ? idx : 0)
          console.log('playMediaId: playQueue OK');
        } catch(e) { console.error('playMediaId: playQueue threw', e); }
      } else if (songId) {
        console.log('playMediaId: playing single song ' + songId);
        const resp = await navidrome.getSong(songId)
        const song = resp?.song
        if (song) {
          player.playQueue([{
            ...song,
            streamUrl: navidrome.streamUrl(song.id),
            coverUrl: navidrome.coverUrl(song.id, 300)
          }], 0)
        } else {
          player.playQueue([{ id: songId, streamUrl: navidrome.streamUrl(songId) }], 0)
        }
        console.log('playMediaId: playQueue OK');
      }
    } catch (e) {
      console.error('playMediaId error', e)
    }
    console.log('playMediaId: done');
  }

  window.shuffleAll = async function () {
    console.log('shuffleAll: fetching albums');
    try {
      let allAlbums = [];
      let offset = 0;
      const pageSize = 50;
      while (true) {
        const resp = await navidrome.getAlbumList2('newest', pageSize, offset);
        const albums = resp?.albumList2?.album || [];
        if (albums.length === 0) break;
        allAlbums = allAlbums.concat(albums);
        if (albums.length < pageSize || allAlbums.length >= 100) break;
        offset += pageSize;
      }
      console.log('shuffleAll: fetching songs from', allAlbums.length, 'albums');
      const results = await Promise.all(
        allAlbums.map(a =>
          navidrome.getAlbum(a.id)
            .then(resp => {
              const album = resp?.album;
              if (!album || !album.song) return [];
              return album.song.map(s => ({
                ...s,
                streamUrl: navidrome.streamUrl(s.id),
                coverUrl: navidrome.coverUrl(s.id, 300),
                albumName: album.name,
                albumArtist: album.artist
              }));
            })
            .catch(() => [])
        )
      );
      let allSongs = [];
      for (const songs of results) {
        allSongs = allSongs.concat(songs);
      }
      if (allSongs.length === 0) {
        console.log('shuffleAll: no songs');
        return;
      }
      for (let i = allSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSongs[i], allSongs[j]] = [allSongs[j], allSongs[i]];
      }
      console.log('shuffleAll: playing', allSongs.length, 'songs');
      player.playQueue(allSongs, 0);
    } catch (e) {
      console.error('shuffleAll error', e);
    }
  };

  window.renderArtists = renderArtists
  window.renderAlbums = renderAlbums
  window.renderHome = renderHome
  window.showArtist = showArtist
  window.showAlbum = showAlbum
  window.showArtistFromNowPlaying = function () {
    const t = player.getState().currentTrack
    if (!t) return
    const id = t.artistId || null
    const name = t.artist || t.artist_name || t.albumArtist || ''
    hideNowPlaying()
    showArtist(id, name)
  }
  window.showAlbumFromNowPlaying = function () {
    const t = player.getState().currentTrack
    if (!t) return
    const id = t.albumId || null
    const name = t.albumName || t.album || ''
    const artist = t.artist || t.artist_name || ''
    hideNowPlaying()
    showAlbum(id, name, artist)
  }
  window.navigate = navigate
  window.showNowPlaying = showNowPlaying
  window.hideNowPlaying = hideNowPlaying
  window.albumBack = albumBack
  window.playTrackFromAlbum = playTrackFromAlbum
  window.playAll = playAll
  window.showBioModal = showBioModal
  window.closeBioModal = closeBioModal

  function showBioModal(artistName) {
    const modal = document.getElementById('bio-modal')
    if (!modal) return
    const titleEl = modal.querySelector('.bio-modal-title')
    const textEl = modal.querySelector('.bio-modal-text')
    if (titleEl) titleEl.textContent = artistName ? `About ${artistName}` : 'About'
    if (textEl) textEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading bio...</div>'
    modal.classList.add('bio-modal--open')

    _fetchWikipediaData('', artistName || '').then(wd => {
      if (textEl) textEl.innerHTML = wd?.bio
        ? wd.bio.split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p>${escHtml(p)}</p>`).join('')
        : '<p>No biography available.</p>'
    })
  }

  function closeBioModal() {
    const modal = document.getElementById('bio-modal')
    if (modal) modal.classList.remove('bio-modal--open')
  }

  /* === Context Menu === */
  let _ctxTrack = null

  window.openContextMenu = function (track, event) {
    event?.stopPropagation()
    _ctxTrack = track
    const menu = $('#context-menu')
    const content = menu?.querySelector('.context-menu-content')
    if (!content) return
    content.innerHTML = `
      <div class="ctx-item" data-action="play-next"><span class="ctx-icon">${icons.next}</span> Play Next</div>
      <div class="ctx-item" data-action="add-queue"><span class="ctx-icon">${icons.queue}</span> Add to Queue</div>
      <div class="ctx-item" data-action="add-playlist"><span class="ctx-icon">${icons.playlist}</span> Add to Playlist</div>
      <div class="ctx-divider"></div>
      <div class="ctx-item" data-action="go-artist"><span class="ctx-icon">${icons.library}</span> Go to Artist</div>
      <div class="ctx-item" data-action="go-album"><span class="ctx-icon">${icons.library}</span> Go to Album</div>
      <div class="ctx-divider"></div>
      <div class="ctx-item" data-action="star"><span class="ctx-icon">${icons.heart}</span> ${track.starred ? 'Unstar' : 'Star'}</div>
    `
    content.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        closeContextMenu()
        handleCtxAction(item.dataset.action)
      })
    })
    // Position near the touch point
    menu.classList.remove('hidden')
    menu.classList.add('ctx-open')
    const rect = content.getBoundingClientRect()
    const x = event?.clientX != null ? event.clientX : window.innerWidth / 2
    const y = event?.clientY != null ? event.clientY : window.innerHeight / 2
    let left = x - 10
    let top = y - 10
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10
    if (top + rect.height > window.innerHeight - 10) top = window.innerHeight - rect.height - 10
    if (left < 10) left = 10
    if (top < 10) top = 10
    content.style.left = left + 'px'
    content.style.top = top + 'px'
  }

  function closeContextMenu() {
    const menu = $('#context-menu')
    if (menu) {
      menu.classList.add('hidden')
      menu.classList.remove('ctx-open')
    }
    _ctxTrack = null
  }
  window.closeContextMenu = closeContextMenu

  function handleCtxAction(action) {
    const t = _ctxTrack
    if (!t) return
    const track = {
      id: t.id, title: t.title || t.name, artist: t.artist || '',
      album: t.album || t.albumName, duration: t.duration, coverUrl: t.coverUrl || '',
      streamUrl: t.streamUrl || navidrome.streamUrl(t.id)
    }
    switch (action) {
      case 'play-next':
        player.playNext(track)
        showSnackbar('Will play next')
        break
      case 'add-queue':
        player.addToQueue(track)
        showSnackbar('Added to queue')
        break
      case 'add-playlist':
        showAddToPlaylistPicker(t)
        break
      case 'go-artist':
        if (t.artist || t.albumArtist) showArtist(null, t.artist || t.albumArtist)
        break
      case 'go-album':
        if (t.album || t.albumName) showAlbum(null, t.album || t.albumName, t.artist || t.albumArtist || '')
        break
      case 'star': {
        const btn = document.querySelector(`.star-btn[data-id="${t.id}"]`)
        if (btn) toggleStar(btn)
        else {
          toggleStarById(t.id)
          showSnackbar(t.starred ? 'Unstarred' : 'Starred')
        }
        break
      }
    }
  }

  window.toggleStarById = async function (id) {
    if (!id) return
    try {
      const allStarBtns = document.querySelectorAll(`.star-btn[data-id="${id}"]`)
      const isStarred = allStarBtns.length > 0 && allStarBtns[0].dataset.starred === 'true'
      await navidrome[isStarred ? 'unstar' : 'star'](id)
      allStarBtns.forEach(btn => {
        btn.dataset.starred = !isStarred
        btn.classList.toggle('starred', !isStarred)
        btn.innerHTML = icons[!isStarred ? 'heartFilled' : 'heart']
      })
    } catch (e) {
      showError(e.message)
    }
  }

  async function showAddToPlaylistPicker(track) {
    const existing = document.getElementById('pl-picker-overlay')
    if (existing) existing.remove()

    const overlay = document.createElement('div')
    overlay.id = 'pl-picker-overlay'
    overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center'
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    const box = document.createElement('div')
    box.style.cssText = 'background:var(--bg2);border-radius:12px;padding:16px;max-width:320px;width:90%;max-height:60vh;overflow-y:auto'

    box.innerHTML = `<h4 style="margin:0 0 8px">Add to Playlist</h4><div id="pl-picker-list"></div>`
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    const list = document.getElementById('pl-picker-list')
    list.innerHTML = '<div style="color:var(--text3)">Loading...</div>'
    try {
      const resp = await navidrome.getPlaylists()
      const playlists = resp?.playlists?.playlist || []
      if (!playlists.length) {
        list.innerHTML = '<div style="color:var(--text3);padding:8px 0">No playlists. Create one first.</div>'
        return
      }
      list.innerHTML = ''
      playlists.forEach(pl => {
        const row = document.createElement('div')
        row.style.cssText = 'display:flex;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer'
        row.innerHTML = `<span style="flex:1">${escHtml(pl.name)}</span><span style="color:var(--text3);font-size:0.8rem">${pl.songCount || 0}</span>`
        row.addEventListener('click', async () => {
          try {
            await navidrome.updatePlaylist(pl.id, { songIdsToAdd: [track.id] })
            showSuccess(`Added to "${pl.name}"`)
            overlay.remove()
          } catch (e) {
            showError(e.message)
          }
        })
        list.appendChild(row)
      })
    } catch (e) {
      list.innerHTML = `<div style="color:var(--red)">${e.message}</div>`
    }
  }

  /* === Long-press context menu delegation === */
  let _lpTimer = null, _lpTarget = null
  document.addEventListener('touchstart', e => {
    const row = e.target.closest('[data-ctx]')
    if (!row) return
    _lpTarget = row
    _lpTimer = setTimeout(() => {
      _lpTimer = null
      try {
        const track = JSON.parse(row.dataset.ctx)
        openContextMenu(track, e)
      } catch (_) {}
    }, 500)
  }, { passive: true })
  document.addEventListener('touchmove', () => { clearTimeout(_lpTimer); _lpTimer = null }, { passive: true })
  document.addEventListener('touchend', () => { clearTimeout(_lpTimer); _lpTimer = null }, { passive: true })
  document.addEventListener('contextmenu', e => {
    const row = e.target.closest('[data-ctx]')
    if (!row) return
    e.preventDefault()
    try {
      const track = JSON.parse(row.dataset.ctx)
      openContextMenu(track, e)
    } catch (_) {}
  })

  function searchDiscography(query) {
    navigate('search')
    const input = document.getElementById('search-input')
    if (input) {
      input.value = query
      setTimeout(() => doSearch(), 100)
    }
  }
  window.searchDiscography = searchDiscography

  function escHtml(s) {
    if (!s) return ''
    const d = document.createElement('div')
    d.textContent = String(s)
    return d.innerHTML
  }

  function _ctxAttr(t) {
    const o = { id: t.id, title: t.title || t.name, artist: t.artist || t.albumArtist || '',
      album: t.album || t.albumName || '', duration: t.duration, coverUrl: t.coverUrl || '',
      streamUrl: t.streamUrl || '', starred: !!t.starred }
    return ` data-ctx='${JSON.stringify(o).replace(/'/g, '&#39;').replace(/"/g, '&quot;')}' `
  }

  function bindSettings() {
    document.addEventListener('click', e => {
      if (e.target.closest('#settings-save')) saveSettings()
      if (e.target.closest('#settings-test-navidrome')) testNavidrome()
      if (e.target.closest('#settings-test-soulsync')) testSoulSync()
      if (e.target.closest('#settings-rescan-btn')) rescanLibrary()
      if (e.target.closest('#settings-wizard-btn')) restartWizard()
      if (e.target.closest('#settings-clear-cache') && window.AndroidBridge) {
        if (confirm('Clear all cached tracks?')) {
          AndroidBridge.clearCache()
          _cachedTracks = {}
          _updateCacheUI()
          _renderCachedTracks()
        }
      }
    })
  }

  function renderSettings() {
    const s = settings.load()
    const activeTab = s._settingsTab || 'servers'
    $('#view-settings').innerHTML = `
      <h2 class="view-title">Settings</h2>
      <div class="settings-tabs">
        <button class="settings-tab ${activeTab === 'servers' ? 'active' : ''}" data-stab="servers">Servers</button>
        <button class="settings-tab ${activeTab === 'playback' ? 'active' : ''}" data-stab="playback">Playback</button>
        <button class="settings-tab ${activeTab === 'equalizer' ? 'active' : ''}" data-stab="equalizer">Equalizer</button>
        <button class="settings-tab ${activeTab === 'wishlist' ? 'active' : ''}" data-stab="wishlist">Wishlist</button>
        <button class="settings-tab ${activeTab === 'storage' ? 'active' : ''}" data-stab="storage">Storage</button>
      </div>
      <div class="settings-tab-content" id="settings-tab-content"></div>
    `
    $$('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.settings-tab').forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        const tabName = tab.dataset.stab
        settings.save({ _settingsTab: tabName })
        renderSettingsTab(tabName)
      })
    })
    renderSettingsTab(activeTab)
  }

  function renderSettingsTab(tab) {
    const el = $('#settings-tab-content')
    const s = settings.load()
    switch (tab) {
      case 'servers': {
        el.innerHTML = `
          <form id="settings-form" class="settings-form" onsubmit="return false">
            <section class="settings-section">
              <h3>Navidrome</h3>
              <p class="settings-desc">Your music library server (Subsonic API)</p>
              <label>Server URL <input type="url" class="input" id="s-nav-server" value="${escHtml(s.navidrome_server)}" placeholder="https://music.example.com"></label>
              <label>Username <input type="text" class="input" id="s-nav-user" value="${escHtml(s.navidrome_username)}"></label>
              <label>Password <input type="password" class="input" id="s-nav-pass" value="${escHtml(s.navidrome_password)}"></label>
              <button type="button" class="btn btn-secondary" id="settings-test-navidrome" style="margin-top:8px">Test Connection</button>
              <button type="button" class="btn btn-secondary" id="settings-rescan-btn" style="margin-top:6px">${icons.refresh} Rescan Library</button>
            </section>
            <section class="settings-section">
              <h3>SoulSync</h3>
              <p class="settings-desc">Music discovery and download server</p>
              <label>Server URL <input type="url" class="input" id="s-ss-server" value="${escHtml(s.soulsync_server)}" placeholder="https://soulsync.example.com"></label>
              <label>API Key <input type="password" class="input" id="s-ss-key" value="${escHtml(s.soulsync_apikey)}" placeholder="sk_..."></label>
              <button type="button" class="btn btn-secondary" id="settings-test-soulsync" style="margin-top:8px">Test Connection</button>
            </section>
            <section class="settings-section">
              <h3>Setup</h3>
              <p class="settings-desc">Re-run the setup wizard</p>
              <button type="button" class="btn btn-secondary" id="settings-wizard-btn" style="margin-top:8px">Show Setup Wizard</button>
            </section>
            <button type="button" class="btn btn-primary" id="settings-save">Save Settings</button>
          </form>
        `
        break
      }
      case 'playback': {
        const formatOpts = { auto: 'Auto (native)', mp3: 'MP3', flac: 'FLAC', aac: 'AAC', ogg: 'OGG', wav: 'WAV' }
        el.innerHTML = `
          <form id="settings-form" class="settings-form" onsubmit="return false">
            <section class="settings-section">
              <h3>Playback</h3>
              <label>Crossfade
                <input type="range" id="s-crossfade" min="0" max="10" step="0.5" value="${s.crossfade || 0}" style="width:120px;vertical-align:middle">
                <span id="s-crossfade-val">${(s.crossfade || 0)}s</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" id="s-gapless" ${s.gapless !== false ? 'checked' : ''}>
                Gapless playback
              </label>
              <div class="settings-field">
                <span class="settings-field-label">Stream format</span>
                ${_customSelect('s-format', formatOpts, s.navidrome_stream_format || 'auto')}
              </div>
            </section>
            <button type="button" class="btn btn-primary" id="settings-save">Save Settings</button>
          </form>
        `
        _bindCustomSelect('s-format', formatOpts, val => {
          settings.save({ navidrome_stream_format: val })
        })
        const cf = $('#s-crossfade')
        cf?.addEventListener('input', () => {
          const val = document.getElementById('s-crossfade-val')
          if (val) val.textContent = cf.value + 's'
        })
        break
      }
      case 'equalizer': {
        let bands = ['60Hz', '170Hz', '310Hz', '600Hz', '1kHz', '3kHz', '6kHz', '12kHz', '14kHz', '16kHz']
        let eqPresets = {
          flat: bands.map(() => 0),
          rock: [5, 4, 3, 2, 1, 2, 3, 4, 3, 2],
          pop: [-1, 3, 4, 5, 3, 1, 0, 0, 0, 0],
          jazz: [3, 3, 2, 2, 1, 1, 2, 3, 4, 5],
          classical: [5, 4, 3, 2, 1, 1, 2, 3, 4, 5],
          bass: [7, 6, 4, 2, 0, -1, -2, -3, -4, -5],
          vocals: [-1, -1, 0, 2, 4, 4, 3, 2, 1, 1]
        }
        let eqVals = s.equalizer || bands.map(() => 0)
        let eqPresetName = s.eqPreset || 'custom'
        let isNativeEq = false
        let eqRange = 12
        if (window.AndroidBridge?.nativeGetEqInfo) {
          try {
            const info = JSON.parse(window.AndroidBridge.nativeGetEqInfo())
            if (info.bands && info.bands.length > 0) {
              bands = info.bands.map(b => b.frequency >= 1000
                ? (b.frequency / 1000).toFixed(1).replace('.0', '') + 'kHz'
                : b.frequency + 'Hz')
              eqVals = info.gains && info.gains.length === bands.length ? info.gains : bands.map(() => 0)
              eqPresets = { flat: bands.map(() => 0) }
              eqPresetName = 'custom'
              isNativeEq = true
            }
            if (info.bandLevelRange && info.bandLevelRange.length > 1) {
              eqRange = Math.min(Math.abs(info.bandLevelRange[0]), Math.abs(info.bandLevelRange[1]), 12)
            }
          } catch (_) {}
        }
        const eqPresetOpts = {}
        Object.keys(eqPresets).forEach(name => { eqPresetOpts[name] = name.charAt(0).toUpperCase() + name.slice(1) })
        eqPresetOpts.custom = 'Custom'
        el.innerHTML = `
          <form id="settings-form" class="settings-form" onsubmit="return false">
            <section class="settings-section">
              <h3>Equalizer</h3>
              <p class="settings-desc">Tone adjustment (±${isNativeEq ? '15' : '12'}dB)${isNativeEq ? ' (device bands)' : ''}</p>
              <label class="checkbox-row">
                <input type="checkbox" id="s-eq-enabled" ${s.eqEnabled ? 'checked' : ''}>
                Enable Equalizer
              </label>
              <div class="eq-presets"${isNativeEq ? ' style="display:none"' : ''}>
                <span class="settings-field-label">Preset</span>
                ${_customSelect('s-eq-preset', eqPresetOpts, eqPresetName)}
              </div>
              <div class="eq-bands" id="eq-bands">
                ${bands.map((band, i) => `
                  <div class="eq-band">
                    <span class="eq-label">${band}</span>
                    <input type="range" class="eq-slider" data-idx="${i}" min="${-eqRange}" max="${eqRange}" step="1" value="${eqVals[i] || 0}" orient="vertical">
                    <span class="eq-value">${eqVals[i] || 0}dB</span>
                  </div>
                `).join('')}
              </div>
            </section>
            <button type="button" class="btn btn-primary" id="settings-save">Save Settings</button>
          </form>
        `
        _bindCustomSelect('s-eq-preset', eqPresetOpts, val => {
          const preset = eqPresets[val]
          if (!preset) return
          $$('.eq-slider').forEach((sl, i) => {
            if (preset[i] != null) {
              sl.value = preset[i]
              const valEl = sl.parentNode.querySelector('.eq-value')
              if (valEl) valEl.textContent = preset[i] + 'dB'
            }
          })
          settings.save({ eqPreset: val })
          if ($('#s-eq-enabled')?.checked) applyEq()
        })
        $$('.eq-slider').forEach(slider => {
          slider.addEventListener('input', () => {
            const valEl = slider.parentNode.querySelector('.eq-value')
            if (valEl) valEl.textContent = slider.value + 'dB'
            const presetSelect = $('#s-eq-preset')
            if (presetSelect) {
              const label = presetSelect.querySelector('.custom-select-label')
              if (label) label.textContent = 'Custom'
              presetSelect.querySelectorAll('.custom-select-option').forEach(o => o.classList.toggle('selected', o.dataset.value === 'custom'))
            }
            settings.save({ eqPreset: 'custom' })
            if ($('#s-eq-enabled')?.checked) applyEq()
          })
        })
        break
      }
      case 'wishlist': {
        el.innerHTML = `
          <section class="settings-section" id="settings-wishlist-section">
            <h3>Wishlist <span class="wishlist-count" id="sw-count"></span></h3>
            <div id="settings-wishlist-content"></div>
          </section>
        `
        setTimeout(() => loadWishlistInSettings(), 0)
        break
      }
      case 'storage': {
        if (!window.AndroidBridge) {
          el.innerHTML = '<div class="settings-section"><p class="settings-desc">Storage management is only available on Android.</p></div>'
          break
        }
        const s = settings.load()
        const maxMb = parseInt(s.max_cache_size_mb) || 500
        el.innerHTML = `
          <section class="settings-section">
            <h3>Offline Storage</h3>
            <p class="settings-desc" id="cache-stats"></p>
            <label style="display:flex;align-items:center;gap:8px;margin:8px 0">
              <span style="white-space:nowrap">Max cache size:</span>
              <input type="range" id="s-max-cache" min="50" max="5000" step="50" value="${maxMb}" style="flex:1">
              <span id="s-max-cache-val" style="min-width:60px;text-align:right">${maxMb} MB</span>
            </label>
            <div id="cached-tracks-list"></div>
            <button type="button" class="btn btn-danger" id="settings-clear-cache" style="margin-top:12px">Clear All Cached Tracks</button>
          </section>
        `
        setTimeout(() => { _updateCacheUI(); _renderCachedTracks(); _bindCacheSizeSlider() }, 0)
        break
      }
    }
  }

  function saveSettings() {
    const existing = settings.load()
    const s = { ...existing }
    if ($('#s-nav-server')) {
      s.navidrome_server = $('#s-nav-server')?.value || ''
      s.navidrome_username = $('#s-nav-user')?.value || ''
      s.navidrome_password = $('#s-nav-pass')?.value || ''
      s.soulsync_server = $('#s-ss-server')?.value || ''
      s.soulsync_apikey = $('#s-ss-key')?.value || ''
    }
    if ($('#s-crossfade')) {
      s.crossfade = $('#s-crossfade')?.value || '0'
    }
    if ($('#s-gapless')) {
      s.gapless = $('#s-gapless')?.checked !== false
    }
    if ($('#s-format')?.classList?.contains('custom-select')) {
      const sel = $('#s-format')
      const label = sel?.querySelector('.custom-select-label')
      if (label) {
        const formatMap = { 'Auto (native)': 'auto', 'MP3': 'mp3', 'FLAC': 'flac', 'AAC': 'aac', 'OGG': 'ogg', 'WAV': 'wav' }
        s.navidrome_stream_format = formatMap[label.textContent] || 'auto'
      }
    }
    if ($('#s-eq-enabled')) {
      s.eqEnabled = $('#s-eq-enabled')?.checked || false
    }
    const eqSliders = $$('.eq-slider')
    if (eqSliders.length) {
      s.equalizer = eqSliders.map(sl => parseFloat(sl.value) || 0)
    }
    settings.save(s)
    Object.assign(navidrome, {
      server: s.navidrome_server,
      username: s.navidrome_username,
      password: s.navidrome_password,
      streamFormat: s.navidrome_stream_format
    })
    if (window.AndroidBridge) {
      s.soulsync_proxy = 'http://localhost:8080'
    }
    Object.assign(soulsync, {
      server: s.soulsync_server,
      apiKey: s.soulsync_apikey,
      proxyUrl: s.soulsync_proxy || 'http://localhost:8080'
    })
    player.setCrossfade(parseFloat(s.crossfade) || 0)
    player.setGapless(s.gapless !== false)
    if (s.eqEnabled) applyEq()
    else disableEq()
    updateSidebarStatus()
    showSuccess('Settings saved')
  }

  function applyEq() {
    const sliders = $$('.eq-slider')
    if (!sliders.length) return
    const gains = sliders.map(sl => parseFloat(sl.value) || 0)
    player.setEq(gains)
  }
  window.applyEq = applyEq

  function disableEq() {
    player.disableEq()
  }
  window.disableEq = disableEq

  async function testNavidrome() {
    const btn = $('#settings-test-navidrome')
    btn.disabled = true
    btn.textContent = 'Testing...'
    try {
      const testNav = new NavidromeClient()
      testNav.server = $('#s-nav-server')?.value || ''
      testNav.username = $('#s-nav-user')?.value || ''
      testNav.password = $('#s-nav-pass')?.value || ''
      if (window.AndroidBridge) testNav.proxyUrl = 'http://localhost:8080'
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
      testSs.proxyUrl = 'http://localhost:8080'
      await testSs.searchTracks('test', 1)
      showSuccess('SoulSync connected!')
    } catch (e) {
      showError(`SoulSync: ${e.message}`)
    } finally {
      btn.disabled = false
      btn.textContent = 'Test Connection'
    }
  }

  async function rescanLibrary() {
    const btn = $('#settings-rescan-btn')
    btn.disabled = true
    btn.textContent = 'Scanning...'
    try {
      await navidrome.startScan()
      showSuccess('Library scan started')
    } catch (e) {
      showError(`Rescan failed: ${e.message}`)
    } finally {
      btn.disabled = false
      btn.innerHTML = `${icons.refresh} Rescan Library`
    }
  }

  function bindSearch() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.ss-wishlist-btn')
      if (btn) {
        const idx = parseInt(btn.dataset.idx)
        const data = window._ssData?.[idx]
        if (data) addToWishlist(data)
      }
    })
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

    // Build dedup set from Navidrome results
    const _navTrackKeys = new Set(navSongs.map(s => _trackKey(s.title || '', s.artist || '')))
    const _navAlbumKeys = new Set(navAlbums.map(a => _albumKey(a.name || '', a.artist || '')))
    const _navArtistNames = new Set(navArtists.map(a => a.name?.toLowerCase()))

    function _trackKey(title, artist) { return (title + '|' + artist).toLowerCase().replace(/\s+/g, ' ') }
    function _albumKey(name, artist) { return (name + '|' + artist).toLowerCase().replace(/\s+/g, ' ') }
    function _inLibrary(name, artist) { return _navArtistNames.has(name?.toLowerCase()) }

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
            <div class="track-row" onclick="playSearchSong(${i})"${_ctxAttr(s)}>
              <span class="track-num">${s.track || i + 1}</span>
              <div class="track-info">
                <div class="track-name">${escHtml(s.title)}</div>
                <div class="track-artist"><a class="meta-link" onclick="event.stopPropagation();showArtist(null,'${escHtml(s.artist || '').replace(/'/g, "\\'")}')">${escHtml(s.artist || '')}</a> · <a class="meta-link" onclick="event.stopPropagation();showAlbum(null,'${escHtml(s.album || '').replace(/'/g, "\\'")}','${escHtml(s.artist || '').replace(/'/g, "\\'")}')">${escHtml(s.album || '')}</a></div>
              </div>
              ${_starBtnHtml(s.id, !!s.starred)}
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
          const data = { type: 'artist', raw: a }
          window._ssData = window._ssData || []
          const dataIdx = window._ssData.length
          window._ssData.push(data)
          const img = a.image_url || a.images?.[0]?.url || ''
          const initial = (a.name || '?').charAt(0).toUpperCase()
          html += `<div class="search-item search-item-clickable" onclick="showSsArtist(${dataIdx})">
            <div class="search-thumb-wrap">${
              img
                ? `<img class="search-thumb search-thumb-round" src="${img}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.search-thumb-fallback').style.display='flex'"><div class="search-thumb-round search-thumb-fallback" style="display:none">${initial}</div>`
                : `<div class="search-thumb-round search-thumb-fallback">${initial}</div>`
            }</div>
            <div><strong>${escHtml(a.name || '')}</strong> <span class="search-item-meta">· ${a.genres?.slice(0, 2).join(', ') || ''}</span></div>
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
          const initial = (a.name || '?').charAt(0).toUpperCase()
          const inLib = _navAlbumKeys.has(_albumKey(a.name || '', a.artists?.join(', ') || ''))
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
            ${inLib ? '<span class="badge badge-library" style="margin-left:auto">In Library</span>' : `<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();addSsAlbumToWishlist(${dataIdx}, this)" style="margin-left:auto">+ Wishlist</button>`}
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
          const initial = (t.name || '?').charAt(0).toUpperCase()
          const inLib = _navTrackKeys.has(_trackKey(t.name || '', (t.artists?.join(', ') || t.artist || '')))
          html += `<div class="search-item">
            <div class="search-thumb-wrap">${
              img
                ? `<img class="search-thumb" src="${img}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.search-thumb-fallback').style.display='flex'"><div class="search-thumb-fallback search-thumb-fallback-sq" style="display:none">${initial}</div>`
                : `<div class="search-thumb-fallback search-thumb-fallback-sq">${initial}</div>`
            }</div>
            <div>
              <strong>${escHtml(t.name || '')}</strong>
              <span class="search-item-meta">· <a class="meta-link" onclick="event.stopPropagation();showSsArtistByName('${escHtml((t.artists?.[0] || t.artist || '')).replace(/'/g, "\\'")}')">${escHtml(t.artists?.join(', ') || t.artist || '')}</a> · ${escHtml(t.album || '')}</span>
            </div>
            ${inLib ? '<span class="badge badge-library" style="margin-left:auto">In Library</span>' : `<button class="btn btn-sm btn-secondary ss-wishlist-btn" data-idx="${dataIdx}" style="margin-left:auto">+ Wishlist</button>`}
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

  window.addAlbumToWishlist = async function (albumId, albumName, artistName) {
    if (!soulsync.configured) { showError('SoulSync not configured'); return }
    if (!navidrome.configured) { showError('Navidrome not configured'); return }
    try {
      const resp = await navidrome.getAlbum(albumId)
      const album = resp?.album
      const songs = album?.song || []
      if (!songs.length) { showError(`No tracks found for "${albumName}"`); return }

      showSuccess(`Adding ${songs.length} tracks from "${albumName}" to wishlist...`)
      let added = 0, skipped = 0, failed = 0
      for (const s of songs) {
        const artist = { name: s.artist || artistName, id: s.artistId || albumId }
        const album = { id: albumId, name: albumName }
        const trackObj = {
          id: s.id, name: s.title,
          artists: [s.artist || artistName],
          duration_ms: (s.duration || 0) * 1000,
          track_number: s.track || 0
        }
        const sourceContext = { album_name: albumName, artist_name: artistName, album_type: 'album' }
        try {
          const r = await soulsync.addAlbumTrackToWishlist(trackObj, artist, album, 'album', sourceContext)
          if (r?.success) added++
          else failed++
        } catch (e) {
          if (e.message.includes('already in wishlist')) { skipped++ }
          else {
            try {
              await soulsync.addToWishlist({ id: s.id, name: s.title, artists: [s.artist || artistName], album: albumName })
              added++
            } catch (e2) {
              if (e2.message.includes('already in wishlist')) skipped++
              else failed++
            }
          }
        }
      }
      if (added > 0) showSuccess(`Added ${added} track${added !== 1 ? 's' : ''} from "${albumName}" to wishlist`)
      else if (skipped > 0) showSuccess(`All ${skipped} track${skipped !== 1 ? 's' : ''} already in wishlist`)
      else showError(`Failed to add tracks: ${failed} error${failed !== 1 ? 's' : ''}`)
    } catch (e) {
      showError(`Failed: ${e.message}`)
    }
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

        const albumNameLower = (albumName || '').toLowerCase()
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
      const artistHtml = artistNames.map(an => `<a class="meta-link" onclick="event.stopPropagation();showSsArtistByName('${escHtml(an).replace(/'/g, "\\'")}')">${escHtml(an)}</a>`).join(', ')

      let html = `
        <div class="search-container">
          <button class="btn-back" onclick="backToSearchResults()">${icons.back} Back to results</button>
          <div class="album-detail">
            <div class="album-detail-header">
              <div class="album-detail-info">
                <h1>${escHtml(albumName)}</h1>
                <p class="album-detail-artist">${artistHtml}</p>
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
        const tArtist = track.artists?.join(', ') || ''
        html += `
          <div class="track-row">
            <span class="track-num">${i + 1}</span>
            <div class="track-info">
              <div class="track-name">${escHtml(track.name)}</div>
              <div class="track-artist">${tArtist ? `<a class="meta-link" onclick="event.stopPropagation();showSsArtistFromTrack(${trackDataIdx})">${escHtml(tArtist)}</a>` : ''}</div>
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

  window.showSsArtist = async function (dataIdx) {
    const data = window._ssData?.[dataIdx]
    if (!data || data.type !== 'artist') return
    const { raw } = data
    const artistName = raw.name || ''

    const el = $('#view-search')
    el.innerHTML = '<div class="loading"><div class="loading-spinner"></div> Loading...</div>'

    try {
      const [albumResp, trackResp] = await Promise.all([
        soulsync.searchAlbums(artistName, 50).catch(() => null),
        soulsync.searchTracks(artistName, 50).catch(() => null)
      ])

      const albums = albumResp?.data?.albums?.filter(a => {
        const artists = a.artists || []
        return artists.some(ar =>
          ar.toLowerCase().includes(artistName.toLowerCase()) ||
          artistName.toLowerCase().includes(ar.toLowerCase())
        )
      }) || []

      const tracks = trackResp?.data?.tracks?.filter(t => {
        const tArtist = Array.isArray(t.artists) ? t.artists.join(' ') : t.artist || ''
        return tArtist.toLowerCase().includes(artistName.toLowerCase()) ||
               artistName.toLowerCase().includes(tArtist.toLowerCase())
      }) || []

      const ssMbid = raw.musicbrainz_id || raw.mbid || raw.external_ids?.musicbrainz || ''
      const mb = await _fetchMBInfo(artistName, ssMbid)
      let html = `
        <div class="search-container">
          <button class="btn-back" onclick="backToSearchResults()">${icons.back} Back to results</button>
          <h2 class="view-title">${escHtml(artistName)}</h2>
      `

      if (albums.length) {
        html += `<h4 class="search-subtitle" style="margin-top:16px">Albums</h4><div class="search-compact">`
        albums.forEach(a => {
          const img = a.image_url || a.images?.[0]?.url || ''
          const initial = (a.name || '?').charAt(0).toUpperCase()
          const albumData = { type: 'album', raw: a }
          const albumDataIdx = window._ssData.length
          window._ssData.push(albumData)
          const year = a.release_date?.substring(0, 4) || ''
          html += `<div class="search-item search-item-clickable" onclick="showSsAlbum(${albumDataIdx})">
            <div class="search-thumb-wrap">${
              img
                ? `<img class="search-thumb" src="${img}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.querySelector('.search-thumb-fallback').style.display='flex'"><div class="search-thumb-fallback search-thumb-fallback-sq" style="display:none">${initial}</div>`
                : `<div class="search-thumb-fallback search-thumb-fallback-sq">${initial}</div>`
            }</div>
            <div><strong>${escHtml(a.name)}</strong><span class="search-item-meta">${year ? ` · ${year}` : ''}</span></div>
          </div>`
        })
        html += `</div>`
      }

      if (tracks.length) {
        html += `<h4 class="search-subtitle" style="margin-top:16px">Tracks</h4><div class="track-list">`
        tracks.forEach((t, i) => {
          const trkDataIdx = window._ssData.length
          window._ssData.push({ type: 'track', raw: t })
          const tArtist = Array.isArray(t.artists) ? t.artists.join(', ') : t.artist || ''
          html += `
            <div class="track-row">
              <span class="track-num">${i + 1}</span>
              <div class="track-info">
                <div class="track-name">${escHtml(t.name)}</div>
                <div class="track-artist"><a class="meta-link" onclick="event.stopPropagation();showSsArtistFromTrack(${trkDataIdx})">${escHtml(tArtist)}</a></div>
              </div>
              <button class="btn btn-sm btn-secondary ss-wishlist-btn" data-idx="${trkDataIdx}">+ Wishlist</button>
            </div>`
        })
        html += `</div>`
      }

      if (!albums.length && !tracks.length) {
        html += `<div class="empty-state">No albums or tracks found for this artist on SoulSync</div>`
      }

      html += `</div></div>`
      el.innerHTML = html
    } catch (e) {
      el.innerHTML = `<div class="error-msg">${e.message}</div>`
    }
  }

  window.showSsArtistFromTrack = function (dataIdx) {
    const data = window._ssData?.[dataIdx]
    if (!data) return
    const t = data.raw
    const artistName = Array.isArray(t.artists) ? t.artists[0] : t.artist || ''
    if (!artistName) return
    showSsArtistByName(artistName)
  }

  window.showSsArtistByName = async function (artistName) {
    if (!artistName) return
    const data = { type: 'artist', raw: { name: artistName } }
    window._ssData = window._ssData || []
    const dataIdx = window._ssData.length
    window._ssData.push(data)
    showSsArtist(dataIdx)
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
      <div class="track-list queue-track-list">
    `
      state.queue.forEach((track, i) => {
        const isCurrent = i === state.currentIndex
        const artistText = escHtml(track.artist || track.artist_name || track.albumArtist || '').replace(/'/g, "\\'")
        const albumText = escHtml(track.albumName || track.album || '').replace(/'/g, "\\'")
        html += `
          <div class="track-row ${isCurrent ? 'track-active' : ''}" onclick="jumpToQueueIndex(${i})" draggable="true" data-queue-idx="${i}"${_ctxAttr(track)}>
            <span class="track-num drag-handle">${isCurrent ? icons.play : (i + 1)}</span>
            <div class="track-info">
              <div class="track-name">${escHtml(track.title || track.name || 'Unknown')}</div>
              <div class="track-artist"><a class="meta-link" onclick="event.stopPropagation();showArtist(null,'${artistText}')">${escHtml(track.artist || track.artist_name || track.albumArtist || '')}</a></div>
            </div>
            ${_starBtnHtml(track.id, !!track.starred)}
            <button class="icon-btn" onclick="event.stopPropagation();removeFromQueue(${i})" title="Remove">${icons.close}</button>
          </div>
        `
      })
    html += '</div>'
    el.innerHTML = html
    _enableQueueDrag()
  }

  function _enableQueueDrag() {
    const container = document.querySelector('.queue-track-list')
    if (!container) return
    let dragEl = null
    container.addEventListener('dragstart', e => {
      const row = e.target.closest('[draggable]')
      if (!row) return
      dragEl = row
      row.classList.add('dragging')
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', row.dataset.queueIdx)
    })
    container.addEventListener('dragend', e => {
      const row = e.target.closest('[draggable]')
      if (row) row.classList.remove('dragging')
    })
    container.addEventListener('dragover', e => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const after = e.target.closest('.track-row:not(.dragging)')
      if (!after || !dragEl) return
      const rect = after.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      container.insertBefore(dragEl, e.clientY < mid ? after : after.nextElementSibling)
    })
    container.addEventListener('drop', e => {
      e.preventDefault()
      if (!dragEl) return
      const fromIdx = parseInt(dragEl.dataset.queueIdx)
      const rows = [...container.querySelectorAll('.track-row')]
      const toIdx = rows.indexOf(dragEl)
      if (fromIdx !== toIdx) {
        player.moveInQueue(fromIdx, toIdx)
        renderQueue()
      }
    })
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

  window.addToQueue = function (dataIdx) {
    const item = window._ssData?.[dataIdx]
    if (!item) return
    const t = item.raw
    const track = {
      id: t.id, title: t.name || t.title, artist: t.artists?.join(', ') || t.artist || '',
      album: t.album, duration: t.duration, coverUrl: t.coverUrl || '',
      streamUrl: navidrome.streamUrl(t.id)
    }
    player.addToQueue(track)
    showSnackbar('Added to queue')
  }

  window.playNextTrack = function (dataIdx) {
    const item = window._ssData?.[dataIdx]
    if (!item) return
    const t = item.raw
    const track = {
      id: t.id, title: t.name || t.title, artist: t.artists?.join(', ') || t.artist || '',
      album: t.album, duration: t.duration, coverUrl: t.coverUrl || '',
      streamUrl: navidrome.streamUrl(t.id)
    }
    player.playNext(track)
    showSnackbar('Will play next')
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
            <button class="btn btn-secondary btn-sm" id="pl-shuffle-btn">${icons.shuffle} Shuffle All</button>
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
    $('#pl-shuffle-btn')?.addEventListener('click', () => {
      if (window.shuffleAll) window.shuffleAll()
    })
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
          <div class="track-row" onclick="playPlaylistTrack(${i})"${_ctxAttr(s)}>
            <span class="track-num">${i + 1}</span>
            <div class="track-info">
              <div class="track-name">${escHtml(s.title)}</div>
              <div class="track-artist">${escHtml(s.artist || '')} · ${escHtml(s.album || '')}</div>
            </div>
            ${_starBtnHtml(s.id, !!s.starred)}
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
  window.saveSettings = saveSettings

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

      const counts = { pending: 0, missing: 0, failed: 0 }
      tracks.forEach(t => {
        if (t.retry_count > 0) counts.failed++
        else if (t.failure_reason) counts.missing++
        else counts.pending++
      })

      function renderTrackList(filter) {
        filter = filter || 'all'
        const items = filter === 'all' ? tracks : tracks.filter(t => {
          if (filter === 'pending') return !t.retry_count && !t.failure_reason
          if (filter === 'missing') return !t.retry_count && !!t.failure_reason
          if (filter === 'failed') return t.retry_count > 0
          return true
        })

        const listEl = $('#wishlist-track-list')
        if (!listEl) return

        if (!items.length) {
          listEl.innerHTML = `<div class="empty-state" style="padding:20px">No ${filter === 'all' ? '' : filter} tracks</div>`
          return
        }

        listEl.innerHTML = items.map(t => {
          const trackId = t.track_id || t.spotify_track_id || ''
          const isFailed = t.retry_count > 0
          const isMissing = !isFailed && t.failure_reason
          const addedDate = t.date_added ? new Date(t.date_added).toLocaleDateString() : ''
          return `
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
                  ${isFailed ? `<span class="wishlist-failed" title="${escHtml(t.failure_reason || `Retries: ${t.retry_count}`)}">⚠ failed</span>` : ''}
                  ${isMissing ? `<span class="wishlist-missing" title="${escHtml(t.failure_reason)}">not in library</span>` : ''}
                </div>
              </div>
              <span class="wishlist-source-type">${escHtml(t.source_type || '')}</span>
              <button class="icon-btn" onclick="removeWishlistTrackInSettings('${escHtml(trackId)}', this)" title="Remove">${icons.close}</button>
            </div>`
        }).join('')

        $$('.wishlist-filter').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.filter === filter)
        })
      }

      el.innerHTML = `
        <div class="wishlist-actions" style="margin-bottom:10px">
          <button class="btn btn-primary btn-sm" id="sw-download-btn" ${isProcessing ? 'disabled' : ''}>
            ${isProcessing ? 'Processing...' : `${icons.download} Download All`}
          </button>
          <button class="btn btn-danger btn-sm" id="sw-clear-btn">${icons.delete} Clear</button>
        </div>
        <div class="wishlist-stats">
          <span class="wishlist-stat wishlist-filter" data-filter="all">${total} total</span>
          ${counts.pending > 0 ? `<span class="wishlist-stat wishlist-filter" data-filter="pending">${counts.pending} pending</span>` : ''}
          ${counts.missing > 0 ? `<span class="wishlist-stat wishlist-filter" data-filter="missing">${counts.missing} missing</span>` : ''}
          ${counts.failed > 0 ? `<span class="wishlist-stat wishlist-filter" data-filter="failed">${counts.failed} failed</span>` : ''}
          ${singles ? `<span class="wishlist-stat">${singles} singles</span>` : ''}
          ${albums ? `<span class="wishlist-stat">${albums} albums</span>` : ''}
        </div>
        <div class="track-list" id="wishlist-track-list">
      </div>`

      renderTrackList('all')

      $$('.wishlist-filter').forEach(btn => {
        btn.addEventListener('click', () => renderTrackList(btn.dataset.filter))
      })

      $('#sw-download-btn')?.addEventListener('click', async () => {
        const btn = $('#sw-download-btn')
        btn.disabled = true
        btn.textContent = 'Starting...'
        try {
          await soulsync.downloadWishlist()
          showSuccess('Wishlist download started')
          _startWishlistPolling()
        } catch (e) {
          if (e.message.includes('already processing')) {
            showError('Wishlist is already processing')
            _startWishlistPolling()
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

  let _wishlistPollTimer = null
  function _startWishlistPolling() {
    if (_wishlistPollTimer) return
    _wishlistPollTimer = setInterval(async () => {
      try {
        const stats = await soulsync.getWishlistStats()
        // Check if still processing
        if (!stats?.is_auto_processing) {
          clearInterval(_wishlistPollTimer)
          _wishlistPollTimer = null
          loadWishlistInSettings()
          return
        }
        // Update wishlist UI if the settings wishlist tab is visible
        if ($('#settings-wishlist-section')?.offsetParent) {
          const countEl = $('#sw-count')
          if (countEl && stats.total != null) countEl.textContent = stats.total
        }
      } catch (_) {
        clearInterval(_wishlistPollTimer)
        _wishlistPollTimer = null
      }
    }, 5000)
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

    const progressLine = document.querySelector('.np-progress-line')
    progressLine?.addEventListener('click', e => {
      if (!player.audio?.duration) return
      const rect = progressLine.getBoundingClientRect()
      const pct = (e.clientX - rect.left) / rect.width
      player.audio.currentTime = pct * player.audio.duration
    })

    volumeBar?.addEventListener('input', () => {
      player.setVolume(volumeBar.value)
    })

    $('#np-back-btn')?.addEventListener('click', hideNowPlaying)

    $('#np-queue-btn')?.addEventListener('click', toggleOverlayQueue)

    // PiP support
    const pipBtn = $('#np-pip-btn')
    if (pipBtn) {
      if (document.pictureInPictureEnabled) {
        pipBtn.style.display = ''
        pipBtn.addEventListener('click', () => {
          if (window.AndroidBridge && AndroidBridge.enterPip) {
            AndroidBridge.enterPip()
          }
        })
      }
    }

    function toggleOverlayQueue() {
      const el = $('#np-overlay-queue')
      if (!el) return
      const shown = el.style.display !== 'none'
      el.style.display = shown ? 'none' : ''
      if (!shown) renderOverlayQueue()
      $('#np-queue-btn')?.classList.toggle('active', !shown)
    }

    function renderOverlayQueue() {
      const el = $('#np-queue-tracks')
      if (!el) return
      const state = player.getState()
      if (!state.queue.length) {
        el.innerHTML = '<div class="empty-state" style="padding:16px;font-size:0.82rem">Queue is empty</div>'
        return
      }
      el.innerHTML = state.queue.map((track, i) => {
        const isCurrent = i === state.currentIndex
        return `
          <div class="track-row ${isCurrent ? 'track-active' : ''}" onclick="jumpToQueueFromOverlay(${i})"${_ctxAttr(track)}>
            <span class="track-num">${isCurrent ? icons.play : (i + 1)}</span>
            <div class="track-info">
              <div class="track-name">${escHtml(track.title || track.name || 'Unknown')}</div>
              <div class="track-artist">${escHtml(track.artist || track.artist_name || track.albumArtist || '')}</div>
            </div>
            <button class="icon-btn" onclick="event.stopPropagation();removeFromOverlayQueue(${i})" title="Remove">${icons.close}</button>
          </div>`
      }).join('')
    }

    window.jumpToQueueFromOverlay = function (i) {
      player.playQueue(player.queue, i)
      renderOverlayQueue()
      updateNowPlaying()
    }

    window.removeFromOverlayQueue = function (i) {
      player.removeFromQueue(i)
      renderOverlayQueue()
    }

    // Swipe down to dismiss overlay
    const screen = $('#now-playing-screen')
    let swipeStartY = 0, swiping = false
    screen?.addEventListener('touchstart', e => {
      if (e.target.closest('.np-overlay-controls') || e.target.closest('.progress-bar') || e.target.closest('.volume-bar')) return
      swipeStartY = e.touches[0].clientY
      swiping = false
    }, { passive: true })
    screen?.addEventListener('touchmove', e => {
      const dy = e.touches[0].clientY - swipeStartY
      if (dy > 10) swiping = true
      if (swiping) {
        screen.style.transition = 'none'
        screen.style.transform = `translateY(${dy}px)`
      }
    }, { passive: true })
    screen?.addEventListener('touchend', e => {
      if (!swiping) return
      const dy = parseFloat(screen.style.transform?.replace('translateY(','')?.replace('px)','') || '0')
      screen.style.transition = ''
      screen.style.transform = ''
      if (dy > 100) hideNowPlaying()
    }, { passive: true })

    // Full-screen album art on tap
    const artwork = $('#np-overlay-cover')
    artwork?.addEventListener('click', () => {
      screen?.classList.toggle('art-expanded')
    })

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

    function _updateRemaining(current, duration) {
      const rem = Math.max(0, duration - current)
      const txt = rem > 0 ? '-' + player.formatTime(rem) : ''
      const el1 = document.getElementById('np-remaining')
      const el2 = document.getElementById('np-overlay-remaining')
      if (el1) { el1.textContent = txt; el1.style.display = txt ? '' : 'none' }
      if (el2) { el2.textContent = txt; el2.style.display = txt ? '' : 'none' }
    }

    player.on('timeupdate', state => {
      const displayDur = state.duration || state.trackDuration || 0
      const pct = displayDur ? (state.currentTime / displayDur) * 100 : 0
      if (!scrubbing && displayDur) {
        progressBar.value = pct
      }
      if (!npScrubbing && displayDur) {
        npOverlayProgress.value = pct
      }
      if (progressFill) progressFill.style.width = `${pct}%`
      if (npCurrent) npCurrent.textContent = player.formatTime(state.currentTime)
      if (npDuration) npDuration.textContent = player.formatTime(displayDur)
      if (npOverlayCurrent) npOverlayCurrent.textContent = player.formatTime(state.currentTime)
      if (npOverlayDuration) npOverlayDuration.textContent = player.formatTime(displayDur)
      if (npOverlayProgress) npOverlayProgress.value = pct
      if (npOverlayVolume) npOverlayVolume.value = state.volume
      _updateRemaining(state.currentTime, displayDur)
    })

    player.on('loaded', state => {
      const t = state.currentTrack
      if (t) {
        const artistText = [...new Set([t.artist, t.artist_name, t.albumArtist].filter(Boolean))].join(' · ')
        const albumNameText = t.albumName || t.album || ''
        const coverSrc = t.coverUrl || ''
        npTitle.textContent = t.title || t.name || 'Unknown'
        npArtist.innerHTML = artistText ? `<a class="meta-link" onclick="event.stopPropagation();showArtistFromNowPlaying()">${escHtml(artistText)}</a>` : ''
        const nab = document.getElementById('np-album')
        if (nab) nab.innerHTML = albumNameText ? `<a class="meta-link" onclick="event.stopPropagation();showAlbumFromNowPlaying()">${escHtml(albumNameText)}</a>` : ''
        npCover.src = coverSrc
        npOverlayTitle.textContent = t.title || t.name || 'Unknown'
        const noaL = document.getElementById('np-overlay-artist-link')
        if (noaL) { noaL.textContent = artistText; noaL.onclick = () => showArtistFromNowPlaying() }
        const noabL = document.getElementById('np-overlay-album-link')
        if (noabL) { noabL.textContent = albumNameText; noabL.onclick = () => showAlbumFromNowPlaying() }
        npOverlayCover.src = coverSrc
        const displayDur = state.duration || state.trackDuration || 0
        if (npDuration) npDuration.textContent = player.formatTime(displayDur)
        if (npOverlayDuration) npOverlayDuration.textContent = player.formatTime(displayDur)
        progressBar.value = 0
        if (progressFill) progressFill.style.width = '0%'
        if (npOverlayProgress) npOverlayProgress.value = 0
        if (state.duration && t.duration !== Math.round(state.duration)) {
          t.duration = Math.round(state.duration)
        }
        // Bottom bar star
        const barStar = document.getElementById('np-bar-star')
        if (barStar && t.id) {
          barStar.style.display = ''
          barStar.dataset.id = t.id
          const starred = !!t.starred
          barStar.dataset.starred = starred
          barStar.classList.toggle('starred', starred)
          barStar.innerHTML = icons[starred ? 'heartFilled' : 'heart']
        }
        // Background + color extraction
        const bgImg = document.getElementById('np-overlay-bg-img')
        if (bgImg) bgImg.src = coverSrc
        _extractColors(coverSrc)
        // Remaining time
        const remEl = document.getElementById('np-remaining')
        const remOverlay = document.getElementById('np-overlay-remaining')
        const remText = displayDur ? '-' + player.formatTime(displayDur) : ''
        if (remEl) { remEl.textContent = remText; remEl.style.display = remText ? '' : 'none' }
        if (remOverlay) { remOverlay.textContent = remText; remOverlay.style.display = remText ? '' : 'none' }
      }
    })

    player.on('play', () => {
      playBtn.classList.add('is-playing')
      npOverlayPlay.classList.add('is-playing')
    })
    player.on('pause', () => {
      playBtn.classList.remove('is-playing')
      npOverlayPlay.classList.remove('is-playing')
    })
    player.on('error', () => {
      const t = player.getState().currentTrack
      const msg = t ? `Failed to play: ${t.title || 'unknown'}` : 'Playback failed'
      showError(msg)
    })

    // Sleep timer
    let _sleepTimeout = null
    let _sleepInterval = null
    let _sleepMode = null // 'duration' | 'track' | null

    function _restoreSleepTimer() {
      try {
        const raw = localStorage.getItem('fynix_sleep_timer')
        if (!raw) return
        const data = JSON.parse(raw)
        if (data.mode === 'track') {
          _sleepMode = 'track'
          _updateSleepDisplay()
          return
        }
        const remaining = data.endTime - Date.now()
        if (remaining <= 0) return
        _sleepMode = 'duration'
        setTimeout(() => _sleepExpired(), remaining)
        _sleepInterval = setInterval(_updateSleepDisplay, 1000)
        _updateSleepDisplay()
      } catch (_) {}
    }

    function _sleepExpired() {
      player.pause()
      _clearSleepTimer()
      showSuccess('Sleep timer ended')
    }

    function _clearSleepTimer() {
      if (_sleepTimeout) clearTimeout(_sleepTimeout)
      if (_sleepInterval) clearInterval(_sleepInterval)
      _sleepTimeout = null
      _sleepInterval = null
      _sleepMode = null
      localStorage.removeItem('fynix_sleep_timer')
      const btn = $('#np-sleep-btn')
      if (btn) btn.innerHTML = icons.clock
    }

    function _updateSleepDisplay() {
      const btn = $('#np-sleep-btn')
      if (!btn) return
      if (!_sleepMode) {
        btn.innerHTML = icons.clock
        btn.classList.remove('active')
        return
      }
      btn.classList.add('active')
      if (_sleepMode === 'track') {
        btn.innerHTML = `${icons.clock} track`
        return
      }
      try {
        const raw = localStorage.getItem('fynix_sleep_timer')
        if (!raw) return
        const data = JSON.parse(raw)
        const remaining = Math.max(0, data.endTime - Date.now())
        if (remaining <= 0) { _sleepExpired(); return }
        const mins = Math.floor(remaining / 60000)
        const secs = Math.floor((remaining % 60000) / 1000)
        btn.innerHTML = `${icons.clock} ${mins}:${String(secs).padStart(2, '0')}`
      } catch (_) {}
    }

    const sleepBtn = $('#np-sleep-btn')
    const sleepPopup = $('#np-sleep-popup')

    sleepBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!sleepPopup) return
      const shown = sleepPopup.style.display !== 'none'
      sleepPopup.style.display = shown ? 'none' : ''
    })

    sleepPopup?.addEventListener('click', (e) => {
      const item = e.target.closest('.sleep-popup-item')
      if (!item) return
      const duration = item.dataset.duration

      _clearSleepTimer()

      if (duration === 'off') {
        sleepPopup.style.display = 'none'
        _updateSleepDisplay()
        return
      }

      if (duration === 'track') {
        _sleepMode = 'track'
        localStorage.setItem('fynix_sleep_timer', JSON.stringify({ mode: 'track' }))
        _updateSleepDisplay()
        sleepPopup.style.display = 'none'
        return
      }

      const mins = parseInt(duration)
      if (isNaN(mins)) return
      _sleepMode = 'duration'
      const endTime = Date.now() + mins * 60000
      localStorage.setItem('fynix_sleep_timer', JSON.stringify({ endTime, mode: 'duration', mins }))
      _sleepTimeout = setTimeout(() => _sleepExpired(), mins * 60000)
      _sleepInterval = setInterval(_updateSleepDisplay, 1000)
      _updateSleepDisplay()
      sleepPopup.style.display = 'none'
    })

    // Close popup on click outside
    document.addEventListener('click', (e) => {
      if (sleepPopup && sleepPopup.style.display !== 'none' && !e.target.closest('.sleep-btn') && !e.target.closest('.sleep-popup')) {
        sleepPopup.style.display = 'none'
      }
      if (e.target.closest('.cache-btn')) _onCacheBtnClick(e)
    })

    // End-of-track detection
    player.audio.addEventListener('ended', () => {
      if (_sleepMode === 'track') {
        setTimeout(() => {
          player.pause()
          _clearSleepTimer()
          showSuccess('Sleep timer ended')
        }, 50)
      }
    })

    _restoreSleepTimer()
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

  init()
})()
