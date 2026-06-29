package com.fynix.player

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.AudioManager
import android.os.Build
import android.util.Log
import android.os.Bundle
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import java.net.URL

class AudioService : android.app.Service() {

    companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "fynix_playback"
        const val EXTRA_ACTION = "media_action"
        const val ACTION_PLAY = "play"
        const val ACTION_PAUSE = "pause"
        const val ACTION_TOGGLE = "toggle"
        const val ACTION_NEXT = "next"
        const val ACTION_PREV = "prev"
        const val ACTION_PLAY_MEDIA = "play_media"
        const val ACTION_SEARCH = "search"
        const val ACTION_SHUFFLE_ALL = "shuffle_all"

        private var instance: AudioService? = null
        private var playPendingIntent: PendingIntent? = null
        private var currentTitle = ""
        private var currentArtist = ""
        private var currentAlbum = ""
        private var currentCoverUrl = ""
        private var currentCoverBitmap: Bitmap? = null
        private var currentDuration = 0
        private var currentPosition = 0L
        private var isCurrentlyPlaying = false
        private var currentMediaId = ""
        private var currentTrackNumber = 0
        private var currentAlbumArtist = ""
        fun updateNowPlaying(ctx: Context, title: String, artist: String, album: String, coverArt: String, duration: Int, mediaId: String = "", trackNumber: Int = 0, albumArtist: String = "") {
            currentTitle = title
            currentArtist = artist
            currentAlbum = album
            currentCoverUrl = coverArt
            currentDuration = duration
            currentTrackNumber = trackNumber
            currentAlbumArtist = albumArtist
            val trackChanged = mediaId != currentMediaId
            currentMediaId = mediaId
            instance?.let { srv ->
                if (trackChanged) {
                    currentCoverBitmap = null
                    srv.fetchCoverBitmap()
                } else {
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        srv.updateNotification()
                    }
                }
            }
        }

        fun updatePosition(pos: Long) {
            currentPosition = pos
            instance?.updateMediaSessionState()
        }

        fun setPlaying(ctx: Context, playing: Boolean) {
            isCurrentlyPlaying = playing
            instance?.updateMediaSessionState()
            instance?.updateNotification()
            if (playing) {
                val intent = Intent(ctx, AudioService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ctx.startForegroundService(intent)
                } else {
                    ctx.startService(intent)
                }
            }
        }

        fun updateMetadata() {
            val builder = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, currentCoverUrl)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDuration.toLong() * 1000L)
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, currentMediaId)
                .putLong(MediaMetadataCompat.METADATA_KEY_TRACK_NUMBER, currentTrackNumber.toLong())
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ARTIST, currentAlbumArtist.ifEmpty { currentArtist })
            currentCoverBitmap?.let { builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it) }
            Log.d("Fynix", "updateMetadata: title=$currentTitle artist=$currentArtist album=$currentAlbum duration=${currentDuration}s hasBitmap=${currentCoverBitmap != null} artUri=$currentCoverUrl")
            MediaSessionHolder.session?.setMetadata(builder.build())
        }
    }

    private lateinit var mediaSession: MediaSessionCompat
    private var noisyReceiver: BroadcastReceiver? = null
    private var audioManager: AudioManager? = null
    private var audioFocusListener: AudioManager.OnAudioFocusChangeListener? = null
    private var debugReceiver: BroadcastReceiver? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        createChannel()
        ExoPlayerHolder.initialize(this)
        setupMediaSession()
        registerNoisyReceiver()
        setupAudioFocus()
        registerDebugReceiver()
        startForeground(NOTIFICATION_ID, buildNotification())
        startCoverArtServer()
    }

    private fun startCoverArtServer() {
        if (CoverArtServerHolder.server == null) {
            val srv = CoverArtServer(this)
            srv.start()
            CoverArtServerHolder.server = srv
            CoverArtServerHolder.port = srv.port
            Log.d("Fynix", "CoverArtServer started on port ${srv.port}")
        }
    }

    private fun setupAudioFocus() {
        // Audio focus handled by ExoPlayer's AudioAttributes configuration
    }

    private fun createChannel() {
        val channel = NotificationChannel(CHANNEL_ID, "Fynix Playback", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Music playback controls"
            setShowBadge(false)
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(channel)
    }

    private fun setupMediaSession() {
        mediaSession = MediaSessionHolder.session ?: MediaSessionCompat(this, "FynixMediaSession")
        if (MediaSessionHolder.session == null) {
            MediaSessionHolder.session = mediaSession
        }
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS or
            MediaSessionCompat.FLAG_HANDLES_QUEUE_COMMANDS
        )
        mediaSession.setSessionActivity(
            PendingIntent.getActivity(this, 0,
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )
        mediaSession.setCallback(object : MediaSessionCompat.Callback() {
            override fun onPlay() { dispatchAction(ACTION_PLAY) }
            override fun onPause() { dispatchAction(ACTION_PAUSE) }
            override fun onStop() { dispatchAction(ACTION_PAUSE) }
            override fun onSkipToNext() { dispatchAction(ACTION_NEXT) }
            override fun onSkipToPrevious() { dispatchAction(ACTION_PREV) }
            override fun onPlayFromMediaId(mediaId: String, extras: Bundle?) {
                Log.d("Fynix", "onPlayFromMediaId: mediaId=$mediaId")
                if (mediaId == "shuffle_all") {
                    dispatchAction(ACTION_SHUFFLE_ALL)
                    return
                }
                val (songId, parentType, parentId) = parseMediaIdForAuto(mediaId)
                Log.d("Fynix", "onPlayFromMediaId parsed: song=$songId type=$parentType pid=$parentId")
                // Route through MainActivity's playMediaCallback so the JS-side queue
                // gets populated identically to in-app taps. This keeps JS_player.queue
                // and ExoPlayer's media items in lock-step so "Next" advances within
                // the same playlist the user just opened (not a stale shuffled queue).
                val cb = MainActivity.playMediaCallback
                if (cb != null) {
                    try {
                        cb(songId, parentType, parentId)
                    } catch (e: Exception) {
                        Log.e("Fynix", "onPlayFromMediaId: playMediaCallback threw: ${e.message}")
                        // Fallback to native path so audio still starts
                        ExoPlayerHolder.handlePlayMediaId(mediaId)
                    }
                } else {
                    // Activity not yet bound; persist so checkPendingFromPrefs fires
                    // window.playMediaId(…) once MainActivity binds.
                    getSharedPreferences("fynix_playback", MODE_PRIVATE).edit().apply {
                        putString("pending_media_id", mediaId)
                        putString("pending_parent_type", parentType)
                        putString("pending_parent_id", parentId)
                        apply()
                    }
                    Log.d("Fynix", "onPlayFromMediaId: saved pending mid=$mediaId")
                }
            }
            override fun onPlayFromSearch(query: String, extras: Bundle?) {
                val cb = MainActivity.mediaActionCallback
                if (cb != null) {
                    cb("search:$query")
                }
            }
        })
        mediaSession.isActive = true
        updateMediaSessionState()
    }

    /**
     * Parse an AA MediaSession mediaId of the form
     *   "<songId>|album:<albumId>"
     *   "<songId>|playlist:<playlistId>"
     *   "<songId>" (plain track)
     * into (songId, parentType, parentId).
     */
    private fun parseMediaIdForAuto(mediaId: String): Triple<String, String, String> {
        val delim = mediaId.indexOf('|')
        if (delim < 0) return Triple(mediaId, "", "")
        val songId = mediaId.substring(0, delim)
        val parent = mediaId.substring(delim + 1)
        val colon = parent.indexOf(':')
        return if (colon > 0) {
            Triple(songId, parent.substring(0, colon), parent.substring(colon + 1))
        } else {
            Triple(songId, "", "")
        }
    }

    private fun dispatchAction(action: String) {
        val cb = MainActivity.mediaActionCallback
        if (cb != null) {
            cb(action)
        } else {
            getSharedPreferences("fynix_playback", MODE_PRIVATE).edit().apply {
                putString("pending_action", action)
                apply()
            }
            try {
                val pi = PendingIntent.getActivity(this, action.hashCode() and 0xFFFF,
                    Intent(this, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra(EXTRA_ACTION, action)
                    },
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                pi.send()
            } catch (e: Exception) {
                Log.e("Fynix", "dispatchAction PendingIntent.send failed: ${e.message}")
            }
        }
    }

    private fun registerNoisyReceiver() {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                    dispatchAction(ACTION_PAUSE)
                }
            }
        }
        registerReceiver(receiver, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
        noisyReceiver = receiver
    }

    private fun fetchCoverBitmap() {
        val coverUrl = currentCoverUrl
        val targetMediaId = currentMediaId
        Log.d("Fynix", "fetchCoverBitmap: url=$coverUrl for mid=$targetMediaId")
        Thread {
            try {
                if (coverUrl.isNotBlank()) {
                    val url = URL(coverUrl)
                    val conn = url.openConnection()
                    conn.connectTimeout = 5000
                    conn.readTimeout = 10000
                    val bytes = conn.getInputStream().use { it.readBytes() }
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    if (bitmap != null) {
                        val scaled = Bitmap.createScaledBitmap(bitmap, 256, 256, true)
                        currentCoverBitmap = scaled
                        Log.d("Fynix", "fetchCoverBitmap: success, ${bytes.size} bytes for mid=$targetMediaId")
                    } else {
                        Log.w("Fynix", "fetchCoverBitmap: bitmap decode failed, ${bytes.size} bytes")
                    }
                }
            } catch (e: Exception) {
                Log.e("Fynix", "fetchCoverBitmap: failed: ${e.message}")
            }
            android.os.Handler(mainLooper).post {
                if (currentMediaId == targetMediaId) {
                    AudioService.updateMetadata()
                    updateNotification()
                } else {
                    Log.d("Fynix", "fetchCoverBitmap: stale (current mid=${currentMediaId} != target=$targetMediaId)")
                }
            }
        }.start()
    }

    fun updateMediaSessionState() {
        val state = if (isCurrentlyPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        mediaSession.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setState(state, currentPosition, 1f)
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                    PlaybackStateCompat.ACTION_PAUSE or
                    PlaybackStateCompat.ACTION_PLAY_PAUSE or
                    PlaybackStateCompat.ACTION_STOP or
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                    PlaybackStateCompat.ACTION_SEEK_TO
                )
                .build()
        )
    }

    fun updateNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val mainIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val playPauseAction = if (isCurrentlyPlaying) ACTION_PAUSE else ACTION_PLAY

        val prevIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ACTION, ACTION_PREV)
        }
        val playIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ACTION, playPauseAction)
        }
        val nextIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ACTION, ACTION_NEXT)
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle.ifEmpty { "Fynix" })
            .setContentText(currentArtist.ifEmpty { if (isCurrentlyPlaying) "Playing" else "Paused" })
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(currentCoverBitmap)
            .setContentIntent(PendingIntent.getActivity(this, 0, mainIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .setStyle(androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.sessionToken)
                .setShowActionsInCompactView(0, 1, 2))
            .addAction(android.R.drawable.ic_media_previous, "Previous",
                PendingIntent.getActivity(this, 1, prevIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .addAction(android.R.drawable.ic_media_pause, if (isCurrentlyPlaying) "Pause" else "Play",
                PendingIntent.getActivity(this, 2, playIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .addAction(android.R.drawable.ic_media_next, "Next",
                PendingIntent.getActivity(this, 3, nextIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .setOngoing(isCurrentlyPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        instance = null
        ExoPlayerHolder.release()
        noisyReceiver?.let { unregisterReceiver(it) }
        debugReceiver?.let { unregisterReceiver(it) }
        super.onDestroy()
    }

    /**
     * Debug-only broadcast receiver that lets ADB simulate AA-style plays for testing.
     *
     *  adb shell am broadcast -a com.fynix.player.DEBUG_PLAY --es mid 'songId|album:albumId'
     *  adb shell am broadcast -a com.fynix.player.DEBUG_PLAY --es mid 'songId|playlist:playlistId'
     *  adb shell am broadcast -a com.fynix.player.DEBUG_PLAY --es mid 'plainSongId'
     *  adb shell am broadcast -a com.fynix.player.DEBUG_PLAY --es mid 'shuffle_all'
     *
     *  adb shell am broadcast -a com.fynix.player.DEBUG_ACT --es cmd 'next'
     *  adb shell am broadcast -a com.fynix.player.DEBUG_ACT --es cmd 'prev'
     *  adb shell am broadcast -a com.fynix.player.DEBUG_ACT --es cmd 'pause'
     *  adb shell am broadcast -a com.fynix.player.DEBUG_ACT --es cmd 'play'
     */
    private fun registerDebugReceiver() {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                when (intent.action) {
                    "com.fynix.player.DEBUG_PLAY" -> {
                        val mid = intent.getStringExtra("mid") ?: return
                        Log.d("Fynix", "DEBUG_PLAY receiver: mid=$mid")
                        when (mid) {
                            "shuffle_all" -> dispatchAction(ACTION_SHUFFLE_ALL)
                            else -> {
                                val (songId, parentType, parentId) = parseMediaIdForAuto(mid)
                                val cb = MainActivity.playMediaCallback
                                if (cb != null) {
                                    try { cb(songId, parentType, parentId) } catch (_: Exception) {}
                                } else {
                                    getSharedPreferences("fynix_playback", MODE_PRIVATE).edit().apply {
                                        putString("pending_media_id", mid)
                                        apply()
                                    }
                                }
                            }
                        }
                    }
                    "com.fynix.player.DEBUG_ACT" -> {
                        val cmd = intent.getStringExtra("cmd") ?: return
                        Log.d("Fynix", "DEBUG_ACT receiver: cmd=$cmd")
                        val cb = MainActivity.mediaActionCallback
                        when (cmd) {
                            "next" -> {
                                dispatchAction(ACTION_NEXT)
                            }
                            "prev" -> dispatchAction(ACTION_PREV)
                            "pause" -> dispatchAction(ACTION_PAUSE)
                            "play" -> dispatchAction(ACTION_PLAY)
                            "toggle" -> dispatchAction(ACTION_TOGGLE)
                            else -> Log.w("Fynix", "DEBUG_ACT unknown cmd=$cmd")
                        }
                    }
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction("com.fynix.player.DEBUG_PLAY")
            addAction("com.fynix.player.DEBUG_ACT")
        }
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(receiver, filter)
        }
        debugReceiver = receiver
    }
}
