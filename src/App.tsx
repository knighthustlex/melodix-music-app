import React, { useState, useEffect, useRef } from 'react';
import type { Song } from './services/api';
import { getTopWorld, getTopByCountry, searchSongs, getLyrics } from './services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Play, Pause, SkipForward, SkipBack, Music, Home, 
  TrendingUp, X, Loader2, Globe, ChevronDown, Repeat, Shuffle, 
  Repeat1
} from 'lucide-react';
import './App.css';

type RepeatMode = 'none' | 'all' | 'one';
type PlayerTab = 'player' | 'lyrics';

interface ParsedLyric {
  time: number;
  text: string;
}

const App: React.FC = () => {
  const [worldSongs, setWorldSongs] = useState<Song[]>([]);
  const [countrySongs, setCountrySongs] = useState<Song[]>([]);
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

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [world, usaCharts] = await Promise.all([
        getTopWorld(12),
        getTopByCountry('usa', 12)
      ]);
      setWorldSongs(world || []);
      setCountrySongs(usaCharts || []);
    } catch (error) {
      console.error("Failed to load charts", error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseSyncedLyrics = (lrc: string): ParsedLyric[] => {
    const lines = lrc.split('\n');
    const parsed: ParsedLyric[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/;

    lines.forEach(line => {
      const match = line.match(timeRegex);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]);
        const time = minutes * 60 + seconds + milliseconds / 100;
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
      const data = await getLyrics(song.artist, song.title);
      if (data && data.synced) {
        setLyrics(parseSyncedLyrics(data.synced));
      }
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

  const clearSearch = () => {
    setSearchResults([]);
    setQuery('');
  };

  const playSong = (song: Song, queue: Song[]) => {
    const index = queue.findIndex(s => s.id === song.id);
    setCurrentQueue(queue);
    setCurrentIndex(index);
    setCurrentSong(song);
    setIsPlaying(true);
    fetchSongLyrics(song);
    
    if (audioRef.current) {
      const source = song.download['320kbps'] || song.download['160kbps'] || song.download['96kbps'];
      audioRef.current.src = source;
      audioRef.current.load();
      audioRef.current.play().catch(console.error);
    }
  };

  const playNext = () => {
    if (currentQueue.length === 0) return;
    let nextIndex = currentIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * currentQueue.length);
    } else {
      nextIndex = (currentIndex + 1) % currentQueue.length;
    }
    if (repeatMode === 'none' && !isShuffle && nextIndex === 0 && currentIndex === currentQueue.length - 1) {
      setIsPlaying(false);
      return;
    }
    playSong(currentQueue[nextIndex], currentQueue);
  };

  const playPrevious = () => {
    if (currentQueue.length === 0) return;
    const prevIndex = (currentIndex - 1 + currentQueue.length) % currentQueue.length;
    playSong(currentQueue[prevIndex], currentQueue);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (audioRef.current && currentSong) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      if (total) {
        setProgress((current / total) * 100);
      }

      // Update Active Lyric
      if (lyrics.length > 0) {
        const index = lyrics.findIndex((lyric, i) => {
          const nextLyric = lyrics[i + 1];
          return current >= lyric.time && (!nextLyric || current < nextLyric.time);
        });
        if (index !== -1 && index !== activeLyricIndex) {
          setActiveLyricIndex(index);
          // Scroll to active lyric
          const lyricEl = document.getElementById(`lyric-${index}`);
          if (lyricEl && lyricsContainerRef.current) {
            const container = lyricsContainerRef.current;
            container.scrollTo({
              top: lyricEl.offsetTop - container.offsetHeight / 2 + lyricEl.offsetHeight / 2,
              behavior: 'smooth'
            });
          }
        }
      }
    }
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      playNext();
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && isExpanded) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      audioRef.current.currentTime = percentage * audioRef.current.duration;
    }
  };

  const toggleRepeat = () => {
    if (repeatMode === 'none') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('none');
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className={`app-container ${isExpanded ? 'overflow-hidden' : ''}`}>
      <div style={{ position: 'fixed', top: '10%', left: '10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(124, 77, 255, 0.08) 0%, transparent 70%)', zIndex: -1 }}></div>

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
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search your vibe..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {isSearching ? (
                 <Loader2 size={18} className="search-icon spin" style={{ left: 'auto', right: '18px' }} />
              ) : query && (
                <X size={18} className="search-icon" style={{ left: 'auto', right: '18px', cursor: 'pointer' }} onClick={clearSearch} />
              )}
            </form>
          </header>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="empty-state">
                <Loader2 size={40} className="spin" style={{ margin: '0 auto 20px', display: 'block' }} />
                <p>Tuning into the world's best music...</p>
              </motion.div>
            ) : searchResults.length > 0 ? (
              <motion.section key="search-results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="glass-card">
                <div className="section-header">
                  <h2>Search Results</h2>
                  <button onClick={clearSearch} className="clear-btn">Clear</button>
                </div>
                <div className="songs-grid">
                  {searchResults.map(song => (
                    <div key={song.id} className="song-list-item" onClick={() => playSong(song, searchResults)}>
                      <img src={song.image['150x150']} alt={song.title} className="song-list-image" />
                      <div className="player-info">
                        <div className="player-title">{song.title}</div>
                        <div className="player-artist">{song.artist}</div>
                      </div>
                      <Play size={18} fill="white" />
                    </div>
                  ))}
                </div>
              </motion.section>
            ) : (
              <motion.div key="home-content" variants={containerVariants} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                <section className="hero">
                  <motion.h1 variants={itemVariants}>Discover Your <br/><span style={{ color: 'var(--secondary-color)' }}>Next Favorite</span></motion.h1>
                  <motion.p variants={itemVariants}>Thousands of tracks, one destination.</motion.p>
                </section>

                <motion.section variants={itemVariants}>
                  <div className="section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={20} color="var(--accent-color)" />
                      <h2>Trending Globally</h2>
                    </div>
                  </div>
                  <div className="horizontal-scroll">
                    {worldSongs.map(song => (
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} key={song.id} className="trending-card" onClick={() => playSong(song, worldSongs)}>
                        <img src={song.image['500x500']} alt={song.title} className="trending-image" />
                        <div className="player-title">{song.title}</div>
                        <div className="player-artist">{song.artist}</div>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>

                <motion.section variants={itemVariants} className="glass-card">
                  <div className="section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Globe size={20} color="var(--primary-color)" />
                      <h2>Top in USA</h2>
                    </div>
                  </div>
                  <div className="songs-grid">
                    {countrySongs.map(song => (
                      <div key={song.id} className="song-list-item" onClick={() => playSong(song, countrySongs)}>
                        <img src={song.image['150x150']} alt={song.title} className="song-list-image" />
                        <div className="player-info">
                          <div className="player-title">{song.title}</div>
                          <div className="player-artist">{song.artist}</div>
                        </div>
                        <Play size={18} />
                      </div>
                    ))}
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Persistent Audio Element */}
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded} 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Player Logic */}
      <AnimatePresence>
        {currentSong && (
          <motion.div 
            layout
            initial={isExpanded ? { y: 0, opacity: 1 } : { y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={isExpanded ? "player-full-screen" : "player-container"}
          >
            {isExpanded ? (
              <>
                <div className="player-expanded-bg" style={{ backgroundImage: `url(${currentSong.image.original})`, backgroundSize: 'cover' }}></div>
                
                <div className="player-header">
                  <button onClick={() => setIsExpanded(false)} className="clear-btn" style={{ padding: '10px' }}>
                    <ChevronDown size={32} />
                  </button>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }}>Now Playing</div>
                    <div style={{ fontWeight: 600 }}>Queue ({currentIndex + 1}/{currentQueue.length})</div>
                  </div>
                  <div style={{ width: '52px' }}></div>
                </div>

                <div className="player-tabs">
                  <button className={`tab-btn ${activeTab === 'player' ? 'active' : ''}`} onClick={() => setActiveTab('player')}>Player</button>
                  <button className={`tab-btn ${activeTab === 'lyrics' ? 'active' : ''}`} onClick={() => setActiveTab('lyrics')}>Lyrics</button>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'player' ? (
                    <motion.div 
                      key="player-tab" 
                      initial={{ opacity: 0, x: -20 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      exit={{ opacity: 0, x: 20 }}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                    >
                      <div className="player-artwork-container">
                        <motion.div layoutId="artwork-container" className="player-artwork-wrapper">
                          <motion.img layoutId="artwork-img" src={currentSong.image.original} alt={currentSong.title} className="player-artwork-expanded" />
                        </motion.div>
                      </div>

                      <div className="player-details-expanded">
                        <h1 className="player-title-expanded">{currentSong.title}</h1>
                        <p className="player-artist-expanded">{currentSong.artist}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="lyrics-tab" 
                      initial={{ opacity: 0, x: 20 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      exit={{ opacity: 0, x: -20 }}
                      className="lyrics-container"
                      ref={lyricsContainerRef}
                    >
                      {isLyricsLoading ? (
                        <div className="lyrics-placeholder">
                          <Loader2 size={30} className="spin" />
                        </div>
                      ) : lyrics.length > 0 ? (
                        lyrics.map((lyric, i) => (
                          <div 
                            key={i} 
                            id={`lyric-${i}`}
                            className={`lyrics-line ${i === activeLyricIndex ? 'active' : ''}`}
                            onClick={() => {
                              if (audioRef.current) audioRef.current.currentTime = lyric.time;
                            }}
                          >
                            {lyric.text}
                          </div>
                        ))
                      ) : (
                        <div className="lyrics-placeholder">No lyrics available for this track.</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="player-controls-expanded">
                  <div className="progress-container">
                    <div className="progress-bar" onClick={handleProgressClick}>
                      <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.8rem', opacity: 0.6 }}>
                      <span>{Math.floor((audioRef.current?.currentTime || 0) / 60)}:{Math.floor((audioRef.current?.currentTime || 0) % 60).toString().padStart(2, '0')}</span>
                      <span>{Math.floor((audioRef.current?.duration || 0) / 60)}:{Math.floor((audioRef.current?.duration || 0) % 60).toString().padStart(2, '0')}</span>
                    </div>
                  </div>

                  <div className="playback-buttons">
                    <Shuffle size={24} onClick={() => setIsShuffle(!isShuffle)} color={isShuffle ? 'var(--secondary-color)' : 'white'} style={{ opacity: isShuffle ? 1 : 0.5, cursor: 'pointer' }} />
                    <SkipBack size={32} fill="white" onClick={playPrevious} style={{ cursor: 'pointer' }} />
                    <button className="play-btn btn-large" onClick={() => togglePlay()}>
                      {isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" />}
                    </button>
                    <SkipForward size={32} fill="white" onClick={playNext} style={{ cursor: 'pointer' }} />
                    <div onClick={toggleRepeat} style={{ cursor: 'pointer' }}>
                      {repeatMode === 'one' ? <Repeat1 size={24} color="var(--secondary-color)" /> : <Repeat size={24} color={repeatMode === 'all' ? 'var(--secondary-color)' : 'white'} style={{ opacity: repeatMode === 'all' ? 1 : 0.5 }} />}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="player-main" onClick={() => setIsExpanded(true)}>
                <div className="player-mini-clickable">
                  <motion.div layoutId="artwork-container" className="song-list-image">
                    <motion.img layoutId="artwork-img" src={currentSong.image['150x150']} alt={currentSong.title} className="player-artwork-expanded" />
                  </motion.div>
                  <div className="player-info">
                    <div className="player-title">{currentSong.title}</div>
                    <div className="player-artist">{currentSong.artist}</div>
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

export default App;
