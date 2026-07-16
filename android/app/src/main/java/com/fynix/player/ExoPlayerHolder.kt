package com.fynix.player

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

object ExoPlayerHolder {
    private var exoPlayer: ExoPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var positionRunnable: Runnable? = null
    private var appContext: Context? = null
    private var navidrome: NavidromeClient? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    var onPositionUpdate: ((Long, Long) -> Unit)? = null
    var onPlayStateChange: ((Boolean) -> Unit)? = null
    var onTrackEnded: (() -> Unit)? = null
    var onTrackError: ((String) -> Unit)? = null

    private var currentStreamId = ""
    private var queueMetas: List<SongMeta> = emptyList()
    private var equalizer: android.media.audiofx.Equalizer? = null
    private var eqEnabled = false
    private var eqGains: FloatArray? = null
    private var _userVolume: Float = 1f
    /** Signatures of recent queue builds used to dedupe noisy JS pushes. */
    private var lastQueueSig: String? = null
    private var lastQueueIndex: Int = -1

    fun initialize(ctx: Context) {
        if (exoPlayer != null) return
        appContext = ctx.applicationContext
        navidrome = createNavidromeClient(ctx)
        exoPlayer = ExoPlayer.Builder(ctx.applicationContext).build().apply {
            addListener(playerListener)
            playWhenReady = true
            setAudioAttributes(
                AudioAttributes.Builder().setContentType(2).setUsage(1).build(),
                true
            )
        }
        loadEqPrefs()
        Log.d("Fynix", "ExoPlayerHolder: initialized")
    }

    fun isInitialized(): Boolean = exoPlayer != null

    fun playStream(id: String, streamUrl: String, title: String, artist: String, album: String, coverUrl: String, duration: Int, replayGain: Float = 0f) {
        val item = MediaItem.fromUri(streamUrl)
        val singMeta = SongMeta(id, title, artist, album, coverUrl, duration, replayGain)
        playMediaItems(listOf(item), 0, singMeta)
    }

    /**
     * Build an ExoPlayer playlist from the JS-side queue. Used when the JS player has
     * the authoritative queue (in-app taps, search, random, etc.); the queue is pushed
     * to the native player so the Android Auto MediaSession and Auto queue reflect the
     * full song list rather than a single MediaItem.
     */
    fun playQueueFromJs(queueJson: String) {
        Log.d("Fynix", "playQueueFromJs invoked, payload bytes=${queueJson.length}")
        scope.launch {
            try {
                val obj = org.json.JSONObject(queueJson)
                val tracksArr = obj.optJSONArray("tracks") ?: return@launch
                val startIndex = obj.optInt("currentIndex", obj.optInt("startIndex", 0))
                if (tracksArr.length() == 0) return@launch
                val items = ArrayList<MediaItem>(tracksArr.length())
                val metas = ArrayList<SongMeta>(tracksArr.length())
                for (i in 0 until tracksArr.length()) {
                    val t = tracksArr.optJSONObject(i) ?: continue
                    val id = t.optString("id", "")
                    val streamUrl = t.optString("streamUrl", "")
                    if (id.isBlank() || streamUrl.isBlank()) continue
                    val title = t.optString("title", t.optString("name", "Unknown"))
                    val artist = t.optString("artist", t.optString("artist_name", ""))
                    val album = t.optString("album", t.optString("albumName", ""))
                    val coverUrl = t.optString("coverUrl", t.optString("coverArt", ""))
                    val duration = t.optInt("duration", 0)
                    val replayGain = t.optDouble("replayGain", 0.0).toFloat()
                    items.add(MediaItem.fromUri(streamUrl))
                    metas.add(SongMeta(id, title, artist, album, coverUrl, duration, replayGain))
                }
                if (items.isEmpty()) return@launch
                val startIdx = startIndex.coerceIn(0, items.size - 1)
                val meta = metas[startIdx]
                withContext(Dispatchers.Main) {
                    playMediaItems(items, startIdx, meta, metas)
                }
            } catch (e: Exception) {
                Log.e("Fynix", "ExoPlayerHolder: playQueueFromJs error: ${e.message}")
            }
        }
    }

