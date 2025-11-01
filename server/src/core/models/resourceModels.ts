// server/src/models/resourceModels.ts

/**
 * Studio Model
 * Represents a movie production studio/company
 */
export interface Studio {
  studio_id: number;
  studio_name: string;
  logo_url: string | null;
  country: string | null;
  founded_year: number | null;
  headquarters: string | null;
  website: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Studio with movie count
 * Extended studio model that includes the count of movies
 */
export interface StudioWithCount extends Studio {
  movie_count: number;
}

/**
 * Studio List Response
 * Paginated response for studio list
 */
export interface StudioListResponse {
  data: Studio[] | StudioWithCount[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Director Model
 * Represents a movie director
 */
export interface Director {
  director_id: number;
  director_name: string;
  birth_date: Date | null;
  biography: string | null;
  profile_url: string | null;
  nationality: string | null;
  awards: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Director with movie count
 * Extended director model that includes the count of movies
 */
export interface DirectorWithCount extends Director {
  movie_count: number;
}

/**
 * Director List Response
 * Paginated response for director list
 */
export interface DirectorListResponse {
  data: Director[] | DirectorWithCount[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Actor Model
 * Represents a movie actor/actress
 */
export interface Actor {
  actor_id: number;
  actor_name: string;
  birth_date: Date | null;
  biography: string | null;
  profile_url: string | null;
  nationality: string | null;
  awards: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Actor with movie count
 * Extended actor model that includes the count of movies
 */
export interface ActorWithCount extends Actor {
  movie_count: number;
}

/**
 * Actor List Response
 * Paginated response for actor list
 */
export interface ActorListResponse {
  data: Actor[] | ActorWithCount[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Collection Model
 * Represents a movie collection/franchise
 */
export interface Collection {
  collection_id: number;
  collection_name: string;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Collection with movie count and financial data
 * Extended collection model with aggregated statistics
 */
export interface CollectionWithStats extends Collection {
  movie_count: number;
  total_revenue: string | null;
  total_budget: string | null;
  avg_rating: string | null;
}

/**
 * Collection List Response
 * Paginated response for collection list
 */
export interface CollectionListResponse {
  data: Collection[] | CollectionWithStats[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Search Query Parameters
 * Common query parameters for searching resources
 */
export interface ResourceSearchParams {
  name?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'movie_count' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Statistics Model
 * Aggregated statistics for a resource
 */
export interface ResourceStats {
  total_count: number;
  total_movies: number;
  avg_movies_per_resource: number;
  top_resource: {
    name: string;
    movie_count: number;
  } | null;
}