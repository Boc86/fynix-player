class MusicPlayer {
  constructor() {
    this.audio = new Audio()
    this.audio.crossOrigin = 'anonymous'
    this.queue = []
    this.currentIndex = -1
    this.repeat = false
    this.shuffle = false
    this.listeners = {}

    this.audio.addEventListener('timeupdate', () => this._emit('timeupdate', this.getState()))
    this.audio.addEventListener('ended', () => this._onEnded())
    this.audio.addEventListener('loadedmetadata', () => this._emit('loaded', this.getState()))
    this.audio.addEventListener('play', () => this._emit('play', this.getState()))
    this.audio.addEventListener('pause', () => this._emit('pause', this.getState()))
    this.audio.addEventListener('error', (e) => this._emit('error', e))
  }

  on(event, fn) {
    ;(this.listeners[event] ||= []).push(fn)
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data))
  }

  getState() {
    return {
      currentTrack: this.queue[this.currentIndex] || null,
      queue: this.queue,
      currentIndex: this.currentIndex,
      playing: !this.audio.paused,
      currentTime: this.audio.currentTime,
      duration: this.audio.duration || 0,
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
    this._loadCurrent()
  }

  _loadCurrent() {
    const track = this.queue[this.currentIndex]
    if (!track) return
    this.audio.src = track.streamUrl || ''
    this.audio.load()
    this.audio.play().catch(() => {})
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
    this.audio.volume = Math.max(0, Math.min(1, v))
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
      this._loadCurrent()
    } else {
      this.audio.pause()
      this.audio.src = ''
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
    this._loadCurrent()
  }

  _onEnded() {
    this.next()
  }

  toggleRepeat() {
    this.repeat = !this.repeat
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle
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

  formatTime(seconds) {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
}

window.MusicPlayer = MusicPlayer