    private data class SongMeta(
        val id: String,
        val title: String,
        val artist: String,
        val album: String,
        val coverUrl: String,
        val duration: Int,
        val replayGain: Float = 0f
    )

    private fun playMediaItems(items: List<MediaItem>, startIndex: Int, nowPlaying: SongMeta, allMetas: List<SongMeta>? = null) {
        val ctx = appContext ?: return
        val player = exoPlayer
        if (player == null) {
            Log.e("Fynix", "ExoPlayerHolder: not initialized")
            return
        }
        if (items.isEmpty()) return
        currentStreamId = nowPlaying.id
        queueMetas = allMetas ?: listOf(nowPlaying)
        val coverArtUrl = if (nowPlaying.coverUrl.startsWith("http")) nowPlaying.coverUrl else {
            if (nowPlaying.coverUrl.isNotBlank()) navidrome?.coverUrl(nowPlaying.coverUrl, 300) ?: "" else ""
        }
        AudioService.updateNowPlaying(
            ctx,
            title = nowPlaying.title,
            artist = nowPlaying.artist,
            album = nowPlaying.album,
            coverArt = coverArtUrl,
            duration = nowPlaying.duration,
            mediaId = nowPlaying.id
        )
        val startIdx = startIndex.coerceIn(0, items.size - 1)
        handler.post {
            val signature = computeQueueSignature(items, startIdx)
            val sameQueue = signature.first == lastQueueSig
            val onlyAdvanced = signature.first == lastQueueSig &&
                exoPlayer?.mediaItemCount == items.size &&
                exoPlayer?.currentMediaItemIndex == startIdx
            if (sameQueue && exoPlayer?.mediaItemCount == items.size) {
                // The JS-side queue didn't change in shape. Just seek to the right
                // MediaItem position to avoid re-buffering the whole playlist.
                if (exoPlayer?.currentMediaItemIndex != startIdx) {
                    exoPlayer?.seekTo(startIdx, 0L)
                }
                exoPlayer?.playWhenReady = true
                Log.d(
                    "Fynix",
                    "ExoPlayerHolder: queue unchanged, skip reload, seek idx=$startIdx (sig=${signature.first.length})"
                )
                return@post
            }
            lastQueueSig = signature.first
            lastQueueIndex = startIdx
            player.stop()
            player.clearMediaItems()
            player.setMediaItems(items, startIdx, 0L)
            player.prepare()
            player.play()
            applyReplayGain(nowPlaying)
            initEqualizer()
            Log.d(
                "Fynix",
                "ExoPlayerHolder: playMediaItems id=${nowPlaying.id} queue=${items.size} start=$startIdx sig=${signature.first.length} hash=${signature.second}"
            )
        }
    }

    private fun computeQueueSignature(items: List<MediaItem>, startIndex: Int): Pair<String, Int> {
        // sig ignores startIndex so queue rebuilds only happen when item URIs change
        val sb = StringBuilder()
        for (i in items.indices) {
            if (i > 0) sb.append('|')
            sb.append(items[i].localConfiguration?.uri ?: "")
        }
        var h = 0
        for (c in sb) h = (h * 31 + c.code) and 0x7FFFFFFF
        return sb.toString() to h
    }

