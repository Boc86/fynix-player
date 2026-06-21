package com.fynix.player

import android.content.Context
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap

class CoverArtServer(private val ctx: Context) {

    private var serverSocket: ServerSocket? = null
    private var running = false
    private val cache = ConcurrentHashMap<String, ByteArray>()
    private var serverUrl: String = ""
    private var username: String = ""
    private var password: String = ""

    val port: Int get() = serverSocket?.localPort ?: 0

    fun updateCredentials(server: String, user: String, pass: String) {
        serverUrl = server.trimEnd('/')
        username = user
        password = pass
    }

    fun start() {
        if (running) return
        val prefs = ctx.getSharedPreferences("fynix_settings", Context.MODE_PRIVATE)
        serverUrl = (prefs.getString("navidrome_server", "") ?: "").trimEnd('/')
        username = prefs.getString("navidrome_username", "") ?: ""
        password = prefs.getString("navidrome_password", "") ?: ""
        try {
            serverSocket = ServerSocket(8081)
            running = true
            Log.d("Fynix", "CoverArtServer: listening on port ${serverSocket?.localPort}")
            Thread {
                try {
                    while (running) {
                        try {
                            val client = serverSocket?.accept() ?: break
                            Thread { handleClient(client) }.start()
                        } catch (e: Exception) {
                            if (running) Log.e("Fynix", "CoverArtServer: accept error: ${e.message}")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("Fynix", "CoverArtServer: accept loop error: ${e.message}")
                }
            }.start()
        } catch (e: Exception) {
            Log.e("Fynix", "CoverArtServer: start failed: ${e.message}")
        }
    }

    fun stop() {
        running = false
        try { serverSocket?.close() } catch (_: Exception) {}
    }

    private fun handleClient(client: Socket) {
        try {
            val bytes = ByteArrayOutputStream()
            val buf = ByteArray(4096)
            var total = 0
            val input = client.getInputStream()
            while (total < 8192) {
                val n = input.read(buf, 0, buf.size)
                if (n < 0) break
                bytes.write(buf, 0, n)
                total += n
                if (total >= 4) {
                    val end = bytes.toByteArray()
                    if (end.size >= 4 &&
                        end[end.size - 1] == '\n'.code.toByte() &&
                        end[end.size - 2] == '\r'.code.toByte() &&
                        end[end.size - 3] == '\n'.code.toByte() &&
                        end[end.size - 4] == '\r'.code.toByte()) break
                }
            }
            val request = bytes.toString("UTF-8")
            val firstLine = request.lines().firstOrNull() ?: ""
            val parts = firstLine.split(" ")
            if (parts.size < 2) {
                respond(client.getOutputStream(), 400, "Bad Request")
                return
            }
            val path = parts[1]
            if (!path.startsWith("/cover?")) {
                respond(client.getOutputStream(), 404, "Not Found")
                return
            }
            val query = path.substringAfter("?")
            val params = query.split("&").mapNotNull { kv ->
                val eq = kv.indexOf('=')
                if (eq > 0) kv.substring(0, eq) to java.net.URLDecoder.decode(kv.substring(eq + 1), "UTF-8") else null
            }.toMap()
            val id = params["id"] ?: ""
            val size = params["size"] ?: "150"
            if (id.isBlank()) {
                respond(client.getOutputStream(), 400, "Missing id")
                return
            }
            val data = getCoverBytes(id, size)
            if (data != null) {
                respondBytes(client.getOutputStream(), data, "image/jpeg")
            } else {
                respond(client.getOutputStream(), 404, "Cover not found")
            }
        } catch (e: Exception) {
            Log.e("Fynix", "CoverArtServer: handle error: ${e.message}")
        } finally {
            try { client.close() } catch (_: Exception) {}
        }
    }

    private fun getCoverBytes(id: String, size: String): ByteArray? {
        val key = "$id|$size"
        cache[key]?.let { return it }
        try {
            if (serverUrl.isBlank()) return null
            val params = "u=${URLEncoder.encode(username, "UTF-8")}&p=enc:${hex(password)}&v=1.12.0&c=fynix&size=$size"
            val url = URL("$serverUrl/rest/getCoverArt.view?id=${URLEncoder.encode(id, "UTF-8")}&$params")
            Log.d("Fynix", "CoverArtServer: fetching $url")
            val conn = url.openConnection()
            conn.connectTimeout = 5000
            conn.readTimeout = 10000
            val bytes = conn.getInputStream().use { it.readBytes() }
            if (bytes.size > 100) {
                cache[key] = bytes
                return bytes
            }
        } catch (e: Exception) {
            Log.e("Fynix", "CoverArtServer: fetch failed: ${e.message}")
        }
        return null
    }

    private fun hex(password: String): String {
        val sb = StringBuilder()
        for (c in password) sb.append(String.format("%02x", c.code))
        return sb.toString()
    }

    private fun respond(out: OutputStream, code: Int, body: String) {
        val data = body.toByteArray()
        respondBytes(out, data, "text/plain", code)
    }

    private fun respondBytes(out: OutputStream, data: ByteArray, mime: String, code: Int = 200) {
        val status = if (code == 200) "OK" else if (code == 404) "Not Found" else "Error"
        val headers = "HTTP/1.1 $code $status\r\nContent-Type: $mime\r\nContent-Length: ${data.size}\r\nConnection: close\r\n\r\n"
        out.write(headers.toByteArray())
        out.write(data)
        out.flush()
    }
}
