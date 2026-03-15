import React, { useState, useEffect, useRef } from 'react';
import type { Song } from './services/api';
import { getTopWorld, getTopByCountry, searchSongs } from './services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Play, Pause, SkipForward, SkipBack, Music, Home, TrendingUp, X, Loader2, Globe } from 'lucide-react';
import './App.css';

const App: React.FC = () => {
  const [worldSongs, setWorldSongs] = useState<Song[]>([]);
  const [countrySongs, setCountrySongs] = useState<Song[]>([]);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const playSong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    
    if (audioRef.current) {
      const source = song.download['320kbps'] || song.download['160kbps'] || song.download['96kbps'];
      audioRef.current.src = source;
      audioRef.current.load();
      audioRef.current.play().catch(err => {
        console.error("Playback failed", err);
        setIsPlaying(false);
      });
    }
  };

  const togglePlay = () => {
    if (audioRef.current && currentSong) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="app-container">
      <div style={{ position: 'fixed', top: '10%', left: '10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(124, 77, 255, 0.08) 0%, transparent 70%)', zIndex: -1 }}></div>

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
                <div key={song.id} className="song-list-item" onClick={() => playSong(song)}>
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
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} key={song.id} className="trending-card" onClick={() => playSong(song)}>
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
                  <div key={song.id} className="song-list-item" onClick={() => playSong(song)}>
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

      <AnimatePresence>
        {currentSong && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="player-container">
            <div className="player-main">
              <img src={currentSong.image['150x150']} alt={currentSong.title} className="song-list-image" style={{ borderRadius: '12px' }} />
              <div className="player-info">
                <div className="player-title">{currentSong.title}</div>
                <div className="player-artist">{currentSong.artist}</div>
              </div>
              <div className="player-controls">
                <SkipBack size={24} fill="white" style={{ opacity: 0.5 }} />
                <button className="play-btn" onClick={togglePlay}>
                  {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" />}
                </button>
                <SkipForward size={24} fill="white" style={{ opacity: 0.5 }} />
              </div>
              <audio ref={audioRef} onEnded={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