    fun handlePlayMediaId(mediaId: String) {
        Log.d("Fynix", "ExoPlayerHolder.handlePlayMediaId: $mediaId")
        val delim = mediaId.indexOf('|')
        val (songId, parentType, parentId) = if (delim >= 0) {
            val sid = mediaId.substring(0, delim)
            val parent = mediaId.substring(delim + 1)
            val colon = parent.indexOf(':')
            val pt = if (colon > 0) parent.substring(0, colon) else ""
            val pi = if (colon > 0) parent.substring(colon + 1) else ""
            Triple(sid, pt, pi)
        } else {
            Triple(mediaId, "", "")
        }
        scope.launch {
            try {
                val n = navidrome ?: return@launch
                if (!n.isConfigured()) {
                    Log.e("Fynix", "ExoPlayerHolder: navidrome not configured")
                    return@launch
                }
                var nowPlaying: SongMeta? = null
                var startIndex = 0
                val items: List<MediaItem> = when (parentType) {
                    "album" -> {
                        val (albumData, songs) = n.getAlbum(parentId)
                        songs.forEachIndexed { idx, s ->
                            if (s.id == songId) {
                                startIndex = idx
                                nowPlaying = SongMeta(
                                    s.id, s.title, s.artist, s.album,
                                    s.coverArt.ifBlank { albumData?.coverArt ?: "" },
                                    s.duration, s.replayGain
                                )
                            }
                        }
                        songs.map { s -> MediaItem.fromUri(n.streamUrl(s.id)) }
                    }
                    "playlist" -> {
                        val songs = n.getPlaylist(parentId)
                        songs.forEachIndexed { idx, s ->
                            if (s.id == songId) {
                                startIndex = idx
                                nowPlaying = SongMeta(
                                    s.id, s.title, s.artist, s.album,
                                    s.coverArt, s.duration, s.replayGain
                                )
                            }
                        }
                        songs.map { s -> MediaItem.fromUri(n.streamUrl(s.id)) }
                    }
                    else -> {
                        val song = n.getSong(songId)
                        if (song != null) {
                            nowPlaying = SongMeta(
                                song.id, song.title, song.artist, song.album,
                                song.coverArt, song.duration, song.replayGain
                            )
                            listOf(MediaItem.fromUri(n.streamUrl(songId)))
                        } else {
                            Log.e("Fynix", "ExoPlayerHolder: cannot resolve songId=$songId")
                            return@launch
                        }
                    }
                }
                val meta = nowPlaying ?: run {
                    Log.e("Fynix", "ExoPlayerHolder: selected song not found in $parentType=$parentId songId=$songId")
                    return@launch
                }
                val coverUrl = if (meta.coverUrl.isNotBlank()) n.coverUrl(meta.coverUrl, 300) else ""
                val resolved = meta.copy(coverUrl = coverUrl)
                withContext(Dispatchers.Main) {
                    playMediaItems(items, startIndex, resolved)
                }
            } catch (e: Exception) {
                Log.e("Fynix", "ExoPlayerHolder: handlePlayMediaId error: ${e.message}")
            }
        }
    }

    fun togglePlay() {
        handler.post {
            val player = exoPlayer ?: return@post
            if (player.isPlaying) {
                player.pause()
            } else {
                player.play()
            }
        }
    }

    fun seekTo(positionMs: Long) {
        handler.post { exoPlayer?.seekTo(positionMs) }
    }

    fun setVolume(vol: Float) {
        _userVolume = vol
        handler.post {
            val meta = if (currentStreamId.isNotEmpty()) queueMetas.getOrNull(exoPlayer?.currentMediaItemIndex ?: 0) else null
            val gain = meta?.replayGain ?: 0f
            val effective = if (gain != 0f) (vol * Math.pow(10.0, gain.toDouble() / 20.0)).toFloat().coerceIn(0f, 1f) else vol
            exoPlayer?.volume = effective
        }
    }

    private fun applyReplayGain(meta: SongMeta?) {
        if (meta == null || meta.replayGain == 0f) {
            exoPlayer?.volume = _userVolume
            return
        }
        val gainLinear = Math.pow(10.0, meta.replayGain.toDouble() / 20.0).toFloat()
        val effective = (_userVolume * gainLinear).coerceIn(0f, 1f)
        exoPlayer?.volume = effective
    }

