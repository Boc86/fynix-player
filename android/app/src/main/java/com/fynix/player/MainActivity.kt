package com.fynix.player

import android.Manifest
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    companion object {
        var mediaActionCallback: ((String) -> Unit)? = null
        var playMediaCallback: ((String, String, String) -> Unit)? = null
    }

    private lateinit var webView: WebView
    private lateinit var localServer: LocalServer
    private var pageLoaded = false
    private var pendingMediaId: String? = null
    private var pendingParentType = ""
    private var pendingParentId = ""
    private var pendingAction: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        mediaActionCallback = { action -> handleMediaAction(action) }
        playMediaCallback = { mediaId, parentType, parentId ->
            if (pageLoaded) {
                webView.post { evaluatePlayMedia(mediaId, parentType, parentId) }
            } else {
                pendingMediaId = mediaId
                pendingParentType = parentType
                pendingParentId = parentId
            }
        }
        requestNotificationPermission()
        startLocalServer()
        setupWebView()
        queuePendingFromIntent(intent)
    }

    private fun enableEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun getMonetAccentColor(): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val resources = this.resources
            val resId = resources.getIdentifier("system_accent1_600", "color", "android")
            if (resId != 0) {
                try { return resources.getColor(resId, theme) } catch (_: Exception) {}
            }
        }
        // Fallback to orange
        return Color.rgb(255, 109, 0)
    }

    private fun colorToHex(color: Int): String {
        return String.format("#%06X", 0xFFFFFF and color)
    }

    private fun evaluatePlayMedia(mediaId: String, parentType: String, parentId: String) {
        val safeId = mediaId.replace("'", "\\'")
        val safeType = parentType.replace("'", "\\'")
        val safePid = parentId.replace("'", "\\'")
        webView.evaluateJavascript(
            "window.playMediaId('$safeId','$safeType','$safePid')", null
        )
    }

    private fun firePendingPlay() {
        val pa = pendingAction
        if (pa != null) {
            Log.d("Fynix", "firePendingPlay: action=$pa")
            pendingAction = null
            handleMediaAction(pa)
        }
        val mid = pendingMediaId ?: return
        Log.d("Fynix", "firePendingPlay: mediaId=$mid, type=$pendingParentType, pid=$pendingParentId")
        evaluatePlayMedia(mid, pendingParentType, pendingParentId)
        pendingMediaId = null
        pendingParentType = ""
        pendingParentId = ""
    }

    private fun queuePendingFromIntent(intent: Intent?) {
        val action = intent?.getStringExtra(AudioService.EXTRA_ACTION) ?: return
        if (action == AudioService.ACTION_PLAY_MEDIA) {
            pendingMediaId = intent.getStringExtra(BrowserService.EXTRA_MEDIA_ID)
            pendingParentType = intent.getStringExtra(BrowserService.EXTRA_PARENT_TYPE) ?: ""
            pendingParentId = intent.getStringExtra(BrowserService.EXTRA_PARENT_ID) ?: ""
        } else {
            pendingAction = action
        }
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
        WebView.setWebContentsDebuggingEnabled(true)
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
                mediaPlaybackRequiresUserGesture = false
            }
            addJavascriptInterface(object {
                @JavascriptInterface
                fun getNavidromeSettings(): String {
                    val prefs = getSharedPreferences("fynix_settings", MODE_PRIVATE)
                    val server = prefs.getString("navidrome_server", "") ?: ""
                    val username = prefs.getString("navidrome_username", "") ?: ""
                    val password = prefs.getString("navidrome_password", "") ?: ""
                    Log.d("Fynix", "getNavidromeSettings: server=$server, username=$username, hasPassword=${password.isNotEmpty()}")
                    if (server.isNotEmpty() && username.isNotEmpty() && password.isNotEmpty()) {
                        return org.json.JSONObject().apply {
                            put("server", server)
                            put("username", username)
                            put("password", password)
                        }.toString()
                    }
                    return "{}"
                }

                @JavascriptInterface
                fun saveNavidromeSettings(json: String) {
                    try {
                        val obj = org.json.JSONObject(json)
                        getSharedPreferences("fynix_settings", MODE_PRIVATE).edit().apply {
                            putString("navidrome_server", obj.optString("server", ""))
                            putString("navidrome_username", obj.optString("username", ""))
                            putString("navidrome_password", obj.optString("password", ""))
                            apply()
                        }
                    } catch (_: Exception) {}
                }

                @JavascriptInterface
                fun getSoulSyncSettings(): String {
                    val prefs = getSharedPreferences("fynix_settings", MODE_PRIVATE)
                    val server = prefs.getString("soulsync_server", "") ?: ""
                    val apiKey = prefs.getString("soulsync_apikey", "") ?: ""
                    if (server.isNotEmpty() && apiKey.isNotEmpty()) {
                        return org.json.JSONObject().apply {
                            put("server", server)
                            put("apiKey", apiKey)
                        }.toString()
                    }
                    return "{}"
                }

                @JavascriptInterface
                fun saveSoulSyncSettings(json: String) {
                    try {
                        val obj = org.json.JSONObject(json)
                        getSharedPreferences("fynix_settings", MODE_PRIVATE).edit().apply {
                            putString("soulsync_server", obj.optString("server", ""))
                            putString("soulsync_apikey", obj.optString("apiKey", ""))
                            apply()
                        }
                    } catch (_: Exception) {}
                }

                @JavascriptInterface
                fun saveAllSettings(json: String) {
                    try {
                        val obj = org.json.JSONObject(json)
                        getSharedPreferences("fynix_settings", MODE_PRIVATE).edit().apply {
                            putString("navidrome_server", obj.optString("navidrome_server", ""))
                            putString("navidrome_username", obj.optString("navidrome_username", ""))
                            putString("navidrome_password", obj.optString("navidrome_password", ""))
                            putString("soulsync_server", obj.optString("soulsync_server", ""))
                            putString("soulsync_apikey", obj.optString("soulsync_apikey", ""))
                            apply()
                        }
                    } catch (_: Exception) {}
                }

                @JavascriptInterface
                fun updateNowPlaying(json: String) {
                    try {
                        val obj = org.json.JSONObject(json)
                        AudioService.updateNowPlaying(
                            this@MainActivity,
                            title = obj.optString("title", "Unknown"),
                            artist = obj.optString("artist", ""),
                            album = obj.optString("album", ""),
                            coverArt = obj.optString("coverArt", ""),
                            duration = obj.optInt("duration", 0),
                            mediaId = obj.optString("mediaId", ""),
                            trackNumber = obj.optInt("track", 0),
                            albumArtist = obj.optString("albumArtist", "")
                        )
                    } catch (_: Exception) {}
                }

                @JavascriptInterface
                fun isPlaying(playing: Boolean) {
                    AudioService.setPlaying(this@MainActivity, playing)
                }

                @JavascriptInterface
                fun getVersion(): String = "1.0.0"

                @JavascriptInterface
                fun updatePosition(pos: Double) {
                    AudioService.updatePosition(pos.toLong() * 1000)
                }

                @JavascriptInterface
                fun getMonetAccent(): String {
                    return colorToHex(getMonetAccentColor())
                }

                @JavascriptInterface
                fun isEdgeToEdge(): Boolean {
                    return true
                }

                @JavascriptInterface
                fun enterPip() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val params = PictureInPictureParams.Builder()
                            .setAspectRatio(Rational(16, 9))
                            .build()
                        enterPictureInPictureMode(params)
                    }
                }
            } as Any, "AndroidBridge")

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    pageLoaded = true
                    injectBridge()
                    firePendingPlay()
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                    Log.d("WV", "${msg.message()} -- ${msg.sourceId()}:${msg.lineNumber()}")
                    return true
                }
            }
            loadUrl("http://localhost:8080")
        }
    }

    private fun injectBridge() {
        Log.d("Fynix", "injectBridge called, pageLoaded=$pageLoaded, pendingMediaId=$pendingMediaId")
        val js = """
(function() {
    if (window._fynixBridge) return;
    window._fynixBridge = true;

    // Restore all settings from SharedPreferences into localStorage
    try {
        var nav = JSON.parse(AndroidBridge.getNavidromeSettings());
        if (nav.server && nav.username && nav.password) {
            localStorage.setItem('navidrome_server', nav.server);
            localStorage.setItem('navidrome_username', nav.username);
            localStorage.setItem('navidrome_password', nav.password);
            if (window.__navidrome) {
                window.__navidrome.server = nav.server;
                window.__navidrome.username = nav.username;
                window.__navidrome.password = nav.password;
            }
        }
    } catch(e) { console.log('nav restore error:', e); }

    try {
        var ss = JSON.parse(AndroidBridge.getSoulSyncSettings());
        if (ss.server && ss.apiKey) {
            localStorage.setItem('soulsync_server', ss.server);
            localStorage.setItem('soulsync_apikey', ss.apiKey);
            if (window.soulsync) {
                window.soulsync.server = ss.server;
                window.soulsync.apiKey = ss.apiKey;
            }
        }
    } catch(e) { console.log('soulsync restore error:', e); }

    function pushSettingsToAndroid() {
        try {
            var ns = localStorage.getItem('navidrome_server') || '';
            var nu = localStorage.getItem('navidrome_username') || '';
            var np = localStorage.getItem('navidrome_password') || '';
            var ss = localStorage.getItem('soulsync_server') || '';
            var sa = localStorage.getItem('soulsync_apikey') || '';
            AndroidBridge.saveAllSettings(JSON.stringify({
                navidrome_server: ns,
                navidrome_username: nu,
                navidrome_password: np,
                soulsync_server: ss,
                soulsync_apikey: sa
            }));
        } catch(e) {}
    }

    // Inject Monet dynamic color
    try {
        var accent = AndroidBridge.getMonetAccent();
        if (accent) {
            document.documentElement.style.setProperty('--monet-accent', accent);
        }
    } catch(e) {}

    var _origSettingsSave = window.SettingsManager ? window.SettingsManager.prototype.save : null;
    if (_origSettingsSave) {
        window.SettingsManager.prototype.save = function(settings) {
            _origSettingsSave.call(this, settings);
            pushSettingsToAndroid();
        };
    }

    var _origSaveSettings = window.saveSettings;
    if (_origSaveSettings) {
        window.saveSettings = function() {
            _origSaveSettings();
            pushSettingsToAndroid();
        };
    }

    pushSettingsToAndroid();
    setTimeout(pushSettingsToAndroid, 1000);

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
                duration: t.duration || 0,
                mediaId: t.id || '',
                track: t.track || t.trackNumber || 0,
                albumArtist: t.albumArtist || t.album_artist || t.artist || ''
            }));
        }
        AndroidBridge.isPlaying(state.playing ? true : false);
        AndroidBridge.updatePosition(state.currentTime || 0);
    }

    var origLoad = window.player && window.player.on ? window.player.on : null;
    if (origLoad) {
        try { window.player.on('loaded', sendUpdate); } catch(e) {}
        try { window.player.on('play', sendUpdate); } catch(e) {}
        try { window.player.on('pause', sendUpdate); } catch(e) {}
        try { window.player.on('timeupdate', function() { AndroidBridge.isPlaying(true); }); } catch(e) {}
    }

    // Clear Navidrome proxy (direct connection for streaming, no proxy endpoint)
    try { localStorage.removeItem('navidrome_proxy'); } catch(e) {}
    if (window.__navidrome) window.__navidrome.proxyUrl = '';

    // Set SoulSync proxy to embedded local server (always localhost:8080 on Android)
    try { localStorage.setItem('soulsync_proxy', 'http://localhost:8080'); } catch(e) {}
    if (window.soulsync) window.soulsync.proxyUrl = 'http://localhost:8080';

    // Set MP3 transcoding for Android WebView (FLAC not supported)
    try { localStorage.setItem('navidrome_stream_format', 'mp3'); } catch(e) {}
    if (window.__navidrome) window.__navidrome.streamFormat = 'mp3';

    setInterval(function() {
        if (window.player && window.player.getState) {
            var s = window.player.getState();
            var t = s.currentTrack;
            if (t) {
                AndroidBridge.updateNowPlaying(JSON.stringify({
                    title: t.title || t.name || 'Unknown',
                    artist: t.artist || t.artist_name || t.albumArtist || '',
                    album: t.albumName || t.album || '',
                    coverArt: t.coverUrl || '',
                    duration: t.duration || 0,
                    mediaId: t.id || '',
                    track: t.track || t.trackNumber || 0,
                    albumArtist: t.albumArtist || t.album_artist || t.artist || ''
                }));
            }
            AndroidBridge.isPlaying(s.playing ? true : false);
            AndroidBridge.updatePosition(s.currentTime || 0);
        }
    }, 2000);

    // Send initial state immediately
    sendUpdate();
})();
""".trimIndent()
        webView.evaluateJavascript(js, null)
    }

    override fun onResume() {
        super.onResume()
        webView.evaluateJavascript(
            "window.player && window.player.updateNowPlaying && window.player.updateNowPlaying()", null
        )
        if (isInPictureInPictureMode) {
            webView.evaluateJavascript(
                "if (window.hideNowPlaying) window.hideNowPlaying()", null
            )
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (isInPictureInPictureMode) {
            webView.evaluateJavascript(
                "if (window.hideNowPlaying) window.hideNowPlaying()", null
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Log.d("Fynix", "onNewIntent: action=${intent.getStringExtra(AudioService.EXTRA_ACTION)}, pageLoaded=$pageLoaded")
        if (pageLoaded) {
            handleMediaAction(intent)
        } else {
            queuePendingFromIntent(intent)
        }
    }

    override fun onStart() {
        super.onStart()
        Log.d("Fynix", "onStart: pageLoaded=$pageLoaded, intent=${intent?.getStringExtra(AudioService.EXTRA_ACTION)}")
        if (pageLoaded) {
            handleMediaAction(intent)
        } else {
            queuePendingFromIntent(intent)
        }
    }

    private fun handleMediaAction(action: String) {
        val js = when (action) {
            AudioService.ACTION_TOGGLE -> "window.player && window.player.togglePlay()"
            AudioService.ACTION_PLAY -> {
                "window.player && (function(){ if (window.player.audio && window.player.audio.paused) window.player.togglePlay() })()"
            }
            AudioService.ACTION_PAUSE -> {
                "window.player && (function(){ if (window.player.audio && !window.player.audio.paused) window.player.togglePlay() })()"
            }
            AudioService.ACTION_NEXT -> "window.player && window.player.next()"
            AudioService.ACTION_PREV -> "window.player && window.player.prev()"
            AudioService.ACTION_SHUFFLE_ALL -> "window.shuffleAll ? window.shuffleAll() : console.log('shuffleAll not found')"
            else -> null
        }
        if (js != null) {
            webView.evaluateJavascript(js, null)
        }
    }

    private fun handleMediaAction(intent: Intent?) {
        val action = intent?.getStringExtra(AudioService.EXTRA_ACTION) ?: return
        Log.d("Fynix", "handleMediaAction intent: action=$action")
        if (action == AudioService.ACTION_PLAY_MEDIA) {
            val mediaId = intent.getStringExtra(BrowserService.EXTRA_MEDIA_ID) ?: return
            val parentType = intent.getStringExtra(BrowserService.EXTRA_PARENT_TYPE) ?: ""
            val parentId = intent.getStringExtra(BrowserService.EXTRA_PARENT_ID) ?: ""
            Log.d("Fynix", "handleMediaAction PLAY_MEDIA: id=$mediaId, type=$parentType, pid=$parentId")
            val safeId = mediaId.replace("'", "\\'")
            val safeType = parentType.replace("'", "\\'")
            val safePid = parentId.replace("'", "\\'")
            webView.evaluateJavascript(
                "window.playMediaId('$safeId','$safeType','$safePid')", null
            )
        } else if (action == AudioService.ACTION_SHUFFLE_ALL) {
            webView.evaluateJavascript("window.shuffleAll ? window.shuffleAll() : console.log('shuffleAll not found')", null)
        } else if (action == AudioService.ACTION_SEARCH) {
            val query = intent.getStringExtra("query") ?: return
            val escaped = query.replace("'", "\\'")
            webView.evaluateJavascript(
                "window.navigate('search');var i=document.getElementById('search-input');if(i){i.value='$escaped';setTimeout(function(){document.getElementById('search-btn')?.click()},100)}", null
            )
        } else {
            handleMediaAction(action)
        }
    }

    override fun onDestroy() {
        mediaActionCallback = null
        playMediaCallback = null
        pendingMediaId = null
        pendingParentType = ""
        pendingParentId = ""
        pendingAction = null
        pageLoaded = false
        localServer.stop()
        super.onDestroy()
    }
}
