document.addEventListener("DOMContentLoaded", () => {
  const FEED_URL = "https://feeds.feedburner.com/BibleAnswersLive";
  const MAX_EPISODES = 12;

  const audio = document.getElementById("balAudio");
  const status = document.getElementById("balStatus");
  const titleEl = document.getElementById("balTrackTitle");
  const dateEl = document.getElementById("balTrackDate");
  const currentTimeEl = document.getElementById("balCurrentTime");
  const remainingTimeEl = document.getElementById("balRemainingTime");
  const progress = document.getElementById("balProgress");
  const playBtn = document.getElementById("balPlay");
  const prevBtn = document.getElementById("balPrev");
  const nextBtn = document.getElementById("balNext");
  const rewindBtn = document.getElementById("balRewind");
  const forwardBtn = document.getElementById("balForward");
  const muteBtn = document.getElementById("balMute");
  const volume = document.getElementById("balVolume");
  const speed = document.getElementById("balSpeed");
  const repeatBtn = document.getElementById("balRepeat");
  const shuffleBtn = document.getElementById("balShuffle");
  const refreshBtn = document.getElementById("balRefresh");
  const playlistEl = document.getElementById("balPlaylist");
  const playlistCount = document.getElementById("balPlaylistCount");
  const episodeLink = document.getElementById("balEpisodeLink");

  if (!audio || !playlistEl) return;

  let tracks = [];
  let currentIndex = 0;
  let repeatMode = 0; // 0 off, 1 all, 2 one
  let shuffle = false;
  let seeking = false;

  audio.volume = Number(volume?.value || 0.85);

  const clean = value => String(value || "").replace(/\s+/g, " ").trim();

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function getTagText(item, tagName) {
    const node = item.getElementsByTagName(tagName)[0];
    return node ? clean(node.textContent) : "";
  }

  function parseXmlFeed(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("Invalid RSS XML");

    return [...doc.getElementsByTagName("item")].map(item => {
      const enclosureNodes = [...item.getElementsByTagName("enclosure")];
      const audioEnclosure = enclosureNodes.find(node => {
        const type = (node.getAttribute("type") || "").toLowerCase();
        return type.startsWith("audio/") || /\.(mp3|m4a|aac)(\?|$)/i.test(node.getAttribute("url") || "");
      }) || enclosureNodes[0];

      const media = item.getElementsByTagName("media:content")[0];
      const audioUrl = clean(
        (audioEnclosure && audioEnclosure.getAttribute("url")) ||
        (media && media.getAttribute("url")) ||
        ""
      );

      return {
        title: getTagText(item, "title") || "Bible Answers Live",
        audio: audioUrl,
        date: getTagText(item, "pubDate"),
        link: getTagText(item, "link") || FEED_URL,
        duration: getTagText(item, "itunes:duration")
      };
    }).filter(item => item.audio);
  }

  function parseRss2Json(data) {
    if (!data || !Array.isArray(data.items)) return [];
    return data.items.map(item => {
      const enclosure = item.enclosure || {};
      const audioUrl = clean(enclosure.link || enclosure.url || item.audio || "");
      return {
        title: clean(item.title) || "Bible Answers Live",
        audio: audioUrl,
        date: item.pubDate || item.date || "",
        link: item.link || FEED_URL,
        duration: enclosure.duration || ""
      };
    }).filter(item => item.audio);
  }

  async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadFeed() {
    if (status) status.textContent = "Loading latest episodes…";
    if (refreshBtn) refreshBtn.disabled = true;

    const attempts = [
      async () => {
        const response = await fetchWithTimeout(FEED_URL, {}, 9000);
        if (!response.ok) throw new Error("Feed request failed");
        return parseXmlFeed(await response.text());
      },
      async () => {
        const api = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(FEED_URL);
        const response = await fetchWithTimeout(api, {}, 10000);
        if (!response.ok) throw new Error("RSS JSON request failed");
        return parseRss2Json(await response.json());
      },
      async () => {
        const api = "https://api.allorigins.win/raw?url=" + encodeURIComponent(FEED_URL);
        const response = await fetchWithTimeout(api, {}, 10000);
        if (!response.ok) throw new Error("RSS proxy request failed");
        return parseXmlFeed(await response.text());
      }
    ];

    let loaded = [];
    for (const attempt of attempts) {
      try {
        loaded = await attempt();
        if (loaded.length) break;
      } catch (error) {
        // Try the next source.
      }
    }

    tracks = loaded
      .filter(track => track.audio)
      .sort((a, b) => {
        const da = new Date(a.date).getTime() || 0;
        const db = new Date(b.date).getTime() || 0;
        return db - da;
      })
      .slice(0, MAX_EPISODES);

    if (!tracks.length) {
      if (status) status.textContent = "Unable to load the audio feed right now.";
      if (playlistEl) {
        playlistEl.innerHTML = "";
        const fallback = document.createElement("a");
        fallback.href = FEED_URL;
        fallback.target = "_blank";
        fallback.rel = "noopener";
        fallback.className = "bal-episode-link";
        fallback.textContent = "Open the Bible Answers Live RSS feed ↗";
        playlistEl.append(fallback);
      }
      if (refreshBtn) refreshBtn.disabled = false;
      return;
    }

    currentIndex = 0;
    renderPlaylist();
    loadTrack(0, false);
    if (status) status.textContent = "Latest RSS audio loaded.";
    if (playlistCount) playlistCount.textContent = `${tracks.length} episodes`;
    if (refreshBtn) refreshBtn.disabled = false;
  }

  function renderPlaylist() {
    playlistEl.innerHTML = "";
    tracks.forEach((track, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bal-playlist-item" + (index === currentIndex ? " active" : "");
      button.setAttribute("role", "listitem");
      button.dataset.index = String(index);

      const title = document.createElement("span");
      title.className = "bal-playlist-title";
      title.textContent = track.title;

      const date = document.createElement("span");
      date.className = "bal-playlist-date";
      date.textContent = formatDate(track.date);

      button.append(title, date);
      button.addEventListener("click", () => loadTrack(index, true));
      playlistEl.append(button);
    });
  }

  function setActivePlaylistItem() {
    [...playlistEl.querySelectorAll(".bal-playlist-item")].forEach((item, index) => {
      item.classList.toggle("active", index === currentIndex);
    });
    const active = playlistEl.querySelector(".bal-playlist-item.active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function updateMediaSession(track) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: "Bible Answers Live",
        album: "Latest Episodes"
      });
    } catch (error) {}
  }

  function loadTrack(index, autoplay = false) {
    if (!tracks.length) return;
    currentIndex = Math.max(0, Math.min(index, tracks.length - 1));
    const track = tracks[currentIndex];

    audio.src = track.audio;
    audio.load();

    titleEl.textContent = track.title;
    dateEl.textContent = formatDate(track.date);
    episodeLink.href = track.link || FEED_URL;
    progress.value = 0;
    currentTimeEl.textContent = "0:00";
    remainingTimeEl.textContent = "-0:00";
    setActivePlaylistItem();
    updateMediaSession(track);

    if (autoplay) {
      audio.play().catch(() => {
        if (status) status.textContent = "Press Play to start this episode.";
      });
    }
  }

  function randomIndex() {
    if (tracks.length <= 1) return currentIndex;
    let next = currentIndex;
    while (next === currentIndex) next = Math.floor(Math.random() * tracks.length);
    return next;
  }

  function moveTrack(direction, autoplay = true) {
    if (!tracks.length) return;

    let nextIndex;
    if (shuffle) {
      nextIndex = randomIndex();
    } else {
      nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = tracks.length - 1;
      if (nextIndex >= tracks.length) nextIndex = 0;
    }
    loadTrack(nextIndex, autoplay);
  }

  function updatePlayButton() {
    const playing = !audio.paused && !audio.ended;
    playBtn.textContent = playing ? "❚❚" : "▶";
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    playBtn.title = playing ? "Pause" : "Play";
  }

  function updateMuteButton() {
    if (audio.muted || audio.volume === 0) muteBtn.textContent = "🔇";
    else if (audio.volume < 0.5) muteBtn.textContent = "🔉";
    else muteBtn.textContent = "🔊";
  }

  playBtn?.addEventListener("click", () => {
    if (!tracks.length) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  prevBtn?.addEventListener("click", () => moveTrack(-1, true));
  nextBtn?.addEventListener("click", () => moveTrack(1, true));

  rewindBtn?.addEventListener("click", () => {
    audio.currentTime = Math.max(0, (audio.currentTime || 0) - 15);
  });

  forwardBtn?.addEventListener("click", () => {
    const end = Number.isFinite(audio.duration) ? audio.duration : (audio.currentTime || 0) + 30;
    audio.currentTime = Math.min(end, (audio.currentTime || 0) + 30);
  });

  progress?.addEventListener("input", () => {
    seeking = true;
    if (!Number.isFinite(audio.duration)) return;
    const target = (Number(progress.value) / 1000) * audio.duration;
    currentTimeEl.textContent = formatTime(target);
    remainingTimeEl.textContent = "-" + formatTime(Math.max(0, audio.duration - target));
  });

  progress?.addEventListener("change", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
    }
    seeking = false;
  });

  volume?.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    if (audio.volume > 0) audio.muted = false;
    updateMuteButton();
  });

  muteBtn?.addEventListener("click", () => {
    audio.muted = !audio.muted;
    updateMuteButton();
  });

  speed?.addEventListener("change", () => {
    audio.playbackRate = Number(speed.value) || 1;
  });

  repeatBtn?.addEventListener("click", () => {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.textContent = ["Repeat: Off", "Repeat: All", "Repeat: One"][repeatMode];
    repeatBtn.setAttribute("aria-pressed", repeatMode ? "true" : "false");
  });

  shuffleBtn?.addEventListener("click", () => {
    shuffle = !shuffle;
    shuffleBtn.textContent = shuffle ? "Shuffle: On" : "Shuffle: Off";
    shuffleBtn.setAttribute("aria-pressed", shuffle ? "true" : "false");
  });

  refreshBtn?.addEventListener("click", loadFeed);

  audio.addEventListener("play", updatePlayButton);
  audio.addEventListener("pause", updatePlayButton);
  audio.addEventListener("ended", () => {
    updatePlayButton();

    if (repeatMode === 2) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    if (currentIndex < tracks.length - 1 || repeatMode === 1 || shuffle) {
      moveTrack(1, true);
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    currentTimeEl.textContent = formatTime(audio.currentTime);
    remainingTimeEl.textContent = "-" + formatTime(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (seeking || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    progress.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    currentTimeEl.textContent = formatTime(audio.currentTime);
    remainingTimeEl.textContent = "-" + formatTime(Math.max(0, audio.duration - audio.currentTime));
  });

  audio.addEventListener("volumechange", updateMuteButton);

  audio.addEventListener("error", () => {
    if (status) status.textContent = "This episode could not be played. Try another episode.";
  });

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => audio.play());
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
      navigator.mediaSession.setActionHandler("previoustrack", () => moveTrack(-1, true));
      navigator.mediaSession.setActionHandler("nexttrack", () => moveTrack(1, true));
      navigator.mediaSession.setActionHandler("seekbackward", details => {
        audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 15));
      });
      navigator.mediaSession.setActionHandler("seekforward", details => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : Infinity;
        audio.currentTime = Math.min(duration, audio.currentTime + (details.seekOffset || 30));
      });
    } catch (error) {}
  }

  updatePlayButton();
  updateMuteButton();
  loadFeed();
});
