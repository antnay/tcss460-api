-- PostgreSQL Initialization Script - Complete Movie Database
-- Normalized to 3rd Normal Form (3NF)
-- Generated from movie dataset


BEGIN;


-- Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS movie_actors CASCADE;
DROP TABLE IF EXISTS movie_studios CASCADE;
DROP TABLE IF EXISTS movie_genres CASCADE;
DROP TABLE IF EXISTS movie_producers CASCADE;
DROP TABLE IF EXISTS movie_directors CASCADE;
DROP TABLE IF EXISTS actors CASCADE;
DROP TABLE IF EXISTS studios CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP TABLE IF EXISTS producers CASCADE;
DROP TABLE IF EXISTS directors CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS movies CASCADE;


-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================


-- Create Collections table
CREATE TABLE collections (
   collection_id SERIAL PRIMARY KEY,
   collection_name VARCHAR(255) UNIQUE NOT NULL
);


-- Create Movies table
CREATE TABLE movies (
   movie_id SERIAL PRIMARY KEY,
   title VARCHAR(500) NOT NULL,
   original_title VARCHAR(500),
   release_date DATE,
   runtime_minutes INTEGER,
   overview TEXT,
   budget BIGINT,
   revenue BIGINT,
   mpa_rating VARCHAR(10),
   collection_id INTEGER REFERENCES collections(collection_id),
   poster_url VARCHAR(500),
   backdrop_url VARCHAR(500),
   CONSTRAINT check_runtime CHECK (runtime_minutes > 0),
   CONSTRAINT check_budget CHECK (budget >= 0),
   CONSTRAINT check_revenue CHECK (revenue >= 0)
);


-- Create Genres table
CREATE TABLE genres (
   genre_id SERIAL PRIMARY KEY,
   genre_name VARCHAR(100) UNIQUE NOT NULL
);


-- Create Studios table
CREATE TABLE studios (
   studio_id SERIAL PRIMARY KEY,
   studio_name VARCHAR(255) UNIQUE NOT NULL,
   logo_url VARCHAR(500),
   country VARCHAR(5)
);


-- Create Directors table
CREATE TABLE directors (
   director_id SERIAL PRIMARY KEY,
   director_name VARCHAR(255) UNIQUE NOT NULL
);


-- Create Producers table
CREATE TABLE producers (
   producer_id SERIAL PRIMARY KEY,
   producer_name VARCHAR(255) UNIQUE NOT NULL
);


-- Create Actors table
CREATE TABLE actors (
   actor_id SERIAL PRIMARY KEY,
   actor_name VARCHAR(255) UNIQUE NOT NULL,
   profile_url VARCHAR(500)
);


-- Create junction table for Movies and Genres (many-to-many)
CREATE TABLE movie_genres (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   genre_id INTEGER REFERENCES genres(genre_id) ON DELETE CASCADE,
   PRIMARY KEY (movie_id, genre_id)
);


-- Create junction table for Movies and Studios (many-to-many)
CREATE TABLE movie_studios (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   studio_id INTEGER REFERENCES studios(studio_id) ON DELETE CASCADE,
   PRIMARY KEY (movie_id, studio_id)
);


-- Create junction table for Movies and Directors (many-to-many)
CREATE TABLE movie_directors (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   director_id INTEGER REFERENCES directors(director_id) ON DELETE CASCADE,
   PRIMARY KEY (movie_id, director_id)
);


-- Create junction table for Movies and Producers (many-to-many)
CREATE TABLE movie_producers (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   producer_id INTEGER REFERENCES producers(producer_id) ON DELETE CASCADE,
   PRIMARY KEY (movie_id, producer_id)
);


-- Create junction table for Movies and Actors (many-to-many with additional attributes)
CREATE TABLE movie_actors (
   movie_id INTEGER REFERENCES movies(movie_id) ON DELETE CASCADE,
   actor_id INTEGER REFERENCES actors(actor_id) ON DELETE CASCADE,
   character_name VARCHAR(500),
   actor_order INTEGER NOT NULL,
   PRIMARY KEY (movie_id, actor_id, actor_order),
   CONSTRAINT check_actor_order CHECK (actor_order >= 1 AND actor_order <= 10)
);


-- ============================================================================
-- INDEXES
-- ============================================================================


CREATE INDEX idx_movies_release_date ON movies(release_date);
CREATE INDEX idx_movies_collection ON movies(collection_id);
CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_movie_genres_movie ON movie_genres(movie_id);
CREATE INDEX idx_movie_genres_genre ON movie_genres(genre_id);
CREATE INDEX idx_movie_studios_movie ON movie_studios(movie_id);
CREATE INDEX idx_movie_studios_studio ON movie_studios(studio_id);
CREATE INDEX idx_movie_actors_movie ON movie_actors(movie_id);
CREATE INDEX idx_movie_actors_actor ON movie_actors(actor_id);
CREATE INDEX idx_actors_name ON actors(actor_name);
CREATE INDEX idx_studios_name ON studios(studio_name);


-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================


-- Get all movies with their genres
-- SELECT m.title, STRING_AGG(g.genre_name, ', ') as genres
-- FROM movies m
-- JOIN movie_genres mg ON m.movie_id = mg.movie_id
-- JOIN genres g ON mg.genre_id = g.genre_id
-- GROUP BY m.movie_id, m.title
-- ORDER BY m.release_date DESC;


-- Get movies with budget over $100M
-- SELECT title, budget, revenue, (revenue - budget) as profit
-- FROM movies
-- WHERE budget > 100000000
-- ORDER BY profit DESC;


-- Get all actors in a specific movie
-- SELECT a.actor_name, ma.character_name, ma.actor_order
-- FROM movie_actors ma
-- JOIN actors a ON ma.actor_id = a.actor_id
-- WHERE ma.movie_id = 1
-- ORDER BY ma.actor_order;
