package com.fynix.player

import android.content.Intent
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.session.MediaSessionCompat
import androidx.media.MediaBrowserServiceCompat
import kotlinx.coroutines.*
import android.util.Log
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
        val navServer = prefs.getString("navidrome_server", "") ?: ""
        Log.d("Fynix", "BrowserService: server=$navServer")
        navidrome = NavidromeClient(
            server = navServer,
            username = prefs.getString("navidrome_username", "") ?: "",
            password = prefs.getString("navidrome_password", "") ?: ""
        )

        if (CoverArtServerHolder.server == null) {
            val srv = CoverArtServer(this)
            srv.start()
            CoverArtServerHolder.server = srv
            CoverArtServerHolder.port = srv.port
            Log.d("Fynix", "CoverArtServer started from BrowserService on port ${srv.port}")
        }

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
        Log.d("Fynix", "onLoadChildren: parentId=$parentId")
        result.detach()
        scope.launch {
            Log.d("Fynix", "onLoadChildren: loading parentId=$parentId")
            val items = try {
                when (parentId) {
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
                        Log.w("Fynix", "onLoadChildren: unknown parentId=$parentId")
                        emptyList()
                    }
                }
                }
            } catch (e: Exception) {
                Log.e("Fynix", "onLoadChildren: error parentId=$parentId error=${e.message}")
                emptyList()
            }
            Log.d("Fynix", "onLoadChildren: result parentId=$parentId items=${items.size}")
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
        val artists = navidrome.getArtists()
        Log.d("Fynix", "loadArtists: count=${artists.size}")
        return artists.map { a ->
            createBrowsableItem(a.name, "artist_${a.id}", "${a.albumCount} albums")
        }
    }

    private suspend fun loadAlbums(): List<MediaBrowserCompat.MediaItem> {
        val albums = navidrome.getAlbumList2("newest", 500)
        Log.d("Fynix", "loadAlbums: count=${albums.size}")
        return albums.map { a ->
            createBrowsableItem(a.name, "album_${a.id}", a.artist, a.coverArt)
        }
    }

    private suspend fun loadPlaylists(): List<MediaBrowserCompat.MediaItem> {
        val playlists = navidrome.getPlaylists()
        Log.d("Fynix", "loadPlaylists: count=${playlists.size}")
        val items = mutableListOf<MediaBrowserCompat.MediaItem>()
        items.add(createPlayableItem("Shuffle All", "shuffle_all", "Play all songs shuffled", ""))
        playlists.forEach { p ->
            items.add(createBrowsableItem(p.name, "playlist_${p.id}", "${p.songCount} tracks", ""))
        }
        return items
    }

    private suspend fun loadArtistAlbums(artistId: String): List<MediaBrowserCompat.MediaItem> {
        val albums = navidrome.getArtist(artistId)
        Log.d("Fynix", "loadArtistAlbums: artistId=$artistId count=${albums.size}")
        return albums.map { a ->
            createBrowsableItem(a.name, "album_${a.id}", a.artist, a.coverArt)
        }
    }

    private suspend fun loadAlbumSongs(albumId: String): List<MediaBrowserCompat.MediaItem> {
        val (album, songs) = navidrome.getAlbum(albumId)
        Log.d("Fynix", "loadAlbumSongs: albumId=$albumId songs=${songs.size}, album=${album?.name}")
        return songs.map { s ->
            createPlayableItem(s.title, "${s.id}|album:${albumId}", s.artist, s.coverArt)
        }
    }

    private suspend fun loadPlaylistSongs(playlistId: String): List<MediaBrowserCompat.MediaItem> {
        val songs = navidrome.getPlaylist(playlistId)
        Log.d("Fynix", "loadPlaylistSongs: playlistId=$playlistId songs=${songs.size}")
        return songs.map { s ->
            createPlayableItem(s.title, "${s.id}|playlist:${playlistId}", s.artist, s.coverArt)
        }
    }

    private fun localCoverUri(coverArt: String): android.net.Uri? {
        if (coverArt.isBlank()) return null
        val port = CoverArtServerHolder.port
        if (port > 0) {
            val uri = android.net.Uri.parse("http://127.0.0.1:$port/cover?id=${java.net.URLEncoder.encode(coverArt, "UTF-8")}&size=150")
            Log.d("Fynix", "localCoverUri: coverArt=$coverArt port=$port uri=$uri")
            return uri
        }
        val u = navidrome.coverUrl(coverArt, 150)
        Log.w("Fynix", "localCoverUri: server NOT ready (port=0), using direct url=$u")
        return android.net.Uri.parse(u)
    }

    private fun createBrowsableItem(title: String, id: String, subtitle: String, coverArt: String = ""): MediaBrowserCompat.MediaItem {
        val uri = localCoverUri(coverArt)
        return MediaBrowserCompat.MediaItem(
            MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(subtitle)
                .apply { uri?.let { setIconUri(it) } }
                .build(),
            MediaBrowserCompat.MediaItem.FLAG_BROWSABLE
        )
    }

    private fun createPlayableItem(
        title: String, id: String, artist: String, coverArt: String
    ): MediaBrowserCompat.MediaItem {
        val uri = localCoverUri(coverArt)
        val desc = MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(artist)
            .apply { uri?.let { setIconUri(it) } }
            .build()
        return MediaBrowserCompat.MediaItem(desc, MediaBrowserCompat.MediaItem.FLAG_PLAYABLE)
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
