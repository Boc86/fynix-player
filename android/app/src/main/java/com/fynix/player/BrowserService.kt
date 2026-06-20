package com.fynix.player

import android.content.Intent
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.session.MediaSessionCompat
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
        const val EXTRA_MEDIA_ID = "media_id"
        const val EXTRA_PARENT_TYPE = "parent_type"
        const val EXTRA_PARENT_ID = "parent_id"
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var navidrome: NavidromeClient
    private var session: MediaSessionCompat? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundService(Intent(this, AudioService::class.java))
        val prefs = getSharedPreferences("fynix_settings", MODE_PRIVATE)
        navidrome = NavidromeClient(
            server = prefs.getString("navidrome_server", "") ?: "",
            username = prefs.getString("navidrome_username", "") ?: "",
            password = prefs.getString("navidrome_password", "") ?: ""
        )

        session = MediaSessionHolder.session
        if (session == null) {
            session = MediaSessionCompat(this, "FynixAutoSession")
            MediaSessionHolder.session = session
        }
        session?.let { s ->
            s.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS or
                MediaSessionCompat.FLAG_HANDLES_QUEUE_COMMANDS
            )
            s.isActive = true
        }
        setSessionToken(session!!.sessionToken)
    }

    override fun onSearch(query: String, extras: Bundle?, result: Result<MutableList<MediaBrowserCompat.MediaItem>>) {
        result.detach()
        scope.launch {
            val (_, albums, songs) = navidrome.search3(query)
            val items = mutableListOf<MediaBrowserCompat.MediaItem>()
            albums.forEach { a ->
                items.add(createPlayableItem(a.name, "|album:${a.id}", a.artist, a.coverArt))
            }
            songs.forEach { s ->
                val mid = if (s.albumId.isNotBlank()) "${s.id}|album:${s.albumId}" else s.id
                items.add(createPlayableItem(s.title, mid, s.artist, s.coverArt))
            }
            result.sendResult(items)
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
            createBrowsableItem(a.name, "album_${a.id}", a.artist)
        }
    }

    private suspend fun loadPlaylists(): List<MediaBrowserCompat.MediaItem> {
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()
        items.add(createPlayableItem("Shuffle All", "shuffle_all", "Play all songs shuffled", ""))
        navidrome.getPlaylists().forEach { p ->
            items.add(createBrowsableItem(p.name, "playlist_${p.id}", "${p.songCount} tracks"))
        }
        return items
    }

    private suspend fun loadArtistAlbums(artistId: String): List<MediaBrowserCompat.MediaItem> {
        return navidrome.getArtist(artistId).map { a ->
            createBrowsableItem(a.name, "album_${a.id}", a.artist)
        }
    }

    private suspend fun loadAlbumSongs(albumId: String): List<MediaBrowserCompat.MediaItem> {
        val (_, songs) = navidrome.getAlbum(albumId)
        return songs.map { s ->
            createPlayableItem(s.title, "${s.id}|album:${albumId}", s.artist, s.coverArt)
        }
    }

    private suspend fun loadPlaylistSongs(playlistId: String): List<MediaBrowserCompat.MediaItem> {
        val songs = navidrome.getPlaylist(playlistId)
        return songs.map { s ->
            createPlayableItem(s.title, "${s.id}|playlist:${playlistId}", s.artist, s.coverArt)
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
        title: String, id: String, artist: String, coverArt: String
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
        if (MediaSessionHolder.session != null) {
            MediaSessionHolder.session = null
            session?.release()
        }
        super.onDestroy()
    }
}
