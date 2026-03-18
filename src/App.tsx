import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Song, Album, Playlist, Section, Artist } from './services/api';
import { 
  getStream, searchTracks, searchAlbums, searchArtists, searchPlaylists, 
  getLyrics, getAlbumTracks, getPlaylistTracks, getSections, getArtistData, getRecommendations 
} from './services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Play, Pause, SkipForward, SkipBack, Music, Home, 
  TrendingUp, X, Loader2, ChevronDown, Repeat, Shuffle, 
  Repeat1, Download, Disc, LayoutGrid, Volume2, VolumeX,
  History, Clock, MoreVertical, ListMusic, ArrowLeft,
  ArrowUpDown
} from 'lucide-react';
import './App.css';

type RepeatMode = 'none' | 'all' | 'one';
type PlayerTab = 'player' | 'lyrics' | 'queue';
type ViewMode = 'home' | 'search' | 'album' | 'playlist' | 'artist';
type SearchCategory = 'tracks' | 'albums' | 'artists' | 'playlists';
type SortMode = 'default' | 'popularity';

interface ParsedLyric {
  time: number;
  text: string;
}

const App: React.FC = () => {
  // Main Data States
  const [sections, setSections] = useState<Section[]>([]);
  const [history, setHistory] = useState<Song[]>(() => JSON.parse(localStorage.getItem('melodix_history') || '[]'));
  
  // Navigation & View State
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [activeViewData, setActiveViewData] = useState<any>(null); // Holds Album, Playlist, or Artist data
  const [viewTracks, setViewTracks] = useState<Song[]>([]);
  
  // Search State
  const [query, setQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategory>('tracks');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchAlbumsResult, setSearchAlbumsResult] = useState<Album[]>([]);
  const [searchArtistsResult, setSearchArtistsResult] = useState<Artist[]>([]);
  const [searchPlaylistsResult, setSearchPlaylistsResult] = useState<Playlist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  
  // Player State
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentQueue, setCurrentQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Action Menus & Modals
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
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
  const timerRef = useRef<any>(null);

  // --- Initialization & Hooks ---

  useEffect(() => {
    loadInitialData();
    
    // Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          playNext();
          break;
        case 'ArrowLeft':
          playPrevious();
          break;
        case 'KeyM':
          toggleMute();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentSong) {
      extractDominantColor(currentSong.image);
      addToHistory(currentSong);
    }
  }, [currentSong]); // eslint-disable-line react-hooks/exhaustive-deps

  // Visualizer hook
  useEffect(() => {
    if (isExpanded && activeTab === 'player' && canvasRef.current && analyserRef.current) {
      drawVisualizer();
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  }, [isExpanded, activeTab, currentSong]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Data Loading ---

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const sectionsData = await getSections();
      setSections(sectionsData);
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

  // --- Visualizer ---

  const drawVisualizer = useCallback(() => {
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
        ctx.fillStyle = primaryColor;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }
    };
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    renderFrame();
  }, []);

  const canvasCallbackRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node && isExpanded && activeTab === 'player' && analyserRef.current) {
      drawVisualizer();
    }
  }, [isExpanded, activeTab, drawVisualizer]);

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
      if (audioContext.state === 'suspended') await audioContext.resume();
    } catch (err) {
      console.error("AudioContext init failed:", err);
    }
  };

  // --- Search ---

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    setViewMode('search');
    try {
      if (searchCategory === 'tracks') {
        const results = await searchTracks(query, 20);
        setSearchResults(results || []);
      } else if (searchCategory === 'albums') {
        const results = await searchAlbums(query, 20);
        setSearchAlbumsResult(results || []);
      } else if (searchCategory === 'artists') {
        const results = await searchArtists(query, 20);
        setSearchArtistsResult(results || []);
      } else if (searchCategory === 'playlists') {
        const results = await searchPlaylists(query, 20);
        setSearchPlaylistsResult(results || []);
      }
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'search' && query.trim()) handleSearch();
  }, [searchCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- History & Queue Management ---

  const addToHistory = (song: Song) => {
    setHistory(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      const newHistory = [song, ...filtered].slice(0, 20);
      localStorage.setItem('melodix_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const queueNext = (song: Song, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentQueue.length === 0) {
      playSong(song, [song]);
    } else {
      const newQueue = [...currentQueue];
      newQueue.splice(currentIndex + 1, 0, song);
      setCurrentQueue(newQueue);
      showToast('Added to Play Next');
    }
    setActiveMenuId(null);
  };

  const queueLast = (song: Song, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentQueue.length === 0) {
      playSong(song, [song]);
    } else {
      setCurrentQueue([...currentQueue, song]);
      showToast('Added to Queue');
    }
    setActiveMenuId(null);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDownload = async () => {
    if (!currentSong) return;
    setIsDownloading(true);
    showToast('Preparing FLAC download...');
    try {
      const streamData = await getStream(currentSong.id);
      if (streamData && streamData.stream_url) {
        const link = document.createElement('a');
        link.href = streamData.stream_url;
        link.download = `${currentSong.title} - ${currentSong.artists}.flac`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Download started');
      }
    } catch (err) {
      showToast('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const activateSleepTimer = (minutes: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    showToast(`Sleep timer set for ${minutes} minutes`);
    
    let timeLeft = minutes;
    timerRef.current = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timerRef.current!);
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
      }
    }, 60000);
  };

  // --- Navigation Views ---

  const openAlbum = async (album: Album) => {
    setIsLoading(true);
    setViewMode('album');
    setActiveViewData(album);
    try {
      const tracks = await getAlbumTracks(album.id);
      setViewTracks(tracks);
    } finally {
      setIsLoading(false);
    }
  };

  const openPlaylist = async (playlist: Playlist) => {
    setIsLoading(true);
    setViewMode('playlist');
    setActiveViewData(playlist);
    try {
      const tracks = await getPlaylistTracks(playlist.uuid);
      setViewTracks(tracks);
    } finally {
      setIsLoading(false);
    }
  };

  const openArtist = async (artistId: string | number) => {
    setIsLoading(true);
    setViewMode('artist');
    try {
      const data = await getArtistData(artistId);
      setActiveViewData(data);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Playback Controls ---

  const fetchSongLyrics = async (song: Song) => {
    setIsLyricsLoading(true);
    setLyrics([]);
    setActiveLyricIndex(-1);
    try {
      const data = await getLyrics(song.artists, song.title);
      if (data && data.synced) setLyrics(parseSyncedLyrics(data.synced));
    } catch (err) {} finally {
      setIsLyricsLoading(false);
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

  const playAllViewTracks = () => {
    if (viewTracks.length > 0) playSong(viewTracks[0], viewTracks);
  };

  const playNext = async () => {
    if (currentQueue.length === 0) return;
    const nextIndex = isShuffle ? Math.floor(Math.random() * currentQueue.length) : (currentIndex + 1);
    
    if (nextIndex >= currentQueue.length) {
      if (repeatMode === 'all') {
        playSong(currentQueue[0], currentQueue);
      } else if (repeatMode === 'none') {
        // Infinite Radio: Fetch recommendations
        if (currentSong) {
          showToast('Finding similar tracks...');
          const recommendations = await getRecommendations(currentSong.id);
          if (recommendations && recommendations.length > 0) {
            const newQueue = [...currentQueue, ...recommendations];
            setCurrentQueue(newQueue);
            playSong(recommendations[0], newQueue);
          } else {
            setIsPlaying(false);
          }
        } else {
          setIsPlaying(false);
        }
      }
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
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val > 0 && isMuted) toggleMute();
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

  // --- Sub-components ---

  const QualityBadge = ({ quality }: { quality: string }) => {
    if (!quality) return null;
    const isLossless = quality.toLowerCase().includes('flac') || quality.toLowerCase().includes('lossless');
    const isHiRes = quality.toLowerCase().includes('hi-res') || quality.toLowerCase().includes('master');
    
    return (
      <span className={`quality-badge ${isHiRes ? 'hi-res' : isLossless ? 'lossless' : ''}`}>
        {isHiRes ? 'HI-RES' : isLossless ? 'LOSSLESS' : quality.toUpperCase()}
      </span>
    );
  };

  const sortTracks = (tracks: Song[]) => {
    if (sortMode === 'popularity') {
      return [...tracks].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }
    return tracks;
  };

  const SkeletonCard = () => (
    <div className="trending-card">
      <div className="trending-image skeleton"></div>
      <div className="skeleton skeleton-text"></div>
      <div className="skeleton skeleton-text short"></div>
    </div>
  );

  const SkeletonList = () => (
    <div className="song-list-item">
      <div className="song-list-image skeleton"></div>
      <div className="player-info" style={{ width: '100%' }}>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text short"></div>
      </div>
    </div>
  );

  const renderTrackItem = (song: Song, queue: Song[]) => (
    <div key={song.id} className="song-list-item" onClick={() => playSong(song, queue)} style={{ position: 'relative' }}>
      <img src={song.image} alt={song.title} className="song-list-image" />
      <div className="player-info">
        <div className="player-title" style={{ color: currentSong?.id === song.id ? 'var(--theme-primary)' : 'white' }}>
          {song.title}
          <QualityBadge quality={song.quality} />
        </div>
        <div className="player-artist" onClick={(e) => {
          if (song.artist_id) {
            e.stopPropagation();
            openArtist(song.artist_id);
          }
        }} style={{ cursor: song.artist_id ? 'pointer' : 'default' }}>
          {song.artists}
        </div>
      </div>
      <div className="track-meta" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {song.popularity !== undefined && <span style={{ opacity: 0.4, fontSize: '0.7rem' }}>{song.popularity}%</span>}
        <MoreVertical size={20} color="rgba(255,255,255,0.6)" onClick={(e) => {
          e.stopPropagation();
          setActiveMenuId(activeMenuId === song.id.toString() ? null : song.id.toString());
        }} />
      </div>
      
      <AnimatePresence>
        {activeMenuId === song.id.toString() && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="action-menu">
            <button className="action-btn" onClick={(e) => queueNext(song, e)}><Play size={16} /> Play Next</button>
            <button className="action-btn" onClick={(e) => queueLast(song, e)}><ListMusic size={16} /> Add to Queue</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className={`app-container ${isExpanded ? 'overflow-hidden' : ''}`} onClick={() => setActiveMenuId(null)}>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      {toastMessage && <div className="toast">{toastMessage}</div>}

      {!isExpanded && (
        <>
          <header className="header">
            <div className="nav-bar">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="logo" onClick={() => { setViewMode('home'); setQuery(''); }} style={{cursor: 'pointer'}}>
                <div className="logo-circle"><Music size={20} color="white" /></div>
                Melodix
              </motion.div>
              {viewMode !== 'home' ? (
                <ArrowLeft size={24} className="text-secondary" style={{cursor: 'pointer'}} onClick={() => setViewMode('home')} />
              ) : (
                <Home size={24} className="text-secondary" />
              )}
            </div>
            <form onSubmit={handleSearch} className="search-bar-wrapper">
              <Search className="search-icon" size={20} color="rgba(255,255,255,0.5)" />
              <input type="text" className="search-input" placeholder="Search tracks, albums..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {isSearching ? <Loader2 size={18} className="search-icon spin" style={{ left: 'auto', right: '18px' }} /> : query && <X size={18} className="search-icon" style={{ left: 'auto', right: '18px', cursor: 'pointer' }} onClick={() => {setQuery(''); setViewMode('home');}} />}
            </form>
          </header>

          <AnimatePresence mode="wait">
            
            {/* SEARCH VIEW */}
            {viewMode === 'search' && (
              <motion.div key="search-view" variants={containerVariants} initial="hidden" animate="show">
                <div className="category-tabs">
                  <div className={`tab-pill ${searchCategory === 'tracks' ? 'active' : ''}`} onClick={() => setSearchCategory('tracks')}>Tracks</div>
                  <div className={`tab-pill ${searchCategory === 'albums' ? 'active' : ''}`} onClick={() => setSearchCategory('albums')}>Albums</div>
                  <div className={`tab-pill ${searchCategory === 'artists' ? 'active' : ''}`} onClick={() => setSearchCategory('artists')}>Artists</div>
                  <div className={`tab-pill ${searchCategory === 'playlists' ? 'active' : ''}`} onClick={() => setSearchCategory('playlists')}>Playlists</div>
                </div>

                <section className="glass-card" style={{minHeight: '60vh'}}>
                  <div className="section-header">
                    <h2>Results for "{query}"</h2>
                    {searchCategory === 'tracks' && (
                      <button 
                        className={`sort-btn ${sortMode === 'popularity' ? 'active' : ''}`} 
                        onClick={() => setSortMode(sortMode === 'default' ? 'popularity' : 'default')}
                        style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', opacity: 0.7 }}
                      >
                        <ArrowUpDown size={16} /> Popularity
                      </button>
                    )}
                  </div>
                  <div className="songs-grid">
                    {isLoading || isSearching ? (
                      [...Array(6)].map((_, i) => <SkeletonList key={i} />)
                    ) : searchCategory === 'tracks' ? (
                      searchResults.length > 0 ? sortTracks(searchResults).map(song => renderTrackItem(song, searchResults)) : <p style={{padding:'20px', textAlign:'center', opacity:0.5}}>No tracks found.</p>
                    ) : searchCategory === 'albums' ? (
                      searchAlbumsResult.length > 0 ? searchAlbumsResult.map(album => (
                        <div key={album.id} className="song-list-item" onClick={() => openAlbum(album)}>
                          <img src={album.image} alt={album.title} className="song-list-image" style={{ borderRadius: '8px' }} />
                          <div className="player-info">
                            <div className="player-title">{album.title} <QualityBadge quality={album.quality} /></div>
                            <div className="player-artist">Album • {album.artists}</div>
                          </div>
                          <ChevronDown size={18} style={{transform: 'rotate(-90deg)'}}/>
                        </div>
                      )) : <p style={{padding:'20px', textAlign:'center', opacity:0.5}}>No albums found.</p>
                    ) : searchCategory === 'artists' ? (
                      searchArtistsResult.length > 0 ? searchArtistsResult.map(artist => (
                        <div key={artist.id} className="song-list-item" onClick={() => openArtist(artist.id)}>
                          <img src={artist.image} alt={artist.name} className="song-list-image" style={{ borderRadius: '50%' }} />
                          <div className="player-info">
                            <div className="player-title">{artist.name}</div>
                            <div className="player-artist">Artist • {artist.fans?.toLocaleString()} fans</div>
                          </div>
                          <ChevronDown size={18} style={{transform: 'rotate(-90deg)'}}/>
                        </div>
                      )) : <p style={{padding:'20px', textAlign:'center', opacity:0.5}}>No artists found.</p>
                    ) : (
                      searchPlaylistsResult.length > 0 ? searchPlaylistsResult.map(playlist => (
                        <div key={playlist.uuid} className="song-list-item" onClick={() => openPlaylist(playlist)}>
                          <img src={playlist.image} alt={playlist.title} className="song-list-image" style={{ borderRadius: '8px' }} />
                          <div className="player-info">
                            <div className="player-title">{playlist.title}</div>
                            <div className="player-artist">Playlist • {playlist.tracks} tracks</div>
                          </div>
                          <ChevronDown size={18} style={{transform: 'rotate(-90deg)'}}/>
                        </div>
                      )) : <p style={{padding:'20px', textAlign:'center', opacity:0.5}}>No playlists found.</p>
                    )}
                  </div>
                </section>
              </motion.div>
            )}

            {/* ARTIST DETAIL VIEW */}
            {viewMode === 'artist' && activeViewData && (
              <motion.div key="artist-view" variants={containerVariants} initial="hidden" animate="show" className="detail-view">
                <div className="detail-header">
                  <img src={activeViewData.image} className="detail-image" alt={activeViewData.name} style={{ borderRadius: '50%' }} />
                  <div className="detail-info">
                    <h1>{activeViewData.name}</h1>
                    <p>{activeViewData.fans?.toLocaleString()} fans • {activeViewData.albums_count} albums</p>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button className="play-all-btn" onClick={() => playSong(activeViewData.top_tracks[0], activeViewData.top_tracks)}>
                        <Play fill="white" size={16} /> Play Top Tracks
                      </button>
                    </div>
                  </div>
                </div>

                <section className="glass-card" style={{ marginTop: '20px' }}>
                  <div className="section-header"><h2>Top Tracks</h2></div>
                  <div className="songs-grid">
                    {activeViewData.top_tracks.map((song: Song) => renderTrackItem(song, activeViewData.top_tracks))}
                  </div>
                </section>

                <section style={{ marginTop: '40px' }}>
                  <div className="section-header"><Disc size={20} color="var(--theme-primary)" /><h2>Albums</h2></div>
                  <div className="horizontal-scroll">
                    {activeViewData.albums.map((album: Album) => (
                      <motion.div whileHover={{ scale: 1.05 }} key={album.id} className="trending-card" onClick={() => openAlbum(album)}>
                        <img src={album.image} alt={album.title} className="trending-image" style={{ borderRadius: '12px' }} />
                        <div className="player-title">{album.title} <QualityBadge quality={album.quality} /></div>
                        <div className="player-artist">{album.release}</div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              </motion.div>
            )}

            {/* ALBUM / PLAYLIST DETAIL VIEW */}
            {(viewMode === 'album' || viewMode === 'playlist') && activeViewData && (
              <motion.div key="detail-view" variants={containerVariants} initial="hidden" animate="show" className="detail-view">
                <div className="detail-header">
                  <img src={activeViewData.image} className="detail-image" alt="Cover" />
                  <div className="detail-info">
                    <h1>{activeViewData.title}</h1>
                    <p>{viewMode === 'album' ? activeViewData.artists : `${activeViewData.tracks} Tracks • ${activeViewData.type}`}</p>
                    <button className="play-all-btn" onClick={playAllViewTracks}><Play fill="white" size={16} /> Play All</button>
                  </div>
                </div>
                <section className="glass-card" style={{paddingTop: '10px'}}>
                  <div className="songs-grid">
                    {isLoading ? (
                       [...Array(5)].map((_, i) => <SkeletonList key={i} />)
                    ) : (
                      viewTracks.map((song, i) => (
                        <div key={song.id} className="song-list-item" onClick={() => playSong(song, viewTracks)}>
                          <div style={{opacity: 0.5, width: '20px', textAlign: 'center'}}>{i + 1}</div>
                          <div className="player-info">
                            <div className="player-title" style={{ color: currentSong?.id === song.id ? 'var(--theme-primary)' : 'white' }}>{song.title}</div>
                            <div className="player-artist">{song.artists}</div>
                          </div>
                          <MoreVertical size={20} color="rgba(255,255,255,0.6)" onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === song.id.toString() ? null : song.id.toString());
                          }} />
                           <AnimatePresence>
                            {activeMenuId === song.id.toString() && (
                              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="action-menu">
                                <button className="action-btn" onClick={(e) => queueNext(song, e)}><Play size={16} /> Play Next</button>
                                <button className="action-btn" onClick={(e) => queueLast(song, e)}><ListMusic size={16} /> Add to Queue</button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </motion.div>
            )}

            {/* HOME VIEW */}
            {viewMode === 'home' && (
              <motion.div key="home-view" variants={containerVariants} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                <section className="hero">
                  <motion.h1 variants={itemVariants}>Discover Your <br/><span style={{ color: 'var(--theme-secondary)' }}>Next Favorite</span></motion.h1>
                  <motion.p variants={itemVariants}>Thousands of tracks, one destination.</motion.p>
                </section>
                
                {history.length > 0 && (
                   <section>
                     <div className="section-header"><History size={20} color="var(--theme-secondary)" /><h2>Recently Played</h2></div>
                     <div className="horizontal-scroll">
                       {history.slice(0, 10).map(song => (
                         <motion.div whileHover={{ scale: 1.05 }} key={`hist-${song.id}`} className="trending-card" onClick={() => playSong(song, history)}>
                           <img src={song.image} alt={song.title} className="trending-image" />
                           <div className="player-title">{song.title} <QualityBadge quality={song.quality} /></div>
                           <div className="player-artist">{song.artists}</div>
                         </motion.div>
                       ))}
                     </div>
                   </section>
                )}

                {isLoading || sections.length === 0 ? (
                  <>
                    <section>
                      <div className="section-header"><TrendingUp size={20} color="var(--accent-color)" /><h2>Loading...</h2></div>
                      <div className="horizontal-scroll">
                        {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                      </div>
                    </section>
                    <section className="glass-card">
                       <div className="section-header"><LayoutGrid size={20} color="var(--theme-secondary)" /><h2>Featured</h2></div>
                       <div className="songs-grid">
                         {[...Array(5)].map((_, i) => <SkeletonList key={i} />)}
                       </div>
                    </section>
                  </>
                ) : (
                  sections.map((section, idx) => (
                    <section key={idx} className={section.contents.length > 5 ? '' : 'glass-card'}>
                      <div className="section-header">
                        {idx % 3 === 0 ? <TrendingUp size={20} color="var(--accent-color)" /> : 
                         idx % 3 === 1 ? <Disc size={20} color="var(--theme-primary)" /> : 
                         <LayoutGrid size={20} color="var(--theme-secondary)" />}
                        <h2>{section.title}</h2>
                      </div>
                      
                      {section.contents[0] && ('type' in section.contents[0] || section.contents.length <= 5) ? (
                        <div className="songs-grid">
                          {section.contents.map((item: any) => {
                            if ('uuid' in item) { // Playlist
                              return (
                                <div key={item.uuid} className="song-list-item" onClick={() => openPlaylist(item)}>
                                  <img src={item.image} alt={item.title} className="song-list-image" />
                                  <div className="player-info">
                                    <div className="player-title">{item.title}</div>
                                    <div className="player-artist">{item.tracks} Tracks • {item.type}</div>
                                  </div>
                                  <ChevronDown size={18} style={{transform: 'rotate(-90deg)'}}/>
                                </div>
                              );
                            } else if ('tracks' in item) { // Album
                              return (
                                <div key={item.id} className="song-list-item" onClick={() => openAlbum(item)}>
                                  <img src={item.image} alt={item.title} className="song-list-image" />
                                  <div className="player-info">
                                    <div className="player-title">{item.title} <QualityBadge quality={item.quality} /></div>
                                    <div className="player-artist">{item.artists}</div>
                                  </div>
                                  <ChevronDown size={18} style={{transform: 'rotate(-90deg)'}}/>
                                </div>
                              );
                            } else { // Song
                              return renderTrackItem(item, section.contents as Song[]);
                            }
                          })}
                        </div>
                      ) : (
                        <div className="horizontal-scroll">
                          {section.contents.map((item: any) => (
                            <motion.div 
                              whileHover={{ scale: 1.05 }} 
                              key={item.id || item.uuid} 
                              className="trending-card" 
                              onClick={() => 'tracks' in item ? openAlbum(item) : 'uuid' in item ? openPlaylist(item) : playSong(item, section.contents as Song[])}
                            >
                              <img src={item.image} alt={item.title} className="trending-image" style={{ borderRadius: 'tracks' in item || 'uuid' in item ? '12px' : '8px' }} />
                              <div className="player-title">{item.title} {'quality' in item && <QualityBadge quality={item.quality} />}</div>
                              <div className="player-artist">{item.artists || item.type}</div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </section>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Hidden Audio Element */}
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
                <div className="player-header">
                  <button onClick={() => setIsExpanded(false)} className="clear-btn"><ChevronDown size={32} /></button>
                  <div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Now Playing</div>
                    <div style={{ fontWeight: 600 }}>Queue ({currentIndex + 1}/{currentQueue.length})</div>
                  </div>
                  <div style={{position: 'relative'}}>
                    <MoreVertical size={24} color="white" onClick={() => setActiveMenuId(activeMenuId === 'player-menu' ? null : 'player-menu')} style={{cursor: 'pointer'}} />
                    <AnimatePresence>
                      {activeMenuId === 'player-menu' && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="action-menu" style={{top: '30px', right: 0}}>
                          <button className="action-btn" onClick={() => { handleDownload(); setActiveMenuId(null); }}>
                            {isDownloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Download Flac
                          </button>
                          <button className="action-btn" onClick={() => { activateSleepTimer(15); setActiveMenuId(null); }}><Clock size={16} /> Sleep: 15m</button>
                          <button className="action-btn" onClick={() => { activateSleepTimer(30); setActiveMenuId(null); }}><Clock size={16} /> Sleep: 30m</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="player-tabs">
                  <button className={`tab-btn ${activeTab === 'player' ? 'active' : ''}`} onClick={() => setActiveTab('player')}>Player</button>
                  <button className={`tab-btn ${activeTab === 'lyrics' ? 'active' : ''}`} onClick={() => setActiveTab('lyrics')}>Lyrics</button>
                  <button className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>Queue</button>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'player' ? (
                    <motion.div key="player-tab" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="player-artwork-container">
                        <motion.div layoutId="artwork-container" className="player-artwork-wrapper">
                          <motion.img layoutId="artwork-img" src={currentSong.image} alt={currentSong.title} className="player-artwork-expanded" />
                        </motion.div>
                      </div>
                      <div className="player-details-expanded">
                        <h1 className="player-title-expanded">{currentSong.title}</h1>
                        <p className="player-artist-expanded">{currentSong.artists}</p>
                      </div>
                      <canvas ref={canvasCallbackRef} className="visualizer-canvas" width={300} height={80}></canvas>
                    </motion.div>
                  ) : activeTab === 'lyrics' ? (
                    <motion.div key="lyrics-tab" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="lyrics-container" ref={lyricsContainerRef}>
                      {isLyricsLoading ? <Loader2 size={30} className="spin" /> : lyrics.length > 0 ? lyrics.map((lyric, i) => (
                        <div key={i} id={`lyric-${i}`} className={`lyrics-line ${i === activeLyricIndex ? 'active' : ''}`} onClick={() => audioRef.current!.currentTime = lyric.time}>{lyric.text}</div>
                      )) : <div className="lyrics-placeholder">No synced lyrics available for this track.</div>}
                    </motion.div>
                  ) : (
                    <motion.div key="queue-tab" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
                      <h3 style={{opacity: 0.5, marginTop: 0}}>Up Next</h3>
                      {currentQueue.slice(currentIndex + 1).map((song, i) => (
                        <div key={i + currentIndex} className="song-list-item" onClick={() => playSong(song, currentQueue)} style={{background: 'rgba(0,0,0,0.2)', marginBottom: '5px'}}>
                           <img src={song.image} alt={song.title} className="song-list-image" />
                           <div className="player-info">
                             <div className="player-title">{song.title}</div>
                             <div className="player-artist">{song.artists}</div>
                           </div>
                        </div>
                      ))}
                      {currentQueue.slice(currentIndex + 1).length === 0 && <p style={{textAlign: 'center', opacity: 0.5}}>No tracks in queue.</p>}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="player-controls-expanded">
                  <div className="volume-container">
                    {isMuted || volume === 0 ? <VolumeX size={20} color="rgba(255,255,255,0.6)" onClick={toggleMute} style={{cursor:'pointer'}} /> : <Volume2 size={20} color="rgba(255,255,255,0.6)" onClick={toggleMute} style={{cursor:'pointer'}}/>}
                    <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="volume-slider" />
                  </div>

                  <div className="progress-container">
                    <div className="progress-bar" onClick={(e) => {const rect = e.currentTarget.getBoundingClientRect(); audioRef.current!.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current!.duration;}}>
                      <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.8rem', opacity: 0.6 }}>
                      <span>{Math.floor((audioRef.current?.currentTime || 0) / 60)}:{Math.floor((audioRef.current?.currentTime || 0) % 60).toString().padStart(2, '0')}</span>
                      <span>{Math.floor((audioRef.current?.duration || 0) / 60)}:{Math.floor((audioRef.current?.duration || 0) % 60).toString().padStart(2, '0')}</span>
                    </div>
                  </div>

                  <div className="playback-buttons">
                    <Shuffle size={24} onClick={() => setIsShuffle(!isShuffle)} color={isShuffle ? 'var(--secondary-color)' : 'white'} style={{ opacity: isShuffle ? 1 : 0.5, cursor:'pointer' }} />
                    <SkipBack size={32} fill="white" onClick={playPrevious} style={{cursor:'pointer'}}/>
                    <button className="play-btn btn-large" onClick={() => togglePlay()}>
                      {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" />}
                    </button>
                    <SkipForward size={32} fill="white" onClick={playNext} style={{cursor:'pointer'}}/>
                    <div onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')} style={{cursor:'pointer'}}>
                      {repeatMode === 'one' ? <Repeat1 size={24} color="var(--secondary-color)" /> : <Repeat size={24} color={repeatMode === 'all' ? 'var(--secondary-color)' : 'white'} style={{ opacity: repeatMode === 'all' ? 1 : 0.5 }} />}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="player-main" onClick={() => setIsExpanded(true)}>
                <div className="player-mini-clickable">
                  <motion.div layoutId="artwork-container" className="song-list-image">
                    <motion.img layoutId="artwork-img" src={currentSong.image} alt={currentSong.title} className="player-artwork-expanded" />
                  </motion.div>
                  <div className="player-info">
                    <div className="player-title">{currentSong.title}</div>
                    <div className="player-artist">{currentSong.artists}</div>
                  </div>
                </div>
                <div className="player-controls">
                  <button className="play-btn" onClick={togglePlay}>
                    {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" />}
                  </button>
                </div>
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
