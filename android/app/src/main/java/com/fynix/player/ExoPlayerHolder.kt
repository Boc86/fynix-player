package com.fynix.player

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
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
            exoPlayer?.release()
            exoPlayer = null
        }
        Log.d("Fynix", "ExoPlayerHolder: released")
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
