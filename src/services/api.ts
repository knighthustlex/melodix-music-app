export interface Song {
  id: string | number;
  title: string;
  artists: string;
  album: string;
  album_id: string | number;
  image: string;
  duration: string;
  explicit: boolean;
  quality: string;
  tidal_url?: string;
  release?: string;
  popularity?: number;
  isrc?: string;
  track_number?: number;
  // Compatibility with old interface
  artist?: string; 
  download?: {
    "320kbps": string;
    "160kbps": string;
  };
}

export interface Album {
  id: string | number;
  title: string;
  artists: string;
  image: string;
  tracks: number;
  duration: string;
  release: string;
  quality: string;
}

export interface Playlist {
  uuid: string;
  title: string;
  image: string;
  tracks: number;
  type: string;
}

export interface HomeData {
  new_tracks: Song[];
  new_albums: Album[];
  featured_playlists: Playlist[];
}

export interface StreamData {
  track_id: string;
  stream_url: string;
  audio_quality: string;
  codec: string;
}

const BASE_URL = window.location.hostname === 'localhost' ? 'https://flip-musix.vercel.app' : '/api/v1';
const LYRICS_BASE_URL = window.location.hostname === 'localhost' ? 'https://flip-lyrics.vercel.app/api/lyrics' : '/api/lyrics';

export const getHome = async (): Promise<HomeData | null> => {
  try {
    const response = await fetch(`${BASE_URL}/home`);
    const result = await response.json();
    return result.status === 'success' ? result.data : null;
  } catch (error) {
    console.error("API Error (getHome):", error);
    return null;
  }
};

export const getStream = async (id: string | number): Promise<StreamData | null> => {
  try {
    const response = await fetch(`${BASE_URL}/stream?id=${id}`);
    const result = await response.json();
    return result.status === 'success' ? result.data : null;
  } catch (error) {
    console.error("API Error (getStream):", error);
    return null;
  }
};

export const searchSongs = async (query: string, limit: number = 20): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/search/tracks?q=${encodeURIComponent(query)}&limit=${limit}`);
    const result = await response.json();
    return result.status === 'success' ? result.data.tracks : [];
  } catch (error) {
    console.error("API Error (searchSongs):", error);
    return [];
  }
};

export const getAlbumTracks = async (id: string | number): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/album?id=${id}`);
    const result = await response.json();
    return result.status === 'success' ? result.data.tracks : [];
  } catch (error) {
    console.error("API Error (getAlbumTracks):", error);
    return [];
  }
};

export const getPlaylistTracks = async (id: string): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/playlist?id=${id}`);
    const result = await response.json();
    return result.status === 'success' ? result.data.tracks : [];
  } catch (error) {
    console.error("API Error (getPlaylistTracks):", error);
    return [];
  }
};

export const getLyrics = async (artist: string, track: string) => {
  try {
    const response = await fetch(`${LYRICS_BASE_URL}?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
    const data = await response.json();
    return data.status && data.lyrics ? data.lyrics : null;
  } catch (error) {
    console.error("API Error (getLyrics):", error);
    return null;
  }
};
