export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: string;
  play_count: string;
  image: {
    "50x50": string;
    "150x150": string;
    "500x500": string;
    original: string;
  };
  download: {
    "12kbps": string;
    "48kbps": string;
    "96kbps": string;
    "160kbps": string;
    "320kbps": string;
  };
  language: string;
  rank?: number;
}

// Proxy through Vercel rewrites to avoid CORS issues
const BASE_URL = window.location.hostname === 'localhost' ? 'https://flip-saavn.vercel.app' : '/api/v1';

export const getTopWorld = async (limit: number = 20): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/top=world?limit=${limit}`);
    const data = await response.json();
    return data.chart || [];
  } catch (error) {
    console.error("API Error (getTopWorld):", error);
    return [];
  }
};

export const searchSongs = async (query: string, limit: number = 20): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("API Error (searchSongs):", error);
    return [];
  }
};

export const getTopIndia = async (limit: number = 20): Promise<Song[]> => {
  try {
    const response = await fetch(`${BASE_URL}/top=india?limit=${limit}`);
    const data = await response.json();
    return data.chart || [];
  } catch (error) {
    console.error("API Error (getTopIndia):", error);
    return [];
  }
};
