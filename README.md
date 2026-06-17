# Fynix Player

A mobile-first web + Android music player that connects to [Navidrome](https://www.navidrome.org/) (or any Subsonic-compatible server) and [SoulSync](https://github.com/Nezreka/SoulSync) for music browsing, playback, and wishlist management.

## Features

- **Navidrome integration** — browse albums, artists, playlists; search tracks; stream audio (MP3 transcoding); view cover art
- **SoulSync integration** — search tracks/albums/artists, manage wishlist
- **Navidrome → SoulSync wishlist** — add any Navidrome album tracks to your SoulSync wishlist with one tap
- **Queue management** — play, shuffle, repeat, seek, volume control
- **Shuffle All** — shuffle your entire library from Android Auto or in-app button
- **Material Design 3** — dark theme, orange accent, mobile-first responsive layout
- **Android app** — WebView wrapper with lock-screen controls and notification, persistent settings
- **Android Auto** — browse artists/albums/playlists from your car's head unit; voice search; Shuffle All

## Screenshots

*Coming soon*

## Usage

### Web version (development)

```bash
python3 server.py
```

Opens at `http://localhost:8080`. Enter your Navidrome and SoulSync credentials in Settings.

### Android APK

Download the latest APK from the [Releases](https://github.com/Boc86/fynix-player/releases) page and sideload it.

## Configuration

### Navidrome

| Setting | Description |
|---|---|
| Server URL | `https://your-navidrome.example.com` |
| Username | Your Navidrome username |
| Password | Your Navidrome password |

### SoulSync

| Setting | Description |
|---|---|
| Server URL | SoulSync server address (e.g., `http://your-soulsync-server:8008`) |
| API Key | Your SoulSync API key |

On Android, all SoulSync API calls go through the embedded local server proxy to bypass CORS restrictions in WebView. Settings are persisted in SharedPreferences and survive app updates.

## Building

```bash
cd android
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=/path/to/android-sdk
./gradlew assembleDebug
```

APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

Before building, sync the latest web assets:

```bash
cp js/*.js android/app/src/main/assets/web/js/
cp css/*.css android/app/src/main/assets/web/css/
cp index.html android/app/src/main/assets/web/
```

## Project Structure

```
├── js/                  # JavaScript modules
│   ├── app.js           # Main app with views and UI logic
│   ├── navidrome.js     # Subsonic API client
│   ├── player.js        # Audio queue engine
│   ├── settings.js      # LocalStorage settings manager
│   └── soulsync.js      # SoulSync REST API client
├── css/
│   └── style.css        # Material Design 3 dark theme
├── index.html           # Single-page app entry point
├── server.py            # Python CORS proxy dev server
├── assets/
│   └── logo.png         # App logo
└── android/
    └── app/src/main/java/com/fynix/player/
        ├── MainActivity.kt     # WebView + JS bridge + embeddded server
        ├── AudioService.kt     # Notification + lock-screen controls
        ├── BrowserService.kt   # Android Auto browse tree
        ├── MediaSessionHolder.kt # Shared MediaSession singleton
        ├── LocalServer.kt      # NanoHTTPD embedded proxy server
        └── NavidromeClient.kt  # Native Subsonic client for Auto
```

## Android Auto

Android Auto is supported via the `MediaBrowserService` API:

- **Browse**: Artists → Albums → Songs; Playlists; All Songs (Shuffle All)
- **Play**: Tap any album, playlist, or search result to start playback
- **Voice Search**: Use Google Assistant to search your music library
- **Shuffle All**: First item in the Playlists section shuffles your entire library

## License

MIT
