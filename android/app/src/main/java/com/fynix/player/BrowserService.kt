package com.fynix.player

import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media.MediaBrowserServiceCompat
import kotlinx.coroutines.*
import java.net.URLEncoder

class BrowserService : MediaBrowserServiceCompat() {

    companion object {
        const val ROOT_ID = "__ROOT__"
        const val ARTISTS_ROOT = "artists"
        const val ALBUMS_ROOT = "albums"
        const val PLAYLISTS_ROOT = "playlists"
        const val SEARCH_ROOT = "search"
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var navidrome: NavidromeClient
    private var session: MediaSessionCompat? = null

    override fun onCreate() {
        super.onCreate()
        val prefs = getSharedPreferences("fynix_settings", MODE_PRIVATE)
        navidrome = NavidromeClient(
            server = prefs.getString("navidrome_server", "") ?: "",
            username = prefs.getString("navidrome_username", "") ?: "",
            password = prefs.getString("navidrome_password", "") ?: ""
        )

        session = MediaSessionCompat(this, "FynixAutoSession")
        session?.apply {
            setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS or
                MediaSessionCompat.FLAG_HANDLES_QUEUE_COMMANDS
            )
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() {
                    val intent = packageManager.getLaunchIntentForPackage(packageName)
                    startActivity(intent)
                }
                override fun onPlayFromMediaId(mediaId: String, extras: Bundle?) {
                    startActivity(packageManager.getLaunchIntentForPackage(packageName))
                }

            })
            setSessionToken(sessionToken)
            isActive = true
            setPlaybackState(
                PlaybackStateCompat.Builder()
                    .setState(PlaybackStateCompat.STATE_NONE, 0, 0f)
                    .build()
            )
        }
    }

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot {
        return BrowserRoot(ROOT_ID, null)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        result.detach()
        scope.launch {
            val items = when (parentId) {
                ROOT_ID -> loadRootChildren()
                ARTISTS_ROOT -> loadArtists()
                ALBUMS_ROOT -> loadAlbums()
                PLAYLISTS_ROOT -> loadPlaylists()
                else -> {
                    if (parentId.startsWith("artist_")) {
                        val id = parentId.removePrefix("artist_")
                        loadArtistAlbums(id)
                    } else if (parentId.startsWith("album_")) {
                        val id = parentId.removePrefix("album_")
                        loadAlbumSongs(id)
                    } else if (parentId.startsWith("playlist_")) {
                        val id = parentId.removePrefix("playlist_")
                        loadPlaylistSongs(id)
                    } else {
                        emptyList()
                    }
                }
            }
            result.sendResult(items.toMutableList())
        }
    }

    private fun loadRootChildren(): List<MediaBrowserCompat.MediaItem> {
        return listOf(
            createBrowsableItem("Artists", ARTISTS_ROOT, "Browse by artist"),
            createBrowsableItem("Albums", ALBUMS_ROOT, "Browse by album"),
            createBrowsableItem("Playlists", PLAYLISTS_ROOT, "Your playlists")
        )
    }

    private suspend fun loadArtists(): List<MediaBrowserCompat.MediaItem> {
        return navidrome.getArtists().map { a ->
            createBrowsableItem(a.name, "artist_${a.id}", "${a.albumCount} albums")
        }
    }

    private suspend fun loadAlbums(): List<MediaBrowserCompat.MediaItem> {
        return navidrome.getAlbumList2("newest", 500).map { a ->
            createPlayableItem(a.name, a.id, a.artist, a.coverArt) { it }
        }
    }

    private suspend fun loadPlaylists(): List<MediaBrowserCompat.MediaItem> {
        return navidrome.getPlaylists().map { p ->
            createBrowsableItem(p.name, "playlist_${p.id}", "${p.songCount} tracks")
        }
    }

    private suspend fun loadArtistAlbums(artistId: String): List<MediaBrowserCompat.MediaItem> {
        return navidrome.getArtist(artistId).map { a ->
            createPlayableItem(a.name, a.id, a.artist, a.coverArt) { it }
        }
    }

    private suspend fun loadAlbumSongs(albumId: String): List<MediaBrowserCompat.MediaItem> {
        val (_, songs) = navidrome.getAlbum(albumId)
        return songs.map { s ->
            createPlayableItem(s.title, s.id, s.artist, s.coverArt) { id ->
                navidrome.streamUrl(id)
            }
        }
    }

    private suspend fun loadPlaylistSongs(playlistId: String): List<MediaBrowserCompat.MediaItem> {
        val songs = navidrome.getPlaylist(playlistId)
        return songs.map { s ->
            createPlayableItem(s.title, s.id, s.artist, s.coverArt) { id ->
                navidrome.streamUrl(id)
            }
        }
    }

    private fun createBrowsableItem(title: String, id: String, subtitle: String): MediaBrowserCompat.MediaItem {
        return MediaBrowserCompat.MediaItem(
            MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(subtitle)
                .build(),
            MediaBrowserCompat.MediaItem.FLAG_BROWSABLE
        )
    }

    private fun createPlayableItem(
        title: String, id: String, artist: String, coverArt: String,
        streamUrl: (String) -> String
    ): MediaBrowserCompat.MediaItem {
        val desc = MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(artist)
            .apply {
                if (coverArt.isNotBlank()) {
                    setIconUri(android.net.Uri.parse(navidrome.coverUrl(coverArt, 150)))
                }
            }
            .build()
        return MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE)
    }

    override fun onDestroy() {
        scope.cancel()
        session?.release()
        super.onDestroy()
    }
}
