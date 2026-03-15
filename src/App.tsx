import React, { useState, useEffect, useRef } from 'react';
import type { Song } from './services/api';
import { getTopWorld, getTopIndia, searchSongs } from './services/api';
import './App.css';

const App: React.FC = () => {
  const [worldSongs, setWorldSongs] = useState<Song[]>([]);
  const [indiaSongs, setIndiaSongs] = useState<Song[]>([]);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadTopCharts();
  }, []);

  const loadTopCharts = async () => {
    const world = await getTopWorld(10);
    const india = await getTopIndia(10);
    setWorldSongs(world);
    setIndiaSongs(india);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const results = await searchSongs(query);
    setSearchResults(results);
  };

  const playSong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = song.download['320kbps'] || song.download['160kbps'];
      audioRef.current.play();
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="app-container">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <header className="header glass-card">
        <div className="logo">
          <div className="logo-icon"></div>
          Melodix
        </div>
        <form onSubmit={handleSearch} className="search-container">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search songs, artists..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </header>

      {searchResults.length > 0 && (
        <section className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>Search Results</h2>
            <button onClick={() => setSearchResults([])} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>Close</button>
          </div>
          <div className="songs-grid">
            {searchResults.map(song => (
              <div key={song.id} className="song-card" onClick={() => playSong(song)}>
                <img src={song.image['150x150']} alt={song.title} className="song-image" />
                <div className="song-info">
                  <div className="song-title">{song.title}</div>
                  <div className="song-artist">{song.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Top Globally</h2>
        <div className="songs-grid">
          {worldSongs.map(song => (
            <div key={song.id} className="song-card" onClick={() => playSong(song)}>
              <img src={song.image['150x150']} alt={song.title} className="song-image" />
              <div className="song-info">
                <div className="song-title">{song.title}</div>
                <div className="song-artist">{song.artist}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Trending in India</h2>
        <div className="songs-grid">
          {indiaSongs.map(song => (
            <div key={song.id} className="song-card" onClick={() => playSong(song)}>
              <img src={song.image['150x150']} alt={song.title} className="song-image" />
              <div className="song-info">
                <div className="song-title">{song.title}</div>
                <div className="song-artist">{song.artist}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {currentSong && (
        <div className="music-player glass-card">
          <img src={currentSong.image['50x50']} alt={currentSong.title} className="song-image" style={{ width: '50px', height: '50px' }} />
          <div className="song-info">
            <div className="song-title">{currentSong.title}</div>
            <div className="song-artist">{currentSong.artist}</div>
          </div>
          <div className="player-controls">
            <button className="player-btn">⏮</button>
            <button className="player-btn play-pause-btn" onClick={togglePlay}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="player-btn">⏭</button>
          </div>
          <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
        </div>
      )}
    </div>
  );
};

export default App;
