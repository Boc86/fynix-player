package com.fynix.player

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject

class CacheManager(private val context: Context) {

    private val audioDir = File(context.cacheDir, "audio")
    private val manifestFile = File(context.cacheDir, "audio/manifest.json")
    private val favDir = File(context.cacheDir, "audio_favourites")
    private val favManifestFile = File(context.cacheDir, "audio_favourites/manifest.json")
    private val scope = CoroutineScope(Dispatchers.IO)
    @Volatile
    var maxSizeBytes: Long = 500L * 1024 * 1024

    data class CacheEntry(
        val trackId: String,
        val title: String,
        val artist: String,
        val album: String,
        val cachedAt: Long,
        val fileSize: Long,
        val duration: Int
    )

    init {
        audioDir.mkdirs()
        favDir.mkdirs()
    }

    private fun loadManifest(manifest: File = manifestFile): MutableMap<String, CacheEntry> {
        if (!manifest.exists()) return mutableMapOf()
        return try {
            val text = manifest.readText()
            val arr = JSONArray(text)
            val map = mutableMapOf<String, CacheEntry>()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val entry = CacheEntry(
                    trackId = obj.getString("trackId"),
                    title = obj.optString("title", ""),
                    artist = obj.optString("artist", ""),
                    album = obj.optString("album", ""),
                    cachedAt = obj.optLong("cachedAt", 0),
                    fileSize = obj.optLong("fileSize", 0),
                    duration = obj.optInt("duration", 0)
                )
                map[entry.trackId] = entry
            }
            map
        } catch (_: Exception) {
            mutableMapOf()
        }
    }

    private fun saveManifest(entries: Map<String, CacheEntry>, manifest: File = manifestFile) {
        try {
            manifest.parentFile?.mkdirs()
            val arr = JSONArray()
            entries.values.forEach { entry ->
                arr.put(JSONObject().apply {
                    put("trackId", entry.trackId)
                    put("title", entry.title)
                    put("artist", entry.artist)
                    put("album", entry.album)
                    put("cachedAt", entry.cachedAt)
                    put("fileSize", entry.fileSize)
                    put("duration", entry.duration)
                })
            }
            manifest.writeText(arr.toString(2))
        } catch (_: Exception) {}
    }

    private fun downloadAndSave(trackId: String, streamUrl: String, title: String, artist: String, album: String, duration: Int, targetDir: File, targetManifest: File, onProgress: ((Int) -> Unit)?) {
        scope.launch {
            try {
                val url = URL(streamUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 120000
                conn.instanceFollowRedirects = true
                val contentType = conn.contentType ?: ""
                val ext = when {
                    contentType.contains("ogg", ignoreCase = true) -> "ogg"
                    contentType.contains("mpeg", ignoreCase = true) || contentType.contains("mp3", ignoreCase = true) -> "mp3"
                    contentType.contains("flac", ignoreCase = true) -> "flac"
                    contentType.contains("wav", ignoreCase = true) -> "wav"
                    contentType.contains("aac", ignoreCase = true) || contentType.contains("m4a", ignoreCase = true) -> "m4a"
                    else -> "mp3"
                }
                val file = File(targetDir, "${sanitizeId(trackId)}.$ext")
                val total = conn.contentLength
                val input = conn.inputStream
                val output = RandomAccessFile(file, "rw")
                val buf = ByteArray(8192)
                var read: Int
                var downloaded = 0
                var lastReport = 0
                while (input.read(buf).also { read = it } != -1) {
                    output.write(buf, 0, read)
                    downloaded += read
                    if (onProgress != null && total > 0) {
                        val pct = (downloaded * 100) / total
                        if (pct - lastReport >= 5) {
                            lastReport = pct
                            onProgress(pct)
                        }
                    }
                }
                input.close()
                output.close()
                conn.disconnect()
                val entries = loadManifest(targetManifest)
                entries[trackId] = CacheEntry(
                    trackId = trackId,
                    title = title,
                    artist = artist,
                    album = album,
                    cachedAt = System.currentTimeMillis(),
                    fileSize = file.length(),
                    duration = duration
                )
                saveManifest(entries, targetManifest)
                if (targetDir == audioDir) _evictIfNeeded()
            } catch (e: Exception) {
                Log.e("Fynix", "CacheManager.downloadAndSave error: ${e.message}")
            }
        }
    }

    fun cacheTrack(trackId: String, streamUrl: String, title: String, artist: String, album: String, duration: Int = 0, onProgress: ((Int) -> Unit)? = null) {
        Log.d("Fynix", "CacheManager.cacheTrack: id=$trackId url=$streamUrl")
        downloadAndSave(trackId, streamUrl, title, artist, album, duration, audioDir, manifestFile, onProgress)
    }

    fun cacheFavouriteTrack(trackId: String, streamUrl: String, title: String, artist: String, album: String, duration: Int = 0, onProgress: ((Int) -> Unit)? = null) {
        Log.d("Fynix", "CacheManager.cacheFavouriteTrack: id=$trackId url=$streamUrl")
        downloadAndSave(trackId, streamUrl, title, artist, album, duration, favDir, favManifestFile, onProgress)
    }

    fun getCachedPath(trackId: String): String? {
        val safeId = sanitizeId(trackId)
        return audioDir.listFiles()?.find { it.name.startsWith("$safeId.") && it.isFile }?.absolutePath
    }

    fun getFavouriteCachedPath(trackId: String): String? {
        val safeId = sanitizeId(trackId)
        return favDir.listFiles()?.find { it.name.startsWith("$safeId.") && it.isFile }?.absolutePath
    }

    fun hasCached(trackId: String): Boolean {
        return getCachedPath(trackId) != null
    }

    fun hasCachedFavourite(trackId: String): Boolean {
        return getFavouriteCachedPath(trackId) != null
    }

    fun deleteTrack(trackId: String) {
        val safeId = sanitizeId(trackId)
        audioDir.listFiles()?.find { it.name.startsWith("$safeId.") && it.isFile }?.delete()
        val entries = loadManifest()
        entries.remove(trackId)
        saveManifest(entries)
    }

    fun deleteFavouriteTrack(trackId: String) {
        val safeId = sanitizeId(trackId)
        favDir.listFiles()?.find { it.name.startsWith("$safeId.") && it.isFile }?.delete()
        val entries = loadManifest(favManifestFile)
        entries.remove(trackId)
        saveManifest(entries, favManifestFile)
    }

    fun getAllTracks(): List<CacheEntry> {
        return loadManifest().values.toList().sortedByDescending { it.cachedAt }
    }

    fun getAllFavouriteTracks(): List<CacheEntry> {
        return loadManifest(favManifestFile).values.toList().sortedByDescending { it.cachedAt }
    }

    fun getCacheStats(): Pair<Long, Int> {
        val entries = loadManifest()
        val size = entries.values.sumOf { it.fileSize }
        return Pair(size, entries.size)
    }

    fun getFavouriteCacheStats(): Pair<Long, Int> {
        val entries = loadManifest(favManifestFile)
        val size = entries.values.sumOf { it.fileSize }
        return Pair(size, entries.size)
    }

    fun setMaxSize(sizeBytes: Long) {
        maxSizeBytes = sizeBytes
        _evictIfNeeded()
    }

    fun enforceLimit() {
        _evictIfNeeded()
    }

    private fun _evictIfNeeded() {
        val entries = loadManifest()
        var total = entries.values.sumOf { it.fileSize }
        if (total <= maxSizeBytes) return
        val sorted = entries.values.sortedBy { it.cachedAt }
        for (entry in sorted) {
            if (total <= maxSizeBytes) break
            val safeId = sanitizeId(entry.trackId)
            audioDir.listFiles()?.find { it.name.startsWith("$safeId.") && it.isFile }?.delete()
            entries.remove(entry.trackId)
            total -= entry.fileSize
        }
        saveManifest(entries)
    }

    fun clearAll() {
        audioDir.listFiles()?.forEach { it.delete() }
        manifestFile.delete()
    }

    fun clearAllFavourites() {
        favDir.listFiles()?.forEach { it.delete() }
        favManifestFile.delete()
    }

    private fun sanitizeId(id: String): String {
        return id.replace(Regex("[^a-zA-Z0-9_\\-]"), "_")
    }
}
