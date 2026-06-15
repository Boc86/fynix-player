package com.fynix.player

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var localServer: LocalServer

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestNotificationPermission()
        startLocalServer()
        setupWebView()
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100
                )
            }
        }
    }

    private fun startLocalServer() {
        localServer = LocalServer(assets, 8080)
        try {
            localServer.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupWebView() {
        webView = WebView(this)
        setContentView(webView)
        webView.apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowContentAccess = true
                allowFileAccess = false
                cacheMode = WebSettings.LOAD_NO_CACHE
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                userAgentString = settings.userAgentString + " FynixAndroid/1.0"
            }
            addJavascriptInterface(object {
                @JavascriptInterface
                fun updateNowPlaying(json: String) {
                    try {
                        val obj = org.json.JSONObject(json)
                        AudioService.updateNowPlaying(
                            this@MainActivity,
                            obj.optString("title", "Unknown"),
                            obj.optString("artist", ""),
                            obj.optString("album", ""),
                            obj.optString("coverArt", ""),
                            obj.optInt("duration", 0)
                        )
                    } catch (_: Exception) {}
                }

                @JavascriptInterface
                fun isPlaying(playing: Boolean) {
                    AudioService.setPlaying(this@MainActivity, playing)
                }

                @JavascriptInterface
                fun getVersion(): String = "1.0.0"
            } as Any, "AndroidBridge")

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    injectBridge()
                }
            }
            webChromeClient = WebChromeClient()
            loadUrl("http://localhost:8080")
        }
    }

    private fun injectBridge() {
        val js = """
(function() {
    if (window._fynixBridge) return;
    window._fynixBridge = true;

    function sendUpdate() {
        var p = window.player;
        if (!p) return;
        var state = p.getState ? p.getState() : {};
        var t = state.currentTrack;
        if (t) {
            AndroidBridge.updateNowPlaying(JSON.stringify({
                title: t.title || t.name || 'Unknown',
                artist: t.artist || t.artist_name || t.albumArtist || '',
                album: t.albumName || t.album || '',
                coverArt: t.coverUrl || '',
                duration: t.duration || 0
            }));
        }
        AndroidBridge.isPlaying(state.playing ? true : false);
    }

    var origLoad = window.player && window.player.on ? window.player.on : null;
    if (origLoad) {
        try { window.player.on('loaded', sendUpdate); } catch(e) {}
        try { window.player.on('play', sendUpdate); } catch(e) {}
        try { window.player.on('pause', sendUpdate); } catch(e) {}
        try { window.player.on('timeupdate', function() { AndroidBridge.isPlaying(true); }); } catch(e) {}
    }

    // Auto-configure Navidrome proxy to use local server
    var navProxy = 'http://localhost:8080';
    var settings = window.SettingsManager ? new window.SettingsManager() : null;
    if (settings) {
        var curr = settings.get('navidrome_proxy');
        if (!curr) {
            settings.save({ navidrome_proxy: navProxy });
            if (window.navidrome) window.navidrome.proxyUrl = navProxy;
        }
        var ssCurr = settings.get('soulsync_proxy');
        if (!ssCurr) {
            var s = {};
            s.soulsync_proxy = navProxy;
            settings.save(s);
            if (window.soulsync) window.soulsync.proxyUrl = navProxy;
        }
    }

    setInterval(function() {
        if (window.player && window.player.getState) {
            var s = window.player.getState();
            var t = s.currentTrack;
            if (t && t.coverUrl) {
                AndroidBridge.updateNowPlaying(JSON.stringify({
                    title: t.title || t.name || 'Unknown',
                    artist: t.artist || t.artist_name || t.albumArtist || '',
                    album: t.albumName || t.album || '',
                    coverArt: t.coverUrl || '',
                    duration: t.duration || 0
                }));
            }
            AndroidBridge.isPlaying(s.playing ? true : false);
        }
    }, 5000);
})();
""".trimIndent()
        webView.evaluateJavascript(js, null)
    }

    override fun onResume() {
        super.onResume()
        webView.evaluateJavascript(
            "window.player && window.player.updateNowPlaying && window.player.updateNowPlaying()", null
        )
    }

    override fun onDestroy() {
        localServer.stop()
        super.onDestroy()
    }
}
