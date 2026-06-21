package com.fynix.player

import android.content.res.AssetManager
import fi.iki.elonen.NanoHTTPD
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

fun InputStream.readFully(buf: ByteArray) {
    var offset = 0
    while (offset < buf.size) {
        val read = read(buf, offset, buf.size - offset)
        if (read == -1) throw java.io.EOFException()
        offset += read
    }
}

class LocalServer(
    private val assets: AssetManager,
    private val port: Int = 8080,
    private val cacheDir: File? = null
) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val method = session.method

        if (uri.startsWith("/api/proxy") && method == Method.POST) {
            val body = readBody(session)
            var target = ""
            var proxyMethod = "GET"
            var proxyBody: String? = null
            var proxyHeaders: MutableMap<String, String>? = null
            try {
                if (body.isNotBlank()) {
                    val obj = org.json.JSONObject(body)
                    target = obj.optString("url", "")
                    proxyMethod = obj.optString("method", "GET")
                    if (obj.has("body") && !obj.isNull("body")) {
                        val b = obj.get("body")
                        proxyBody = if (b is org.json.JSONObject || b is org.json.JSONArray) b.toString() else b.toString()
                    }
                    if (obj.has("headers")) {
                        val h = obj.getJSONObject("headers")
                        proxyHeaders = mutableMapOf()
                        for (key in h.keys()) {
                            proxyHeaders!![key] = h.getString(key)
                        }
                    }
                }
            } catch (_: Exception) {}
            if (target.isBlank()) {
                try { target = session.parameters["url"]?.firstOrNull() ?: "" } catch (_: Exception) {}
                if (target.isBlank() && session.queryParameterString.isNotBlank()) {
                    for (p in session.queryParameterString.split("&")) {
                        val kv = p.split("=", limit = 2)
                        if (kv.size == 2 && kv[0] == "url") {
                            target = java.net.URLDecoder.decode(kv[1], "UTF-8")
                        }
                    }
                }
            }
            if (target.isBlank()) {
                return newFixedLengthResponse(Response.Status.BAD_REQUEST, "text/plain", "Missing url param")
            }
            val isGetOrDelete = proxyMethod.equals("GET", ignoreCase = true) || proxyMethod.equals("DELETE", ignoreCase = true)
            val finalBody = if (isGetOrDelete) null else proxyBody
            return proxyRequest(target, finalBody, proxyHeaders, proxyMethod)
        }

        if (uri.startsWith("/api/") && !uri.startsWith("/api/navidrome") && !uri.startsWith("/api/cached/")) {
            val body = if (method == Method.POST) readBody(session) else ""
            val target = "http://localhost:8008$uri"
            val m = if (method == Method.POST) "POST" else "GET"
            return proxyRequest(target, body.ifBlank { null }, emptyMap(), m)
        }

        if (uri == "/api/navidrome-proxy" && method == Method.POST) {
            val body = readBody(session)
            try {
                val obj = org.json.JSONObject(body)
                val server = obj.getString("server")
                val username = obj.getString("username")
                val password = obj.getString("password")
                val endpoint = obj.getString("endpoint")
                val params = obj.optJSONObject("params") ?: org.json.JSONObject()

                val hexPass = password.toCharArray().joinToString("") { it.code.toString(16).padStart(2, '0') }
                val qs = StringBuilder()
                qs.append("u=").append(java.net.URLEncoder.encode(username, "UTF-8"))
                qs.append("&p=enc:").append(hexPass)
                qs.append("&v=1.12.0&c=fynix-android&f=json")
                for (key in params.keys()) {
                    val value = params.get(key)
                    if (value is org.json.JSONArray) {
                        for (i in 0 until value.length()) {
                            qs.append("&").append(key).append("=").append(java.net.URLEncoder.encode(value.getString(i), "UTF-8"))
                        }
                    } else {
                        qs.append("&").append(key).append("=").append(java.net.URLEncoder.encode(value.toString(), "UTF-8"))
                    }
                }
                val target = "${server.trimEnd('/')}/rest/$endpoint.view?$qs"
                val url = URL(target)
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 30000
                conn.instanceFollowRedirects = true
                conn.doOutput = false
                val respCode = conn.responseCode
                val respBody = if (respCode in 200..299) {
                    conn.inputStream.readBytes()
                } else {
                    conn.errorStream?.readBytes() ?: ByteArray(0)
                }
                conn.disconnect()
                val dataStr = String(respBody)
                if (dataStr.isBlank()) {
                    throw Exception("Empty response (HTTP $respCode) from $target")
                }
                val json = org.json.JSONObject(dataStr)
                val sub = json.optJSONObject("subsonic-response")
                val result = sub ?: json
                val resp = newFixedLengthResponse(Response.Status.OK, "application/json", """{"result":$result}""")
                resp.addHeader("Access-Control-Allow-Origin", "*")
                return resp
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json",
                    """{"error":"Navidrome proxy error: ${e.message}"}""")
            }
        }

        if (uri.startsWith("/api/navidrome-stream") || uri.startsWith("/api/navidrome-cover")) {
            val id = session.parameters["id"]?.firstOrNull() ?: ""
            val server = session.parameters["server"]?.firstOrNull() ?: ""
            val u = session.parameters["u"]?.firstOrNull() ?: ""
            val p = session.parameters["p"]?.firstOrNull() ?: ""
            val fmt = session.parameters["format"]?.firstOrNull() ?: ""
            if (id.isNotBlank() && server.isNotBlank()) {
                val endpoint = if (uri.startsWith("/api/navidrome-stream")) "stream.view" else "getCoverArt.view"
                val encId = java.net.URLEncoder.encode(id, "UTF-8")
                val encU = java.net.URLEncoder.encode(u, "UTF-8")
                val encP = java.net.URLEncoder.encode(p, "UTF-8")
                val qs = if (uri.startsWith("/api/navidrome-cover")) {
                    val size = session.parameters["size"]?.firstOrNull() ?: "300"
                    "id=$encId&size=$size&u=$encU&p=$encP&v=1.12.0&c=fynix-android"
                } else {
                    val fmtParam = if (fmt.isNotBlank()) "&format=$fmt" else ""
                    "id=$encId&u=$encU&p=$encP&v=1.12.0&c=fynix-android$fmtParam"
                }
                val target = "${server.trimEnd('/')}/rest/$endpoint?$qs"
                val url = URL(target)
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 0
                conn.instanceFollowRedirects = true
                val rangeHeader = session.headers?.get("range")
                if (rangeHeader != null) {
                    conn.setRequestProperty("Range", rangeHeader)
                }
                val respCode = conn.responseCode
                if (respCode !in 200..299) {
                    val errBody = try { conn.errorStream?.readBytes() ?: ByteArray(0) } catch (_: Exception) { ByteArray(0) }
                    conn.disconnect()
                    return newFixedLengthResponse(Response.Status.lookup(respCode) ?: Response.Status.INTERNAL_ERROR, "text/plain", String(errBody))
                }
                val ct = conn.contentType ?: "application/octet-stream"
                val contentLength = conn.contentLength.toLong()
                val upstreamStream = conn.inputStream
                val wrappedStream = object : java.io.InputStream() {
                    override fun read(): Int = upstreamStream.read()
                    override fun read(b: ByteArray, off: Int, len: Int): Int = upstreamStream.read(b, off, len)
                    override fun available(): Int = upstreamStream.available()
                    override fun close() {
                        try { upstreamStream.close() } catch (_: Exception) {}
                        conn.disconnect()
                    }
                }
                val respStatus = if (respCode == 206) Response.Status.PARTIAL_CONTENT else Response.Status.OK
                val resp = if (contentLength > 0 && rangeHeader == null) {
                    newFixedLengthResponse(respStatus, ct, wrappedStream, contentLength)
                } else {
                    newChunkedResponse(respStatus, ct, wrappedStream)
                }
                resp.addHeader("Access-Control-Allow-Origin", "*")
                resp.addHeader("Accept-Ranges", "bytes")
                if (respCode == 206) {
                    val contentRange = conn.getHeaderField("Content-Range")
                    if (contentRange != null) resp.addHeader("Content-Range", contentRange)
                }
                return resp
            }
        }

        // Serve cached audio files
        if (uri.startsWith("/api/cached/") && cacheDir != null) {
            val trackId = uri.removePrefix("/api/cached/")
            val safeId = trackId.replace(Regex("[^a-zA-Z0-9_\\-]"), "_")
            val audioDir = File(cacheDir, "audio")
            val file = audioDir.listFiles()?.find { it.name.startsWith("$safeId.") && it.isFile }
            if (file != null) {
                val ext = file.extension.lowercase()
                val mime = when (ext) {
                    "ogg" -> "audio/ogg"
                    "mp3" -> "audio/mpeg"
                    "flac" -> "audio/flac"
                    "wav" -> "audio/wav"
                    "m4a", "aac", "mp4" -> "audio/mp4"
                    "opus" -> "audio/opus"
                    "webm" -> "audio/webm"
                    else -> "audio/mpeg"
                }
                val rangeHeader = session.headers?.get("range")
                val fileLen = file.length()
                if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                    val parts = rangeHeader.removePrefix("bytes=").split("-")
                    val start = parts.firstOrNull()?.toLongOrNull() ?: 0
                    val end = parts.getOrNull(1)?.toLongOrNull() ?: (fileLen - 1)
                    val len = (end - start + 1).toInt()
                    val fis = java.io.FileInputStream(file)
                    fis.skip(start)
                    val data = ByteArray(len)
                    var offset = 0
                    while (offset < len) {
                        val read = fis.read(data, offset, len - offset)
                        if (read == -1) break
                        offset += read
                    }
                    fis.close()
                    val resp = newFixedLengthResponse(Response.Status.PARTIAL_CONTENT, mime, data.inputStream(), len.toLong())
                    resp.addHeader("Content-Range", "bytes $start-$end/$fileLen")
                    resp.addHeader("Accept-Ranges", "bytes")
                    return resp
                }
                val resp = newFixedLengthResponse(Response.Status.OK, mime, file.inputStream(), fileLen)
                resp.addHeader("Accept-Ranges", "bytes")
                return resp
            }
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not cached")
        }

        val filePath = if (uri == "/" || uri.isBlank()) "web/index.html" else "web$uri"
        return try {
            val input = assets.open(filePath)
            val baos = ByteArrayOutputStream()
            input.copyTo(baos)
            input.close()
            val ext = filePath.substringAfterLast('.', "")
            val mime = when (ext) {
                "html" -> "text/html; charset=utf-8"
                "js" -> "application/javascript; charset=utf-8"
                "css" -> "text/css; charset=utf-8"
                "png" -> "image/png"
                "svg" -> "image/svg+xml"
                "json" -> "application/json"
                "ico" -> "image/x-icon"
                else -> "application/octet-stream"
            }
            val etag = Integer.toHexString(baos.size())
            val resp = newChunkedResponse(Response.Status.OK, mime, baos.toByteArray().inputStream())
            resp.addHeader("Cache-Control", "no-cache, no-store, must-revalidate")
            resp.addHeader("Pragma", "no-cache")
            resp.addHeader("ETag", etag)
            resp
        } catch (_: Exception) {
            newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "404 Not Found")
        }
    }

    private fun readBody(session: IHTTPSession): String {
        val len = session.headers["content-length"]?.toIntOrNull() ?: 0
        if (len <= 0) {
            val buf = ByteArrayOutputStream()
            try {
                session.inputStream?.copyTo(buf)
                return String(buf.toByteArray())
            } catch (_: Exception) { return "" }
        }
        val buf = ByteArray(len)
        try {
            session.inputStream?.readFully(buf)
            return String(buf)
        } catch (_: Exception) { return "" }
    }

    private fun proxyRequest(targetUrl: String, body: String? = null, headers: Map<String, String>? = null, method: String = "GET"): Response {
        return try {
            val url = URL(targetUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 15000
            conn.readTimeout = 30000
            conn.instanceFollowRedirects = true

            val httpMethod = if (method.equals("POST", ignoreCase = true) && body != null) "POST" else if (method.equals("POST", ignoreCase = true)) "POST" else "GET"
            conn.requestMethod = httpMethod

            if (httpMethod == "POST") {
                conn.doOutput = true
            } else {
                conn.doOutput = false
            }

            headers?.forEach { (k, v) ->
                conn.setRequestProperty(k, v)
            }

            if (body != null && body.isNotBlank()) {
                if (!conn.requestProperties.containsKey("Content-Type")) {
                    conn.setRequestProperty("Content-Type", "application/json")
                }
                conn.outputStream.write(body.toByteArray())
                conn.outputStream.flush()
            }

            val respCode = conn.responseCode
            val respBody = if (respCode in 200..299) {
                conn.inputStream.readBytes()
            } else {
                conn.errorStream?.readBytes() ?: ByteArray(0)
            }
            conn.disconnect()

            val status = Response.Status.lookup(respCode) ?: Response.Status.INTERNAL_ERROR
            val response = newFixedLengthResponse(status, "application/json", String(respBody))
            response.addHeader("Access-Control-Allow-Origin", "*")
            response
        } catch (e: Exception) {
            newFixedLengthResponse(
                Response.Status.INTERNAL_ERROR, "application/json",
                """{"error":"Proxy error: ${e.message}"}"""
            )
        }
    }
}