    fun pause() {
        handler.post { exoPlayer?.pause() }
    }

    fun resume() {
        handler.post {
            val player = exoPlayer ?: return@post
            if (!player.isPlaying) player.play()
        }
    }

    fun stopPlayback() {
        handler.post {
            exoPlayer?.stop()
            exoPlayer?.clearMediaItems()
        }
    }

    fun release() {
        stopPositionUpdates()
        handler.post {
            equalizer?.release()
            equalizer = null
            exoPlayer?.release()
            exoPlayer = null
        }
        Log.d("Fynix", "ExoPlayerHolder: released")
    }

    fun initEqualizer() {
        val player = exoPlayer ?: return
        try {
            equalizer?.release()
            equalizer = android.media.audiofx.Equalizer(0, player.audioSessionId).apply {
                enabled = eqEnabled
                if (eqGains != null) {
                    val numBands = numberOfBands.toInt()
                    for (i in 0 until minOf(numBands, eqGains!!.size)) {
                        val millibels = (eqGains!![i] * 100).toInt().coerceIn(-1500, 1500).toShort()
                        setBandLevel(i.toShort(), millibels)
                    }
                }
                Log.d("Fynix", "ExoPlayerHolder: equalizer initialized, bands=${numberOfBands} enabled=$eqEnabled")
            }
        } catch (e: Exception) {
            Log.e("Fynix", "ExoPlayerHolder: initEqualizer error: ${e.message}")
        }
    }

    fun setEqEnabled(enabled: Boolean) {
        eqEnabled = enabled
        handler.post { equalizer?.enabled = enabled }
        saveEqPrefs()
    }

    fun setEqGains(gains: FloatArray) {
        eqGains = gains
        eqEnabled = true
        handler.post {
            val eq = equalizer ?: return@post
            val numBands = eq.numberOfBands.toInt()
            for (i in 0 until minOf(numBands, gains.size)) {
                val millibels = (gains[i] * 100).toInt().coerceIn(-1500, 1500).toShort()
                try { eq.setBandLevel(i.toShort(), millibels) } catch (_: Exception) {}
            }
            eq.enabled = true
        }
        saveEqPrefs()
    }

    fun getEqInfo(): String {
        val eq = equalizer
        if (eq == null) return """{"bands":[],"enabled":false,"gains":[],"bandLevelRange":[-15,15]}"""
        return try {
            val numBands = eq.numberOfBands.toInt()
            val bands = JSONArray()
            val gainsArr = JSONArray()
            for (i in 0 until numBands) {
                val centerHz = eq.getCenterFreq(i.toShort()) / 1000f
                bands.put(JSONObject().apply {
                    put("index", i)
                    put("frequency", centerHz.toInt())
                })
                gainsArr.put(eq.getBandLevel(i.toShort()) / 100f)
            }
            val range = eq.bandLevelRange
            val minDb = (if (range.size > 0) range[0] else -1500) / 100f
            val maxDb = (if (range.size > 1) range[1] else 1500) / 100f
            JSONObject().apply {
                put("bands", bands)
                put("enabled", eqEnabled)
                put("gains", gainsArr)
                put("bandLevelRange", JSONArray(listOf(minDb, maxDb)))
            }.toString()
        } catch (e: Exception) {
            Log.e("Fynix", "ExoPlayerHolder: getEqInfo error: ${e.message}")
            """{"bands":[],"enabled":false,"gains":[],"bandLevelRange":[-15,15]}"""
        }
    }

    private fun loadEqPrefs() {
        val prefs = appContext?.getSharedPreferences("fynix_eq", Context.MODE_PRIVATE) ?: return
        eqEnabled = prefs.getBoolean("eq_enabled", false)
        val gainsStr = prefs.getString("eq_gains", null)
        if (gainsStr != null) {
            eqGains = gainsStr.split(",").mapNotNull { it.toFloatOrNull() }.toFloatArray()
        }
    }

