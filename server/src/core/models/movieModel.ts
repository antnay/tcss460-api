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
 * Movie model representing a complete movie with director and genre information
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
 * Raw movie data from database (before type conversion)
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
 * Movie with optional fields (for partial data or nullable columns)
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
 * Cast member information for a movie
 */
export interface CastMember {
  actor_name: string;
  character_name?: string;
  profile_url?: string;
  actor_order: number; // 1-10
}

/**
 * Studio information
 */
export interface Studio {
  studio_name: string;
  logo_url?: string;
  country?: string;
}

/**
 * Input for creating a new movie (all related entities as arrays)
 */
export interface MovieCreateInput {
  // Required fields
  title: string;
  original_title: string;
  release_date: string; // YYYY-MM-DD format
  runtime_minutes: number;
  genres: string[]; // Array of genre names
  overview: string;
  mpa_rating: string; // PG, PG-13, R
  
  // Optional financial data
  budget?: number;
  revenue?: number;
  
  // Optional related entities
  directors?: string[]; // Array of director names
  producers?: string[]; // Array of producer names
  studios?: Studio[]; // Array of studio objects
  cast?: CastMember[]; // Array of cast members (max 10)
  
  // Optional visual assets
  poster_url?: string;
  backdrop_url?: string;
  
  // Optional collection
  collection_name?: string;
}

/**
 * Input for updating a movie (all fields optional except what's being updated)
 */
export interface MovieUpdateInput {
  title?: string;
  original_title?: string;
  release_date?: string;
  runtime_minutes?: number;
  overview?: string;
  budget?: number;
  revenue?: number;
  mpa_rating?: string;
  poster_url?: string;
  backdrop_url?: string;
  
  // Related entities (if provided, will replace existing)
  genres?: string[];
  directors?: string[];
  producers?: string[];
  studios?: Studio[];
  cast?: CastMember[];
  collection_name?: string;
}

/**
 * Response after creating a movie
 */
export interface MovieCreateResponse {
  success: boolean;
  movie_id: number;
  message: string;
}

/**
 * Response for bulk import
 */
export interface BulkImportResponse {
  success: boolean;
  total_processed: number;
  successful: number;
  failed: number;
  results: Array<{
    title: string;
    success: boolean;
    movie_id?: number;
    error?: string;
  }>;
}