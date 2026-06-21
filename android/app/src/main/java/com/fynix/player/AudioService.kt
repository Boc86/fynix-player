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
    }

    private lateinit var mediaSession: MediaSessionCompat
    private var noisyReceiver: BroadcastReceiver? = null
    private var audioManager: AudioManager? = null
    private var audioFocusListener: AudioManager.OnAudioFocusChangeListener? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        createChannel()
        setupMediaSession()
        registerNoisyReceiver()
        setupAudioFocus()
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
        audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        audioFocusListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
            when (focusChange) {
                AudioManager.AUDIOFOCUS_LOSS -> {
                    dispatchAction(ACTION_PAUSE)
                    audioManager?.abandonAudioFocus(audioFocusListener!!)
                }
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                    dispatchAction(ACTION_PAUSE)
                }
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                    // Duck: reduce volume — handled via WebView mediaSession ducking
                    dispatchAction(ACTION_PAUSE)
                }
            }
        }
        audioManager?.requestAudioFocus(
            audioFocusListener!!,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN
        )
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
                    Log.d("Fynix", "onPlayFromMediaId: shuffle_all")
                    val pi = PendingIntent.getActivity(this@AudioService, 9999,
                        Intent(this@AudioService, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                            putExtra(EXTRA_ACTION, ACTION_SHUFFLE_ALL)
                        },
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    try { pi.send() } catch (e: Exception) { Log.e("Fynix", "shuffle PI send failed: ${e.message}") }
                    return
                }
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
                Log.d("Fynix", "onPlayFromMediaId: parsed songId=$songId type=$parentType pid=$parentId")
                val cb = MainActivity.playMediaCallback
                Log.d("Fynix", "onPlayFromMediaId: playMediaCallback is ${if (cb != null) "SET" else "NULL"}")
                if (cb != null) {
                    try {
                        cb(songId, parentType, parentId)
                        Log.d("Fynix", "onPlayFromMediaId: callback invoked OK")
                    } catch (e: Exception) {
                        Log.e("Fynix", "onPlayFromMediaId: callback threw: ${e.message}")
                    }
                } else {
                    Log.d("Fynix", "onPlayFromMediaId: no callback, saving to prefs")
                    getSharedPreferences("fynix_playback", MODE_PRIVATE).edit().apply {
                        putString("pending_media_id", songId)
                        putString("pending_parent_type", parentType)
                        putString("pending_parent_id", parentId)
                        apply()
                    }
                    Log.d("Fynix", "onPlayFromMediaId: sending PendingIntent")
                    val pi = PendingIntent.getActivity(this@AudioService, System.identityHashCode(mediaId) and 0xFFFF,
                        Intent(this@AudioService, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                            putExtra(EXTRA_ACTION, ACTION_PLAY_MEDIA)
                            putExtra(BrowserService.EXTRA_MEDIA_ID, songId)
                            putExtra(BrowserService.EXTRA_PARENT_TYPE, parentType)
                            putExtra(BrowserService.EXTRA_PARENT_ID, parentId)
                        },
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    try { pi.send() } catch (e: Exception) { Log.e("Fynix", "PendingIntent.send failed: ${e.message}") }
                }
            }
            override fun onPlayFromSearch(query: String, extras: Bundle?) {
                val cb = MainActivity.playMediaCallback
                if (cb != null) {
                    cb("", "", "")
                }
                val pi = PendingIntent.getActivity(this@AudioService, 9998,
                    Intent(this@AudioService, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra(EXTRA_ACTION, "search")
                        putExtra("query", query)
                    },
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                try { pi.send() } catch (e: Exception) { Log.e("Fynix", "search PI send failed: ${e.message}") }
            }
        })
        mediaSession.isActive = true
        updateMediaSessionState()
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
                    updateMetadata()
                    updateNotification()
                } else {
                    Log.d("Fynix", "fetchCoverBitmap: stale (current mid=${currentMediaId} != target=$targetMediaId)")
                }
            }
        }.start()
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
        mediaSession.setMetadata(builder.build())
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
        noisyReceiver?.let { unregisterReceiver(it) }
        super.onDestroy()
    }
}
