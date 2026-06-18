# Fynix Player

A light-weight, self-contained Android music player that connects to [Navidrome](https://www.navidrome.org/) and [SoulSync](https://github.com/Nezreka/SoulSync) for browsing, streaming, and downloading music. Built as a WebView wrapper with a custom embedded server — no external dependencies on the phone.

## Features

- **Navidrome streaming** — browse albums, artists, playlists; search tracks; stream via MP3 transcoding
- **SoulSync wishlist** — search SoulSync for tracks/albums/artists, add to wishlist, download directly into your Navidrome library
- **Navidrome → SoulSync flow** — one-tap add any album to your SoulSync wishlist
- **Queue management** — play, shuffle, repeat, seek, volume control
- **Shuffle All** — shuffle your entire library from the app or Android Auto
- **Rich metadata** — artist bios via MusicBrainz + Wikipedia, album details, clickable artist/album links throughout
- **Artist pages** — biography modal, discography search, genre tags, lifetime metadata
- **Lazy-loaded library** — albums/artists/tracks load in batches of 30 with infinite scroll
- **Dynamic color extraction** — album art drives accent colors in the now-playing screen
- **Blurred background** — frosted-glass backdrop in the now-playing overlay
- **Local CORS proxy** — embedded NanoHTTPD server inside the APK handles all SoulSync API requests (no external proxy needed)
- **Android Auto** — browse artists/albums/playlists from your car's head unit; voice search via Google Assistant
- **Lock-screen & notification controls** — play/pause/next/prev from notification, lockscreen, and Bluetooth
- **Settings persistence** — server credentials stored in Android SharedPreferences, survive app updates

## Download

Download the latest APK from the [Releases page](https://github.com/Boc86/fynix-player/releases) and sideload it on your Android device.

## Configuration

### Navidrome

| Setting | Description |
|---|---|
| Server URL | `http://your-navidrome-server:4533` |
| Username | Your Navidrome username |
| Password | Your Navidrome password |

### SoulSync

| Setting | Description |
|---|---|
| Server URL | `http://your-soulsync-server:8008` |
| API Key | Your SoulSync API key |

All SoulSync API calls go through the embedded local server proxy (no CORS issues). Settings are saved to Android SharedPreferences and survive app updates.

## Android Auto

Fynix Player supports Android Auto via the `MediaBrowserService` API:

- **Browse**: Artists → Albums → Songs; Playlists; All Songs (Shuffle All)
- **Play**: Tap any album, playlist, or search result
- **Voice Search**: Use Google Assistant to search your library
- **Shuffle All**: First item in Playlists shuffles your entire library

## Full Stack Setup

Fynix Player is designed as the Android front-end for a complete self-hosted music stack. Below is the recommended setup.

### Components

| Service | Role |
|---|---|
| [Navidrome](https://www.navidrome.org/) | Music server — streams your library to Fynix Player |
| [SoulSync](https://github.com/Nezreka/SoulSync) | Soulseek download manager — searches and downloads music into your library |
| [slskd](https://github.com/slskd/slskd) | Soulseek client daemon — handles peer-to-peer searches and transfers |
| [Fynix Player](https://github.com/Boc86/fynix-player) | Android front-end — browse, stream, and manage your wishlist |

### Docker Compose

A `docker-compose.yml` is included in the repo root. It wires all three services together with persistent storage and sensible defaults:

```yaml
version: "3.8"

services:
  soulsync:
    image: ghcr.io/nezreka/soulsync:latest
    restart: unless-stopped
    ports:
      - "8008:8008"
    environment:
      - TZ=Europe/London
    volumes:
      - /mnt/music/downloads:/host/downloads
      - /mnt/music/library:/host/music
      - /mnt/music/incoming:/host/incoming
      - music-stack_soulsync_config:/app/config
      - /mnt/music-stack/soulsync/data:/app/data
      - /mnt/music-stack/soulsync/logs:/app/logs
      - /mnt/music-stack/soulsync/scripts:/app/scripts
      - /mnt/music-stack/soulsync/transfer:/app/Transfer
      - /mnt/music-stack/soulsync/musicvideos:/app/MusicVideos
      - /mnt/music-stack/soulsync/downloads:/app/downloads

  slskd:
    image: slskd/slskd:latest
    restart: unless-stopped
    ports:
      - "5030:5030"
      - "5031:5031"
      - "50300:50300"
    environment:
      - TZ=Europe/London
    volumes:
      - /mnt/music/slskd/slskd.yml:/app/slskd.yml
      - /mnt/music:/music
      - /mnt/music-stack/slskd/config:/app/config

  navidrome:
    image: deluan/navidrome:latest
    user: "1000:1000"
    restart: unless-stopped
    ports:
      - "4533:4533"
    environment:
      - ND_MUSICFOLDER=/music
      - ND_DATAFOLDER=/data
      - ND_SCANINTERVAL=1m
      - ND_LOGLEVEL=info
    volumes:
      - /mnt/music/library:/music:ro
      - /mnt/music-stack/navidrome/data:/data

volumes:
  music-stack_soulsync_config:
```

### Data Flow

1. **slskd** handles Soulseek peer-to-peer searches and downloads
2. **SoulSync** manages the download queue, moves completed downloads to your music library, and notifies Navidrome to rescan
3. **Navidrome** scans the library and serves it via the Subsonic API
4. **Fynix Player** connects to Navidrome for browsing/streaming and to SoulSync for wishlist management

### Links

- [Navidrome GitHub](https://github.com/navidrome/navidrome)
- [SoulSync GitHub](https://github.com/Nezreka/SoulSync)
- [slskd GitHub](https://github.com/slskd/slskd)
- [Fynix Player GitHub](https://github.com/Boc86/fynix-player)

## License

MIT
