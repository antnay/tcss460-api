/**
 * Movie model representing a complete movie with director and genre information
 */
export interface Movie {
  title: string;
  original_title: string;
  director_name: string;
  genre_name: string;
  release_date: Date;
  runtime_minutes: number;
  overview: string;
  budget: number;
  revenue: number;
  mpa_rating: string;
  poster_url: string;
  backdrop_url: string;
}

/**
 * Raw movie data from database (before type conversion)
 */
export interface MovieRow {
  title: string;
  original_title: string;
  director_name: string;
  genre_name: string;
  release_date: string | Date;
  runtime_minutes: number;
  overview: string;
  budget: string | number;
  revenue: string | number;
  mpa_rating: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
}

/**
 * Movie with optional fields (for partial data or nullable columns)
 */
export interface MovieOptional {
  title: string;
  original_title: string;
  director_name: string;
  genre_name: string;
  release_date: Date;
  runtime_minutes?: number;
  overview?: string;
  budget?: number;
  revenue?: number;
  mpa_rating?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
}