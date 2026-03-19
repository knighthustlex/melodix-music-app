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
  artist?: string; 
  artist_id?: string | number;
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
  artist_id?: string | number;
}

export interface Playlist {
  uuid: string;
  title: string;
  image: string;
  tracks: number;
  type: string;
}

export interface Artist {
  id: string | number;
  name: string;
  image: string;
  fans?: number;
  albums_count?: number;
  top_tracks: Song[];
  albums: Album[];
}

export interface Section {
  title: string;
  contents: (Song | Album | Playlist)[];
}

export interface StreamData {
  track_id: string;
  stream_url: string;
  audio_quality: string;
  codec: string;
}

const BASE_URL = window.location.hostname === 'localhost' ? 'https://flip-musix.vercel.app' : '/api/v1';
const LYRICS_BASE_URL = window.location.hostname === 'localhost' ? 'https://flip-lyrics.vercel.app/api/lyrics' : '/api/lyrics';

export const getSections = async (): Promise<Section[]> => {
  try {
    const response = await fetch(`${BASE_URL}/sections`);
    const result = await response.json();
    if (result.status === 'success' && result.data.sections) {
      return result.data.sections.map((section: any) => ({
        title: section.title,
        contents: section.items || []
      }));
    }
    return [];
  } catch (error) {
    console.error("API Error (getSections):", error);
    return [];
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

export const searchTracks = async (query: string, limit: number = 20): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/search/tracks?q=${encodeURIComponent(query)}&limit=${limit}`);
    const result = await response.json();
    return result.status === 'success' ? result.data.tracks : [];
  } catch (error) {
    console.error("API Error (searchTracks):", error);
    return [];
  }
};

export const searchAlbums = async (query: string, limit: number = 20): Promise<Album[]> => {
  try {
    const response = await fetch(`${BASE_URL}/search/albums?q=${encodeURIComponent(query)}&limit=${limit}`);
    const result = await response.json();
    return result.status === 'success' ? result.data.albums : [];
  } catch (error) {
    console.error("API Error (searchAlbums):", error);
    return [];
  }
};

export const searchArtists = async (query: string, limit: number = 20): Promise<Artist[]> => {
  try {
    const response = await fetch(`${BASE_URL}/search/artists?q=${encodeURIComponent(query)}&limit=${limit}`);
    const result = await response.json();
    return result.status === 'success' ? result.data.artists : [];
  } catch (error) {
    console.error("API Error (searchArtists):", error);
    return [];
  }
};

export const searchPlaylists = async (query: string, limit: number = 20): Promise<Playlist[]> => {
  try {
    const response = await fetch(`${BASE_URL}/search/playlists?q=${encodeURIComponent(query)}&limit=${limit}`);
    const result = await response.json();
    return result.status === 'success' ? result.data.playlists : [];
  } catch (error) {
    console.error("API Error (searchPlaylists):", error);
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

export const getArtistData = async (id: string | number): Promise<Artist | null> => {
  try {
    // If id is not numeric, search for the artist first to get their ID
    let numericId = id;
    if (isNaN(Number(id))) {
      const searchResults = await searchArtists(id.toString(), 1);
      if (searchResults && searchResults.length > 0) {
        numericId = searchResults[0].id;
      } else {
        return null;
      }
    }

    const response = await fetch(`${BASE_URL}/artist?id=${numericId}`);
    const result = await response.json();
    
    if ((result.status === 'success' || result.status === 'error') && result.data) {
      // API might return { artist: {}, tracks: [], albums: [] } or just the artist object
      const artistInfo = result.data.artist || result.data;
      return {
        id: artistInfo.id || result.data.artist_id || numericId,
        name: artistInfo.name || artistInfo.title || 'Unknown Artist',
        image: artistInfo.image || artistInfo.artist_image || '',
        fans: artistInfo.fans || 0,
        albums_count: artistInfo.albums_count || (result.data.albums ? result.data.albums.length : 0),
        top_tracks: result.data.tracks || result.data.top_tracks || artistInfo.top_tracks || [],
        albums: result.data.albums || artistInfo.albums || []
      };
    }
    
    // Fallback suggested by API error messages
    if (result.status === 'error' && result.message && result.message.includes('id=')) {
       const suggestedId = result.message.split('id=')[1].split('&')[0];
       if (suggestedId && suggestedId !== numericId.toString()) {
         return getArtistData(suggestedId);
       }
    }
    return null;
  } catch (error) {
    console.error("API Error (getArtistData):", error);
    return null;
  }
};

export const getRecommendations = async (id: string | number): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/recommend?id=${id}`);
    const result = await response.json();
    return result.status === 'success' ? result.data.recommendations || [] : [];
  } catch (error) {
    console.error("API Error (getRecommendations):", error);
    return [];
  }
};

export const getLyrics = async (artist: string, track: string) => {
  try {
    const response = await fetch(`${LYRICS_BASE_URL}?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
    const data = await response.json();
    return data && data.lyrics ? data.lyrics : null;
  } catch (error) {
    console.error("API Error (getLyrics):", error);
    return null;
  }
};