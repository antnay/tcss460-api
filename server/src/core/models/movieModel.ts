// /**
//  * Movie model representing a complete movie with director and genre information
//  */
// export interface Movie {
//   title: string;
//   original_title: string;
//   directors: string;
//   genres: string;
//   release_date: Date;
//   runtime_minutes: number;
//   overview: string;
//   budget: number;
//   revenue: number;
//   mpa_rating: string;
//   poster_url: string;
//   backdrop_url: string;
// }

// /**
//  * Raw movie data from database (before type conversion)
//  */
// export interface MovieRow {
//   title: string;
//   original_title: string;
//   directors: string;
//   genres: string;
//   release_date: string | Date;
//   runtime_minutes: number;
//   overview: string;
//   budget: number;
//   revenue: number;
//   mpa_rating: string | null;
//   poster_url: string | null;
//   backdrop_url: string | null;
// }

// /**
//  * Movie with optional fields (for partial data or nullable columns)
//  */
// export interface MovieOptional {
//   title: string;
//   original_title: string;
//   directors: string;
//   genres: string;
//   release_date: Date;
//   runtime_minutes?: number;
//   overview?: string;
//   budget?: number;
//   revenue?: number;
//   mpa_rating?: string | null;
//   poster_url?: string | null;
//   backdrop_url?: string | null;
// }

/**
 * Movie model representing a complete movie entity with all required fields.
 * 
 * This interface represents the fully-typed movie object used throughout the application
 * after database retrieval and type conversion. All fields are required and properly typed.
 * 
 * @property title - The display title of the movie
 * @property original_title - The original title in the movie's native language
 * @property directors - Comma-separated string of director names
 * @property genres - Comma-separated string of genre classifications
 * @property release_date - The theatrical release date
 * @property runtime_minutes - Total duration of the movie in minutes
 * @property overview - Plot synopsis or description of the movie
 * @property budget - Production budget in USD
 * @property revenue - Box office revenue in USD
 * @property mpa_rating - MPAA rating (G, PG, PG-13, R, NC-17, etc.)
 * @property poster_url - URL to the movie's poster image
 * @property backdrop_url - URL to the movie's backdrop/banner image
 */
export interface Movie {
  title: string;
  original_title: string;
  directors: string;
  genres: string;
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
 * Raw movie data structure as retrieved directly from the database.
 * 
 * This interface represents the unprocessed movie data before type conversion.
 * String and nullable fields reflect the raw database schema and require
 * transformation to the Movie interface for application use.
 * 
 * Key differences from Movie interface:
 * - release_date may be a string (ISO format) that needs Date conversion
 * - mpa_rating, poster_url, and backdrop_url are nullable
 * 
 * @property title - The display title of the movie
 * @property original_title - The original title in the movie's native language
 * @property directors - Comma-separated string of director names
 * @property genres - Comma-separated string of genre classifications
 * @property release_date - Release date as string (ISO format) or Date object
 * @property runtime_minutes - Total duration of the movie in minutes
 * @property overview - Plot synopsis or description of the movie
 * @property budget - Production budget in USD
 * @property revenue - Box office revenue in USD
 * @property mpa_rating - MPAA rating (nullable if unavailable)
 * @property poster_url - URL to the movie's poster image (nullable if unavailable)
 * @property backdrop_url - URL to the movie's backdrop image (nullable if unavailable)
 */
export interface MovieRow {
  title: string;
  original_title: string;
  directors: string;
  genres: string;
  release_date: string | Date;
  runtime_minutes: number;
  overview: string;
  budget: number;
  revenue: number;
  mpa_rating: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
}

/**
 * Movie model with optional fields for partial data scenarios.
 * 
 * This interface is useful for:
 * - Partial movie updates where not all fields are provided
 * - API responses that may omit certain fields
 * - Form submissions during movie creation/editing
 * - Handling incomplete movie data from external sources
 * 
 * Core identifying fields (title, original_title, directors, genres, release_date)
 * remain required, while supplementary information is optional.
 * 
 * @property title - The display title of the movie (required)
 * @property original_title - The original title in the movie's native language (required)
 * @property directors - Comma-separated string of director names (required)
 * @property genres - Comma-separated string of genre classifications (required)
 * @property release_date - The theatrical release date (required)
 * @property runtime_minutes - Total duration in minutes (optional)
 * @property overview - Plot synopsis (optional)
 * @property budget - Production budget in USD (optional)
 * @property revenue - Box office revenue in USD (optional)
 * @property mpa_rating - MPAA rating (optional, nullable)
 * @property poster_url - URL to poster image (optional, nullable)
 * @property backdrop_url - URL to backdrop image (optional, nullable)
 */
export interface MovieOptional {
  title: string;
  original_title: string;
  directors: string;
  genres: string;
  release_date: Date;
  runtime_minutes?: number;
  overview?: string;
  budget?: number;
  revenue?: number;
  mpa_rating?: string | null;
  poster_url?: string | null;
  backdrop_url?: string | null;
}

/**
 * Audit log entry for tracking deleted movies.
 * 
 * This interface represents a record in the deletion audit log, preserving
 * key information about movies that have been removed from the system.
 * Used for compliance, data recovery, and audit trail purposes.
 * 
 * @property movie_id - The unique identifier of the deleted movie
 * @property title - The display title of the deleted movie
 * @property original_title - The original title (nullable if not available)
 * @property release_date - The theatrical release date (nullable if not available)
 * @property deleted_at - Timestamp when the movie was deleted
 * @property deleted_by - Username or identifier of the user who deleted the movie (optional)
 */
export interface MovieDeletionLog {
  movie_id: number;
  title: string;
  original_title: string | null;
  release_date: Date | null;
  deleted_at: Date;
  deleted_by?: string;
}