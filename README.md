# Fynic Player

A mobile-first web + Android music player that connects to [Navidrome](https://www.navidrome.org/) (or any Subsonic-compatible server) and [SoulSync](https://github.com/Nezreka/SoulSync) for music browsing, playback, and wishlist management.

## Features

- **Navidrome integration** — browse albums, artists, playlists; search tracks; stream audio; view cover art
- **SoulSync integration** — search tracks/albums/artists, manage wishlist
- **Queue management** — play, shuffle, repeat, seek, volume control
- **Material Design 3** — dark theme, orange accent, mobile-first responsive layout
- **Android app** — WebView wrapper with lock-screen controls and notification
- **Android Auto** — browse artists/albums/playlists from your car's head unit

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
| Proxy URL | (Android only) Auto-set to `http://localhost:8080` |

### SoulSync
| Setting | Description |
|---|---|
| Server URL | SoulSync server address (e.g., `http://100.76.116.120:8008`) |
| API Key | Your SoulSync API key |
| Proxy URL | (Android only) Auto-set to `http://localhost:8080` |

On Android, all API calls go through the local server proxy to bypass CORS restrictions in WebView.

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
        ├── MainActivity.kt   # WebView + JS bridge + server
        ├── AudioService.kt   # Notification + lock-screen controls
        ├── BrowserService.kt # Android Auto browse tree
        ├── LocalServer.kt    # NanoHTTPD proxy server
        └── NavidromeClient.kt # Native Subsonic client for Auto
```

## License

MIT
