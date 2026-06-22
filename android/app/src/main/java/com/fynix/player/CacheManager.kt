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
    }

    private fun loadManifest(): MutableMap<String, CacheEntry> {
        if (!manifestFile.exists()) return mutableMapOf()
        return try {
            val text = manifestFile.readText()
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

    private fun saveManifest(entries: Map<String, CacheEntry>) {
        try {
            manifestFile.parentFile?.mkdirs()
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
            manifestFile.writeText(arr.toString(2))
        } catch (_: Exception) {}
    }

    fun cacheTrack(trackId: String, streamUrl: String, title: String, artist: String, album: String, duration: Int = 0, onProgress: ((Int) -> Unit)? = null) {
        Log.d("Fynix", "CacheManager.cacheTrack: id=$trackId url=$streamUrl")
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
                val file = File(audioDir, "${sanitizeId(trackId)}.$ext")
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
                val entries = loadManifest()
                entries[trackId] = CacheEntry(
                    trackId = trackId,
                    title = title,
                    artist = artist,
                    album = album,
                    cachedAt = System.currentTimeMillis(),
                    fileSize = file.length(),
                    duration = duration
                )
                saveManifest(entries)
                _evictIfNeeded()
            } catch (e: Exception) {
                Log.e("Fynix", "CacheManager.cacheTrack error: ${e.message}")
            }
        }
    }

    fun getCachedPath(trackId: String): String? {
        val safeId = sanitizeId(trackId)
        return audioDir.listFiles()?.find { it.name.startsWith("$safeId.") && it.isFile }?.absolutePath
    }

    fun hasCached(trackId: String): Boolean {
        return getCachedPath(trackId) != null
    }

    fun deleteTrack(trackId: String) {
        val safeId = sanitizeId(trackId)
        audioDir.listFiles()?.find { it.name.startsWith("$safeId.") && it.isFile }?.delete()
        val entries = loadManifest()
        entries.remove(trackId)
        saveManifest(entries)
    }

    fun getAllTracks(): List<CacheEntry> {
        return loadManifest().values.toList().sortedByDescending { it.cachedAt }
    }

    fun getCacheStats(): Pair<Long, Int> {
        val entries = loadManifest()
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

    private fun sanitizeId(id: String): String {
        return id.replace(Regex("[^a-zA-Z0-9_\\-]"), "_")
    }
}
