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
    private var equalizer: android.media.audiofx.Equalizer? = null
    private var eqEnabled = false
    private var eqGains: FloatArray? = null

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

    fun playStream(id: String, streamUrl: String, title: String, artist: String, album: String, coverUrl: String, duration: Int) {
        val ctx = appContext ?: return
        val player = exoPlayer
        if (player == null) {
            Log.e("Fynix", "ExoPlayerHolder: not initialized")
            return
        }
        currentStreamId = id
        val coverArtUrl = if (coverUrl.startsWith("http")) coverUrl else {
            if (coverUrl.isNotBlank()) navidrome?.coverUrl(coverUrl, 300) ?: "" else ""
        }
        AudioService.updateNowPlaying(
            ctx,
            title = title,
            artist = artist,
            album = album,
            coverArt = coverArtUrl,
            duration = duration,
            mediaId = id
        )
        val mediaItem = MediaItem.fromUri(streamUrl)
        handler.post {
            player.stop()
            player.clearMediaItems()
            player.setMediaItem(mediaItem)
            player.prepare()
            player.play()
            initEqualizer()
            Log.d("Fynix", "ExoPlayerHolder: playing id=$id url=$streamUrl")
        }
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
                val streamUrl = n.streamUrl(songId)
                var title = ""
                var artist = ""
                var album = ""
                var coverArt = ""
                var duration = 0
                when (parentType) {
                    "album" -> {
                        val (albumData, songs) = n.getAlbum(parentId)
                        val song = songs.find { it.id == songId }
                        if (song != null) {
                            title = song.title; artist = song.artist
                            album = song.album; coverArt = song.coverArt; duration = song.duration
                        }
                        albumData?.let { if (coverArt.isBlank()) coverArt = it.coverArt }
                    }
                    "playlist" -> {
                        val songs = n.getPlaylist(parentId)
                        val song = songs.find { it.id == songId }
                        if (song != null) {
                            title = song.title; artist = song.artist
                            album = song.album; coverArt = song.coverArt; duration = song.duration
                        }
                    }
                    else -> {
                        val song = n.getSong(songId)
                        if (song != null) {
                            title = song.title; artist = song.artist
                            album = song.album; coverArt = song.coverArt; duration = song.duration
                        }
                    }
                }
                val coverUrl = if (coverArt.isNotBlank()) n.coverUrl(coverArt, 300) else ""
                withContext(Dispatchers.Main) {
                    playStream(songId, streamUrl, title, artist, album, coverUrl, duration)
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
        handler.post { exoPlayer?.volume = vol }
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