    private fun saveEqPrefs() {
        val prefs = appContext?.getSharedPreferences("fynix_eq", Context.MODE_PRIVATE) ?: return
        prefs.edit().apply {
            putBoolean("eq_enabled", eqEnabled)
            if (eqGains != null) {
                putString("eq_gains", eqGains!!.joinToString(","))
            } else {
                remove("eq_gains")
            }
            apply()
        }
    }

    private fun startPositionUpdates() {
        stopPositionUpdates()
        positionRunnable = object : Runnable {
            override fun run() {
                val p = exoPlayer ?: return
                val pos = p.currentPosition
                val dur = if (p.duration > 0) p.duration else 0L
                if (pos >= 0) {
                    onPositionUpdate?.invoke(pos, dur)
                    AudioService.updatePosition(pos)
                }
                handler.postDelayed(this, 250)
            }
        }
        handler.post(positionRunnable!!)
    }

    private fun stopPositionUpdates() {
        positionRunnable?.let { handler.removeCallbacks(it) }
        positionRunnable = null
    }

    /**
     * Callback fired when ExoPlayer's auto-advance moves to the next MediaItem
     * (only set when using a native playlist, not single-item playback).
     */
    var onMediaItemTransition: ((positionMs: Long, durationMs: Long, mediaIndex: Int) -> Unit)? = null

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            Log.d("Fynix", "ExoPlayerHolder: isPlaying=$isPlaying")
            val ctx = appContext ?: return
            AudioService.setPlaying(ctx, isPlaying)
            onPlayStateChange?.invoke(isPlaying)
            if (isPlaying) startPositionUpdates()
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            when (playbackState) {
                Player.STATE_READY -> {
                    Log.d("Fynix", "ExoPlayerHolder: STATE_READY")
                    AudioService.updateMetadata()
                    if (exoPlayer?.isPlaying == true) startPositionUpdates()
                }
                Player.STATE_ENDED -> {
                    Log.d("Fynix", "ExoPlayerHolder: STATE_ENDED")
                    stopPositionUpdates()
                    onTrackEnded?.invoke()
                }
            }
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            // ExoPlayer auto-advanced to a new MediaItem in the native playlist.
            // Push the new position to the JS-side state so the UI follows along.
            val p = exoPlayer ?: return
            val pos = p.currentPosition
            val dur = if (p.duration > 0) p.duration else 0L
            val idx = p.currentMediaItemIndex
            Log.d("Fynix", "ExoPlayerHolder: mediaItemTransition idx=$idx pos=$pos")
            // Update notification/media session metadata for the new track
            if (idx in queueMetas.indices) {
                val meta = queueMetas[idx]
                applyReplayGain(meta)
                val ctx = appContext ?: return
                val coverUrl = if (meta.coverUrl.startsWith("http")) meta.coverUrl else {
                    if (meta.coverUrl.isNotBlank()) navidrome?.coverUrl(meta.coverUrl, 300) ?: "" else ""
                }
                AudioService.updateNowPlaying(
                    ctx,
                    title = meta.title,
                    artist = meta.artist,
                    album = meta.album,
                    coverArt = coverUrl,
                    duration = meta.duration,
                    mediaId = meta.id
                )
            }
            onMediaItemTransition?.invoke(pos, dur, idx)
        }

        override fun onPlayerError(error: PlaybackException) {
            Log.e("Fynix", "ExoPlayerHolder: error=${error.message}")
            onTrackError?.invoke(error.message ?: "Playback error")
        }
    }

    private fun createNavidromeClient(ctx: Context): NavidromeClient {
        val prefs = ctx.getSharedPreferences("fynix_settings", Context.MODE_PRIVATE)
        return NavidromeClient(
            server = prefs.getString("navidrome_server", "") ?: "",
            username = prefs.getString("navidrome_username", "") ?: "",
            password = prefs.getString("navidrome_password", "") ?: ""
        )
    }
}
