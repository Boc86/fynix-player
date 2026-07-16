package com.fynix.player

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class NavSong(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val albumId: String,
    val duration: Int,
    val trackNumber: Int,
    val coverArt: String,
    val replayGain: Float = 0f
)

data class NavAlbum(
    val id: String,
    val name: String,
    val artist: String,
    val year: Int,
    val coverArt: String
)

data class NavArtist(
    val id: String,
    val name: String,
    val albumCount: Int
)

data class NavPlaylist(
    val id: String,
    val name: String,
    val songCount: Int
)

class NavidromeClient(
    private var server: String = "",
    private var username: String = "",
    private var password: String = ""
) {

    fun isConfigured(): Boolean = server.isNotBlank() && username.isNotBlank() && password.isNotBlank()

    private fun hexPassword(): String {
        var h = ""
        for (c in password) h += c.code.toString(16).padStart(2, '0')
        return h
    }

    private fun baseUrl(endpoint: String, extra: Map<String, String> = emptyMap()): String {
        val sb = StringBuilder()
        sb.append("u=").append(URLEncoder.encode(username, "UTF-8"))
        sb.append("&p=enc:").append(hexPassword())
        sb.append("&v=1.12.0&c=fynix&f=json")
        for ((k, v) in extra) sb.append("&$k=").append(URLEncoder.encode(v, "UTF-8"))
        return "${server.trimEnd('/')}/rest/$endpoint.view?$sb"
    }

    private suspend fun request(endpoint: String, extra: Map<String, String> = emptyMap()): JSONObject? =
        withContext(Dispatchers.IO) {
            try {
                val url = URL(baseUrl(endpoint, extra))
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 10000
                conn.readTimeout = 20000
                val bytes = conn.inputStream.readBytes()
                conn.disconnect()
                val json = JSONObject(String(bytes))
                json.optJSONObject("subsonic-response")
            } catch (e: Exception) {
                Log.e("Fynix", "Navidrome request failed: endpoint=$endpoint error=${e.message}")
                null
            }
        }

    suspend fun getPlaylists(): List<NavPlaylist> {
        val resp = request("getPlaylists") ?: return emptyList()
        val arr = resp.optJSONObject("playlists")?.optJSONArray("playlist") ?: JSONArray()
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            NavPlaylist(o.getString("id"), o.getString("name"), o.optInt("songCount", 0))
        }
    }

    suspend fun getArtists(): List<NavArtist> {
        val resp = request("getArtists") ?: return emptyList()
        val indexes = resp.optJSONObject("artists")?.optJSONArray("index") ?: JSONArray()
        val list = mutableListOf<NavArtist>()
        for (i in 0 until indexes.length()) {
            val arr = indexes.getJSONObject(i).optJSONArray("artist") ?: continue
            for (j in 0 until arr.length()) {
                val o = arr.getJSONObject(j)
                list.add(NavArtist(o.getString("id"), o.getString("name"), o.optInt("albumCount", 0)))
            }
        }
        return list
    }

    suspend fun getArtist(id: String): List<NavAlbum> {
        val resp = request("getArtist", mapOf("id" to id)) ?: return emptyList()
        val arr = resp.optJSONObject("artist")?.optJSONArray("album") ?: JSONArray()
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            NavAlbum(o.getString("id"), o.getString("name"), o.optString("artist", ""),
                o.optInt("year", 0), o.optString("coverArt", ""))
        }
    }

    suspend fun getAlbum(id: String): Pair<NavAlbum?, List<NavSong>> {
        val resp = request("getAlbum", mapOf("id" to id)) ?: return null to emptyList()
        val album = resp.optJSONObject("album")
        val albumData = album?.let {
            NavAlbum(it.getString("id"), it.getString("name"), it.optString("artist", ""),
                it.optInt("year", 0), it.optString("coverArt", ""))
        }
        val arr = album?.optJSONArray("song") ?: JSONArray()
        val songs = (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            NavSong(o.getString("id"), o.getString("title"), o.optString("artist", ""),
                o.optString("album", ""), o.optString("albumId", ""),
                o.optInt("duration", 0), o.optInt("track", 0), o.optString("coverArt", ""),
                o.optDouble("replayGain", 0.0).toFloat())
        }
        return albumData to songs
    }

    suspend fun getAlbumList2(type: String = "newest", size: Int = 50): List<NavAlbum> {
        val resp = request("getAlbumList2", mapOf("type" to type, "size" to size.toString())) ?: return emptyList()
        val arr = resp.optJSONObject("albumList2")?.optJSONArray("album") ?: JSONArray()
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            NavAlbum(o.getString("id"), o.getString("name"), o.optString("artist", ""),
                o.optInt("year", 0), o.optString("coverArt", ""))
        }
    }

    suspend fun getPlaylist(id: String): List<NavSong> {
        val resp = request("getPlaylist", mapOf("id" to id)) ?: return emptyList()
        val arr = resp.optJSONObject("playlist")?.optJSONArray("entry") ?: JSONArray()
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            NavSong(o.getString("id"), o.getString("title"), o.optString("artist", ""),
                o.optString("album", ""), o.optString("albumId", ""),
                o.optInt("duration", 0), o.optInt("track", 0), o.optString("coverArt", ""),
                o.optDouble("replayGain", 0.0).toFloat())
        }
    }

    suspend fun search3(query: String, artistCount: Int = 10, albumCount: Int = 10, songCount: Int = 20): Triple<List<NavArtist>, List<NavAlbum>, List<NavSong>> {
        val resp = request("search3", mapOf(
            "query" to query,
            "artistCount" to artistCount.toString(),
            "albumCount" to albumCount.toString(),
            "songCount" to songCount.toString()
        )) ?: return Triple(emptyList(), emptyList(), emptyList())
        val sr = resp.optJSONObject("searchResult3")
        val artists = (sr?.optJSONArray("artist") ?: JSONArray()).let { arr ->
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                NavArtist(o.getString("id"), o.getString("name"), o.optInt("albumCount", 0))
            }
        }
        val albums = (sr?.optJSONArray("album") ?: JSONArray()).let { arr ->
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                NavAlbum(o.getString("id"), o.getString("name"), o.optString("artist", ""),
                    o.optInt("year", 0), o.optString("coverArt", ""))
            }
        }
        val songs = (sr?.optJSONArray("song") ?: JSONArray()).let { arr ->
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                NavSong(o.getString("id"), o.getString("title"), o.optString("artist", ""),
                    o.optString("album", ""), o.optString("albumId", ""),
                    o.optInt("duration", 0), o.optInt("track", 0), o.optString("coverArt", ""),
                    o.optDouble("replayGain", 0.0).toFloat())
            }
        }
        return Triple(artists, albums, songs)
    }

    fun streamUrl(songId: String, format: String = "mp3"): String {
        val fmtParam = if (format.isNotBlank()) "&format=$format" else ""
        val params = "u=${URLEncoder.encode(username, "UTF-8")}&p=enc:${hexPassword()}&v=1.12.0&c=fynix$fmtParam"
        return "${server.trimEnd('/')}/rest/stream.view?id=${URLEncoder.encode(songId, "UTF-8")}&$params"
    }

    suspend fun getSong(id: String): NavSong? {
        val resp = request("getSong", mapOf("id" to id)) ?: return null
        val song = resp.optJSONObject("song") ?: return null
        return NavSong(
            song.getString("id"), song.getString("title"),
            song.optString("artist", ""), song.optString("album", ""),
            song.optString("albumId", ""), song.optInt("duration", 0),
            song.optInt("track", 0), song.optString("coverArt", ""),
            song.optDouble("replayGain", 0.0).toFloat()
        )
    }

    fun coverUrl(coverArt: String, size: Int = 300): String {
        if (coverArt.isBlank()) return ""
        val params = "u=${URLEncoder.encode(username, "UTF-8")}&p=enc:${hexPassword()}&v=1.12.0&c=fynix&size=$size"
        return "${server.trimEnd('/')}/rest/getCoverArt.view?id=${URLEncoder.encode(coverArt, "UTF-8")}&$params"
    }
}
