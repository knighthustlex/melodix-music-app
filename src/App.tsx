import React, { useState, useEffect, useRef } from 'react';
import type { Song, Album, Playlist, HomeData } from './services/api';
import { getHome, getStream, searchSongs, getLyrics, getAlbumTracks, getPlaylistTracks } from './services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Play, Pause, SkipForward, SkipBack, Music, Home, 
  TrendingUp, X, Loader2, ChevronDown, Repeat, Shuffle, 
  Repeat1, Download, Disc, LayoutGrid
} from 'lucide-react';
import './App.css';

type RepeatMode = 'none' | 'all' | 'one';
type PlayerTab = 'player' | 'lyrics';

interface ParsedLyric {
  time: number;
  text: string;
}

const App: React.FC = () => {
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  
  // Player State
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentQueue, setCurrentQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Theme State
  const [, setThemeColors] = useState({ primary: '#7c4dff', secondary: '#00e5ff' });
  
  // Lyrics State
  const [activeTab, setActiveTab] = useState<PlayerTab>('player');
  const [lyrics, setLyrics] = useState<ParsedLyric[]>([]);
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);
  
  // Queue Control State
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    loadInitialData();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentSong) {
      extractDominantColor(currentSong.image);
    }
  }, [currentSong]);

  const canvasCallbackRef = (node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node && isExpanded && activeTab === 'player' && analyserRef.current) {
      drawVisualizer();
    }
  };

  // Handle visualizer animation when expanded or tab changes
  useEffect(() => {
    if (isExpanded && activeTab === 'player' && canvasRef.current && analyserRef.current) {
      drawVisualizer();
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  }, [isExpanded, activeTab, currentSong]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const data = await getHome();
      setHomeData(data);
    } catch (error) {
      console.error("Failed to load home data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const extractDominantColor = (imgUrl: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const primary = `rgb(${r}, ${g}, ${b})`;
      const secondary = `rgb(${g}, ${b}, ${r})`; 
      setThemeColors({ primary, secondary });
      document.documentElement.style.setProperty('--theme-primary', primary);
      document.documentElement.style.setProperty('--theme-secondary', secondary);
    };
  };

  const initAudioContext = async () => {
    if (!audioRef.current || audioContextRef.current) return;
    
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaElementSource(audioRef.current);
      
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    } catch (err) {
      console.error("AudioContext initialization failed:", err);
    }
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      animationRef.current = requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim() || '#7c4dff';
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        // Gradient effect
        ctx.fillStyle = primaryColor;
        ctx.globalAlpha = 0.7;
        
        // Rounded bars
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 2;
      }
    };
    
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    renderFrame();
  };

  const handleDownload = async () => {
    if (!currentSong) return;
    setIsDownloading(true);
    try {
      const streamData = await getStream(currentSong.id);
      if (!streamData) return;
      const response = await fetch(streamData.stream_url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${currentSong.artists} - ${currentSong.title}.${streamData.codec}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const parseSyncedLyrics = (lrc: string): ParsedLyric[] => {
    const lines = lrc.split('\n');
    const parsed: ParsedLyric[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/;
    lines.forEach(line => {
      const match = line.match(timeRegex);
      if (match) {
        const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
        const text = line.replace(timeRegex, '').trim();
        if (text) parsed.push({ time, text });
      }
    });
    return parsed;
  };

  const fetchSongLyrics = async (song: Song) => {
    setIsLyricsLoading(true);
    setLyrics([]);
    setActiveLyricIndex(-1);
    try {
      const data = await getLyrics(song.artists, song.title);
      if (data && data.synced) setLyrics(parseSyncedLyrics(data.synced));
    } catch (err) {
      console.error("Lyrics error", err);
    } finally {
      setIsLyricsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchSongs(query, 15);
      setSearchResults(results || []);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  const playSong = async (song: Song, queue: Song[]) => {
    const index = queue.findIndex(s => s.id === song.id);
    setCurrentQueue(queue);
    setCurrentIndex(index);
    setCurrentSong(song);
    setIsPlaying(true);
    fetchSongLyrics(song);
    
    try {
      const streamData = await getStream(song.id);
      if (streamData && audioRef.current) {
        // Init AudioContext on first play interaction
        if (!audioContextRef.current) {
          await initAudioContext();
        } else if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        audioRef.current.src = streamData.stream_url;
        audioRef.current.load();
        audioRef.current.play().catch(console.error);
      }
    } catch (err) {
      console.error("Playback failed", err);
    }
  };

  const playAlbum = async (album: Album) => {
    setIsLoading(true);
    try {
      const tracks = await getAlbumTracks(album.id);
      if (tracks.length > 0) playSong(tracks[0], tracks);
    } finally {
      setIsLoading(false);
    }
  };

  const playPlaylist = async (playlist: Playlist) => {
    setIsLoading(true);
    try {
      const tracks = await getPlaylistTracks(playlist.uuid);
      if (tracks.length > 0) playSong(tracks[0], tracks);
    } finally {
      setIsLoading(false);
    }
  };

  const playNext = () => {
    if (currentQueue.length === 0) return;
    const nextIndex = isShuffle ? Math.floor(Math.random() * currentQueue.length) : (currentIndex + 1) % currentQueue.length;
    if (repeatMode === 'none' && !isShuffle && nextIndex === 0 && currentIndex === currentQueue.length - 1) {
      setIsPlaying(false);
      return;
    }
    playSong(currentQueue[nextIndex], currentQueue);
  };

  const playPrevious = () => {
    if (currentQueue.length === 0) return;
    playSong(currentQueue[(currentIndex - 1 + currentQueue.length) % currentQueue.length], currentQueue);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (audioRef.current && currentSong) {
      if (isPlaying) audioRef.current.pause();
      else {
        // Ensure AudioContext is resumed on play
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      if (total) setProgress((current / total) * 100);
      if (lyrics.length > 0) {
        const index = lyrics.findIndex((lyric, i) => current >= lyric.time && (!lyrics[i + 1] || current < lyrics[i + 1].time));
        if (index !== -1 && index !== activeLyricIndex) {
          setActiveLyricIndex(index);
          const lyricEl = document.getElementById(`lyric-${index}`);
          if (lyricEl && lyricsContainerRef.current) {
            lyricsContainerRef.current.scrollTo({
              top: lyricEl.offsetTop - lyricsContainerRef.current.offsetHeight / 2,
              behavior: 'smooth'
            });
          }
        }
      }
    }
  };

  return (
    <div className={`app-container ${isExpanded ? 'overflow-hidden' : ''}`}>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      {!isExpanded && (
        <>
          <header className="header">
            <div className="nav-bar">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="logo">
                <div className="logo-circle"><Music size={20} color="white" /></div>
                Melodix
              </motion.div>
              <Home size={24} className="text-secondary" />
            </div>
            <form onSubmit={handleSearch} className="search-bar-wrapper">
              <Search className="search-icon" size={20} color="rgba(255,255,255,0.5)" />
              <input type="text" className="search-input" placeholder="Search your vibe..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {isSearching ? <Loader2 size={18} className="search-icon spin" style={{ left: 'auto', right: '18px' }} /> : query && <X size={18} className="search-icon" style={{ left: 'auto', right: '18px', cursor: 'pointer' }} onClick={() => {setSearchResults([]); setQuery('');}} />}
            </form>
          </header>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="empty-state"><Loader2 size={40} className="spin" /><p>Tuning into the world...</p></div>
            ) : searchResults.length > 0 ? (
              <section className="glass-card">
                <div className="section-header"><h2>Search Results</h2><button onClick={() => setSearchResults([])} className="clear-btn">Clear</button></div>
                <div className="songs-grid">{searchResults.map(song => (<div key={song.id} className="song-list-item" onClick={() => playSong(song, searchResults)}><img src={song.image} alt={song.title} className="song-list-image" /><div className="player-info"><div className="player-title">{song.title}</div><div className="player-artist">{song.artists}</div></div><Play size={18} /></div>))}</div>
              </section>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                <section className="hero"><motion.h1 variants={itemVariants}>Discover Your <br/><span style={{ color: 'var(--theme-secondary)' }}>Next Favorite</span></motion.h1><motion.p variants={itemVariants}>Thousands of tracks, one destination.</motion.p></section>
                
                {homeData && (
                  <>
                    <section><div className="section-header"><TrendingUp size={20} color="var(--accent-color)" /><h2>New Tracks</h2></div><div className="horizontal-scroll">{homeData.new_tracks.map(song => (<motion.div whileHover={{ scale: 1.05 }} key={song.id} className="trending-card" onClick={() => playSong(song, homeData.new_tracks)}><img src={song.image} alt={song.title} className="trending-image" /><div className="player-title">{song.title}</div><div className="player-artist">{song.artists}</div></motion.div>))}</div></section>
                    <section><div className="section-header"><Disc size={20} color="var(--theme-primary)" /><h2>New Albums</h2></div><div className="horizontal-scroll">{homeData.new_albums.map(album => (<motion.div whileHover={{ scale: 1.05 }} key={album.id} className="trending-card" onClick={() => playAlbum(album)}><img src={album.image} alt={album.title} className="trending-image" style={{ borderRadius: '12px' }} /><div className="player-title">{album.title}</div><div className="player-artist">{album.artists}</div></motion.div>))}</div></section>
                    <section className="glass-card"><div className="section-header"><LayoutGrid size={20} color="var(--theme-secondary)" /><h2>Featured Playlists</h2></div><div className="songs-grid">{homeData.featured_playlists.map(playlist => (<div key={playlist.uuid} className="song-list-item" onClick={() => playPlaylist(playlist)}><img src={playlist.image} alt={playlist.title} className="song-list-image" /><div className="player-info"><div className="player-title">{playlist.title}</div><div className="player-artist">{playlist.tracks} Tracks • {playlist.type}</div></div><Play size={18} /></div>))}</div></section>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <audio 
        ref={audioRef} 
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate} 
        onEnded={() => repeatMode === 'one' ? (audioRef.current!.currentTime = 0, audioRef.current!.play()) : playNext()} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
      />

      <AnimatePresence>
        {currentSong && (
          <motion.div layout initial={isExpanded ? { y: 0, opacity: 1 } : { y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className={isExpanded ? "player-full-screen" : "player-container"}>
            {isExpanded ? (
              <>
                <div className="player-expanded-bg" style={{ backgroundImage: `url(${currentSong.image})`, backgroundSize: 'cover' }}></div>
                <div className="player-header"><button onClick={() => setIsExpanded(false)} className="clear-btn"><ChevronDown size={32} /></button><div><div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Now Playing</div><div style={{ fontWeight: 600 }}>Queue ({currentIndex + 1}/{currentQueue.length})</div></div><button className="clear-btn" onClick={handleDownload}>{isDownloading ? <Loader2 className="spin" /> : <Download size={24} />}</button></div>
                <div className="player-tabs"><button className={`tab-btn ${activeTab === 'player' ? 'active' : ''}`} onClick={() => setActiveTab('player')}>Player</button><button className={`tab-btn ${activeTab === 'lyrics' ? 'active' : ''}`} onClick={() => setActiveTab('lyrics')}>Lyrics</button></div>
                <AnimatePresence mode="wait">
                  {activeTab === 'player' ? (
                    <motion.div key="player-tab" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="player-artwork-container"><motion.div layoutId="artwork-container" className="player-artwork-wrapper"><motion.img layoutId="artwork-img" src={currentSong.image} alt={currentSong.title} className="player-artwork-expanded" /></motion.div></div>
                      <div className="player-details-expanded"><h1 className="player-title-expanded">{currentSong.title}</h1><p className="player-artist-expanded">{currentSong.artists}</p></div>
                      <canvas ref={canvasCallbackRef} className="visualizer-canvas" width={300} height={80}></canvas>
                    </motion.div>
                  ) : (
                    <motion.div key="lyrics-tab" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="lyrics-container" ref={lyricsContainerRef}>
                      {isLyricsLoading ? <Loader2 size={30} className="spin" /> : lyrics.length > 0 ? lyrics.map((lyric, i) => (<div key={i} id={`lyric-${i}`} className={`lyrics-line ${i === activeLyricIndex ? 'active' : ''}`} onClick={() => audioRef.current!.currentTime = lyric.time}>{lyric.text}</div>)) : <div className="lyrics-placeholder">No lyrics available.</div>}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="player-controls-expanded">
                  <div className="progress-container"><div className="progress-bar" onClick={(e) => {const rect = e.currentTarget.getBoundingClientRect(); audioRef.current!.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current!.duration;}}><div className="progress-fill" style={{ width: `${progress}%` }}></div></div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.8rem', opacity: 0.6 }}><span>{Math.floor((audioRef.current?.currentTime || 0) / 60)}:{Math.floor((audioRef.current?.currentTime || 0) % 60).toString().padStart(2, '0')}</span><span>{Math.floor((audioRef.current?.duration || 0) / 60)}:{Math.floor((audioRef.current?.duration || 0) % 60).toString().padStart(2, '0')}</span></div></div>
                  <div className="playback-buttons"><Shuffle size={24} onClick={() => setIsShuffle(!isShuffle)} color={isShuffle ? 'var(--secondary-color)' : 'white'} style={{ opacity: isShuffle ? 1 : 0.5 }} /><SkipBack size={32} fill="white" onClick={playPrevious} /><button className="play-btn btn-large" onClick={() => togglePlay()}>{isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" />}</button><SkipForward size={32} fill="white" onClick={playNext} /><div onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}>{repeatMode === 'one' ? <Repeat1 size={24} color="var(--secondary-color)" /> : <Repeat size={24} color={repeatMode === 'all' ? 'var(--secondary-color)' : 'white'} style={{ opacity: repeatMode === 'all' ? 1 : 0.5 }} />}</div></div>
                </div>
              </>
            ) : (
              <div className="player-main" onClick={() => setIsExpanded(true)}>
                <div className="player-mini-clickable"><motion.div layoutId="artwork-container" className="song-list-image"><motion.img layoutId="artwork-img" src={currentSong.image} alt={currentSong.title} className="player-artwork-expanded" /></motion.div><div className="player-info"><div className="player-title">{currentSong.title}</div><div className="player-artist">{currentSong.artists}</div></div></div>
                <div className="player-controls"><button className="play-btn" onClick={togglePlay}>{isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" />}</button></div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default App;
