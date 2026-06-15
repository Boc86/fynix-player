package com.fynix.player

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat

class AudioService : android.app.Service() {

    companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID = "fynix_playback"

        private var instance: AudioService? = null
        private var currentTitle = ""
        private var currentArtist = ""
        private var currentAlbum = ""
        private var currentCoverArt = ""
        private var currentDuration = 0
        private var isCurrentlyPlaying = false

        fun updateNowPlaying(ctx: Context, title: String, artist: String, album: String, coverArt: String, duration: Int) {
            currentTitle = title
            currentArtist = artist
            currentAlbum = album
            currentCoverArt = coverArt
            currentDuration = duration
            instance?.updateMetadata()
            instance?.updateNotification()
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

    override fun onCreate() {
        super.onCreate()
        instance = this
        createChannel()
        setupMediaSession()
        startForeground(NOTIFICATION_ID, buildNotification())
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
        mediaSession = MediaSessionCompat(this, "FynixMediaSession")
        mediaSession.setCallback(object : MediaSessionCompat.Callback() {
            override fun onPlay() {
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                startActivity(intent)
            }
            override fun onPause() {
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                startActivity(intent)
            }
            override fun onSkipToNext() {
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                startActivity(intent)
            }
            override fun onSkipToPrevious() {
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                startActivity(intent)
            }
        })
        mediaSession.isActive = true
        updateMediaSessionState()
    }

    fun updateMetadata() {
        mediaSession.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, currentCoverArt)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDuration.toLong())
                .build()
        )
    }

    fun updateMediaSessionState() {
        val state = if (isCurrentlyPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED
        mediaSession.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setState(state, 0, 1f)
                .setActions(
                    PlaybackStateCompat.ACTION_PLAY or
                    PlaybackStateCompat.ACTION_PAUSE or
                    PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                    PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
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
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle.ifEmpty { "Fynix" })
            .setContentText(currentArtist.ifEmpty { if (isCurrentlyPlaying) "Playing" else "Paused" })
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(PendingIntent.getActivity(this, 0, mainIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .setStyle(androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.sessionToken)
                .setShowActionsInCompactView(0, 1, 2))
            .setOngoing(isCurrentlyPlaying)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        updateNotification()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { instance = null; mediaSession.release(); super.onDestroy() }
}
