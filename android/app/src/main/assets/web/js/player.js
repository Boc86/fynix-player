class MusicPlayer {
  constructor() {
    this.audio = new Audio()
    this.audio.crossOrigin = 'anonymous'
    this.queue = []
    this.currentIndex = -1
    this.repeat = false
    this.shuffle = false
    this.crossfade = 0 // seconds
    this._savedVolume = 1
    this.listeners = {}
    this._saveTimer = null
    this._restored = false
    this._fading = false

    // EQ / Web Audio
    this._eqEnabled = false
    this._audioCtx = null
    this._eqNodes = []
    this._gainNode = null

    this._eqBands = [
      { freq: 60, type: 'lowshelf' },
      { freq: 170, type: 'peaking', Q: 0.7 },
      { freq: 310, type: 'peaking', Q: 0.7 },
      { freq: 600, type: 'peaking', Q: 0.7 },
      { freq: 1000, type: 'peaking', Q: 0.7 },
      { freq: 3000, type: 'peaking', Q: 0.7 },
      { freq: 6000, type: 'peaking', Q: 0.7 },
      { freq: 12000, type: 'peaking', Q: 0.7 },
      { freq: 14000, type: 'peaking', Q: 0.7 },
      { freq: 16000, type: 'highshelf' }
    ]

    // Gapless preloader
    this._preloadAudio = new Audio()
    this._preloadAudio.preload = 'auto'
    this._gapless = true

    this.audio.addEventListener('timeupdate', () => {
      this._emit('timeupdate', this.getState())
      this._scheduleSave()
      this._checkPreload()
    })
    this.audio.addEventListener('ended', () => this._onEnded())
    this.audio.addEventListener('loadedmetadata', () => this._emit('loaded', this.getState()))
    this.audio.addEventListener('play', () => this._emit('play', this.getState()))
    this.audio.addEventListener('pause', () => {
      this._emit('pause', this.getState())
      this._saveState()
    })
    this.audio.addEventListener('error', (e) => this._emit('error', e))
    this._restoreState()
    window.addEventListener('beforeunload', () => this._saveState())
  }

  _initEq() {
    if (this._audioCtx) return
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const src = this._audioCtx.createMediaElementSource(this.audio)
      this._gainNode = this._audioCtx.createGain()
      this._gainNode.gain.value = 1
      let prevNode = src
      this._eqNodes = this._eqBands.map(band => {
        const filter = this._audioCtx.createBiquadFilter()
        filter.type = band.type
        filter.frequency.value = band.freq
        filter.Q.value = band.Q || 0.7
        filter.gain.value = 0
        prevNode.connect(filter)
        prevNode = filter
        return filter
      })
      prevNode.connect(this._gainNode)
      this._gainNode.connect(this._audioCtx.destination)
    } catch (_) {}
  }

  setEq(gains) {
    this._eqEnabled = true
    this._initEq()
    if (!this._audioCtx) return
    if (this._audioCtx.state === 'suspended') this._audioCtx.resume()
    this._eqNodes.forEach((node, i) => {
      const g = gains[i] != null ? gains[i] : 0
      node.gain.value = Math.max(-12, Math.min(12, g))
    })
  }

  disableEq() {
    this._eqEnabled = false
  }

  setGapless(on) {
    this._gapless = on
    if (!on) { this._preloadAudio.pause(); this._preloadAudio.src = '' }
  }

  _checkPreload() {
    if (!this._gapless) return
    const dur = this.audio.duration
    if (!dur || dur <= 0) return
    const timeLeft = dur - this.audio.currentTime
    if (timeLeft > 0 && timeLeft < 8 && !this._preloading) this._preloadNext()
  }

  _preloadNext() {
    let nextIdx = this.shuffle ? Math.floor(Math.random() * this.queue.length) : this.currentIndex + 1
    if (nextIdx >= this.queue.length) nextIdx = this.repeat ? 0 : -1
    if (nextIdx < 0 || nextIdx >= this.queue.length) return
    const nextTrack = this.queue[nextIdx]
    if (!nextTrack?.streamUrl || this._preloadAudio.src === nextTrack.streamUrl) return
    this._preloading = true
    this._preloadAudio.src = nextTrack.streamUrl
    this._preloadAudio.load()
  }

  _scheduleSave() {
    if (this._saveTimer) return
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null
      this._saveState()
    }, 5000)
  }

  _saveState() {
    try {
      const state = this.getState()
      if (!state.queue.length) return
      const data = {
        queue: state.queue.map(t => ({
          id: t.id,
          title: t.title,
          name: t.name,
          artist: t.artist,
          artist_name: t.artist_name,
          albumArtist: t.albumArtist,
          album: t.album,
          albumName: t.albumName,
          duration: t.duration,
          track: t.track,
          coverArt: t.coverArt,
          streamUrl: t.streamUrl,
          coverUrl: t.coverUrl
        })),
        currentIndex: state.currentIndex,
        currentTime: state.currentTime,
        playing: state.playing,
        repeat: state.repeat,
        shuffle: state.shuffle,
        volume: state.volume,
        timestamp: Date.now()
      }
      localStorage.setItem('fynix_playback_state', JSON.stringify(data))
    } catch (_) {}
  }

  _restoreState() {
    try {
      const raw = localStorage.getItem('fynix_playback_state')
      if (!raw) return
      const data = JSON.parse(raw)
      if (!data.queue || !data.queue.length) return
      const age = Date.now() - (data.timestamp || 0)
      if (age > 86400000) return // discard after 24h
      this.queue = data.queue
      this.currentIndex = data.currentIndex >= 0 && data.currentIndex < data.queue.length ? data.currentIndex : 0
      this.repeat = data.repeat || false
      this.shuffle = data.shuffle || false
      if (data.volume !== undefined) this.audio.volume = data.volume
      this._restored = true
      this._restoredPlaying = !!data.playing
      this._savedCurrentTime = data.currentTime || 0
    } catch (_) {}
  }

  on(event, fn) {
    ;(this.listeners[event] ||= []).push(fn)
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data))
  }

  getState() {
    const track = this.queue[this.currentIndex] || null
    return {
      currentTrack: track,
      queue: this.queue,
      currentIndex: this.currentIndex,
      playing: !this.audio.paused,
      currentTime: this.audio.currentTime,
      duration: this.audio.duration || 0,
      trackDuration: track?.duration || 0,
      volume: this.audio.volume,
      repeat: this.repeat,
      shuffle: this.shuffle
    }
  }

  playTrack(track, tracks = null) {
    if (tracks) {
      this.queue = tracks
      this.currentIndex = tracks.indexOf(track)
    } else {
      if (!this.queue.length || this.queue[this.currentIndex]?.id !== track.id) {
        const idx = this.queue.findIndex(t => t.id === track.id)
        if (idx >= 0) {
          this.currentIndex = idx
        } else {
          this.queue.push(track)
          this.currentIndex = this.queue.length - 1
        }
      }
    }
    this._loadCurrent()
  }

  playQueue(tracks, startIndex = 0) {
    this.queue = [...tracks]
    this.currentIndex = startIndex
    this._restored = false
    this._loadCurrent()
  }

  _loadCurrent(autoplay = true) {
    const track = this.queue[this.currentIndex]
    if (!track) return
    this.audio.src = track.streamUrl || ''
    this.audio.load()
    if (autoplay) {
      this.audio.play().catch(() => {})
    }
    if (this._restored) {
      this._restored = false
      const savedTime = this._savedCurrentTime || 0
      if (savedTime > 0) {
        const trySeek = () => {
          if (this.audio.readyState >= 2 || this.audio.duration > 0) {
            this.audio.currentTime = Math.min(savedTime, this.audio.duration - 1 || savedTime)
          } else {
            requestAnimationFrame(trySeek)
          }
        }
        setTimeout(trySeek, 200)
      }
      delete this._savedCurrentTime
    }
  }

  togglePlay() {
    if (this.audio.paused) {
      if (this.audio.src) {
        this.audio.play().catch(() => {})
      } else if (this.queue.length) {
        this._loadCurrent()
      }
    } else {
      this.audio.pause()
    }
  }

  seek(time) {
    this.audio.currentTime = time
  }

  setVolume(v) {
    if (this._fading) return
    this.audio.volume = Math.max(0, Math.min(1, v))
    this._savedVolume = this.audio.volume
  }

  setCrossfade(seconds) {
    this.crossfade = Math.max(0, Math.min(10, seconds))
  }

  _fadeOut(callback) {
    const dur = this.crossfade
    if (dur <= 0 || this.audio.volume <= 0) { callback(); return }
    this._fading = true
    const startVol = this.audio.volume
    const startTime = performance.now()
    const step = () => {
      const elapsed = (performance.now() - startTime) / 1000
      const pct = Math.min(elapsed / dur, 1)
      this.audio.volume = Math.max(0, startVol * (1 - pct))
      if (pct < 1) {
        requestAnimationFrame(step)
      } else {
        this.audio.volume = 0
        this._fading = false
        callback()
      }
    }
    requestAnimationFrame(step)
  }

  _fadeIn() {
    const dur = this.crossfade
    if (dur <= 0) { this.audio.volume = this._savedVolume; return }
    const target = this._savedVolume
    this.audio.volume = 0
    const startTime = performance.now()
    const step = () => {
      const elapsed = (performance.now() - startTime) / 1000
      const pct = Math.min(elapsed / dur, 1)
      this.audio.volume = target * pct
      if (pct < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  next() {
    if (this.shuffle) {
      this.currentIndex = Math.floor(Math.random() * this.queue.length)
    } else {
      this.currentIndex++
      if (this.currentIndex >= this.queue.length) {
        this.currentIndex = this.repeat ? 0 : -1
      }
    }
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      this._fadeOut(() => { this._loadCurrent(); this._fadeIn() })
    } else {
      this._fadeOut(() => { this.audio.pause(); this.audio.src = '' })
    }
  }

  prev() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0
      return
    }
    this.currentIndex--
    if (this.currentIndex < 0) {
      this.currentIndex = this.repeat ? this.queue.length - 1 : 0
    }
    this._fadeOut(() => { this._loadCurrent(); this._fadeIn() })
  }

  _onEnded() {
    if (this.crossfade > 0 && this.currentIndex + 1 < this.queue.length) {
      this.next()
    } else {
      this.next()
    }
  }

  toggleRepeat() {
    this.repeat = !this.repeat
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle
  }

  addToQueue(track) {
    this.queue.push(track)
  }

  playNext(track) {
    this.queue.splice(this.currentIndex + 1, 0, track)
  }

  clearQueue() {
    this.queue = []
    this.currentIndex = -1
    this.audio.pause()
    this.audio.src = ''
  }

  removeFromQueue(index) {
    if (index === this.currentIndex) {
      this.next()
    }
    this.queue.splice(index, 1)
    if (index < this.currentIndex) this.currentIndex--
  }

  moveInQueue(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const [item] = this.queue.splice(fromIdx, 1)
    this.queue.splice(toIdx, 0, item)
    if (this.currentIndex === fromIdx) {
      this.currentIndex = toIdx
    } else {
      if (fromIdx < this.currentIndex && toIdx >= this.currentIndex) this.currentIndex--
      else if (fromIdx > this.currentIndex && toIdx <= this.currentIndex) this.currentIndex++
    }
  }

  formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
}

window.MusicPlayer = MusicPlayer
