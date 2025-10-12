package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// Config holds database configuration
type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
}

// Movie represents a movie record
type Movie struct {
	Title           string
	OriginalTitle   string
	ReleaseDate     time.Time
	Runtime         int
	Genres          []string
	Overview        string
	Budget          int64
	Revenue         int64
	Studios         []string
	StudioLogos     []string
	StudioCountries []string
	Producers       []string
	Directors       []string
	MPARating       string
	Collection      string
	PosterURL       string
	BackdropURL     string
	Actors          []Actor
}

// Actor represents an actor in a movie
type Actor struct {
	Name       string
	Character  string
	ProfileURL string
	Order      int
}

func main() {

	// CSV file path
	csvPath := "movies_last30years.csv"
	if len(os.Args) > 1 {
		csvPath = os.Args[1]
	}

	// Connect to database
	ctx := context.Background()
	godotenv.Load()
	connString := os.Getenv("DATABASE_URL")

	pool, err := pgxpool.New(ctx, connString)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	log.Println("Connected to database successfully")

	// Read and import CSV
	if err := importCSV(ctx, pool, csvPath); err != nil {
		log.Fatalf("Failed to import CSV: %v\n", err)
	}

	log.Println("Import completed successfully!")
}

func importCSV(ctx context.Context, pool *pgxpool.Pool, csvPath string) error {
	// Open CSV file
	file, err := os.Open(csvPath)
	if err != nil {
		return fmt.Errorf("failed to open CSV file: %w", err)
	}
	defer file.Close()

	// Create CSV reader
	reader := csv.NewReader(file)
	reader.Comma = '\t' // Tab-separated
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	// Read header
	headers, err := reader.Read()
	if err != nil {
		return fmt.Errorf("failed to read CSV header: %w", err)
	}

	// Create header index map
	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[h] = i
	}

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Create lookup caches
	collectionCache := make(map[string]int)
	genreCache := make(map[string]int)
	studioCache := make(map[string]int)
	directorCache := make(map[string]int)
	producerCache := make(map[string]int)
	actorCache := make(map[string]int)

	rowCount := 0

	// Read and process each row
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Printf("Error reading row %d: %v\n", rowCount+1, err)
			continue
		}

		rowCount++
		log.Printf("Processing row %d: %s\n", rowCount, getValue(record, headerMap, "Title"))

		// Parse movie data
		movie, err := parseMovieFromRecord(record, headerMap)
		if err != nil {
			log.Printf("Error parsing movie at row %d: %v\n", rowCount, err)
			continue
		}

		// Insert movie and related data
		if err := insertMovie(ctx, tx, movie, collectionCache, genreCache, studioCache,
			directorCache, producerCache, actorCache); err != nil {
			log.Printf("Error inserting movie at row %d: %v\n", rowCount, err)
			continue
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Successfully imported %d movies\n", rowCount)
	return nil
}

func parseMovieFromRecord(record []string, headerMap map[string]int) (*Movie, error) {
	movie := &Movie{}

	// Basic fields
	movie.Title = getValue(record, headerMap, "Title")
	movie.OriginalTitle = getValue(record, headerMap, "Original Title")
	movie.Overview = getValue(record, headerMap, "Overview")
	movie.MPARating = getValue(record, headerMap, "MPA Rating")
	movie.Collection = getValue(record, headerMap, "Collection")
	movie.PosterURL = getValue(record, headerMap, "Poster URL")
	movie.BackdropURL = getValue(record, headerMap, "Backdrop URL")

	// Parse release date
	releaseDateStr := getValue(record, headerMap, "Release Date")
	if releaseDateStr != "" {
		releaseDate, err := time.Parse("1/2/06", releaseDateStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse release date: %w", err)
		}
		movie.ReleaseDate = releaseDate
	}

	// Parse runtime
	runtimeStr := getValue(record, headerMap, "Runtime (min)")
	if runtimeStr != "" {
		runtime, err := strconv.Atoi(runtimeStr)
		if err == nil {
			movie.Runtime = runtime
		}
	}

	// Parse budget
	budgetStr := getValue(record, headerMap, "Budget")
	if budgetStr != "" {
		budget, err := strconv.ParseInt(budgetStr, 10, 64)
		if err == nil {
			movie.Budget = budget
		}
	}

	// Parse revenue
	revenueStr := getValue(record, headerMap, "Revenue")
	if revenueStr != "" {
		revenue, err := strconv.ParseInt(revenueStr, 10, 64)
		if err == nil {
			movie.Revenue = revenue
		}
	}

	// Parse genres
	genresStr := getValue(record, headerMap, "Genres")
	if genresStr != "" {
		movie.Genres = splitAndTrim(genresStr, ";")
	}

	// Parse studios
	studiosStr := getValue(record, headerMap, "Studios")
	if studiosStr != "" {
		movie.Studios = splitAndTrim(studiosStr, ";")
	}

	// Parse studio logos
	logosStr := getValue(record, headerMap, "Studio Logos")
	if logosStr != "" {
		movie.StudioLogos = splitAndTrim(logosStr, ";")
	}

	// Parse studio countries
	countriesStr := getValue(record, headerMap, "Studio Countries")
	if countriesStr != "" {
		movie.StudioCountries = splitAndTrim(countriesStr, ";")
	}

	// Parse producers
	producersStr := getValue(record, headerMap, "Producers")
	if producersStr != "" {
		movie.Producers = splitAndTrim(producersStr, ";")
	}

	// Parse directors
	directorsStr := getValue(record, headerMap, "Directors")
	if directorsStr != "" {
		movie.Directors = splitAndTrim(directorsStr, ";")
	}

	// Parse actors (up to 10)
	for i := 1; i <= 10; i++ {
		actorName := getValue(record, headerMap, fmt.Sprintf("Actor %d Name", i))
		if actorName != "" {
			actor := Actor{
				Name:       actorName,
				Character:  getValue(record, headerMap, fmt.Sprintf("Actor %d Character", i)),
				ProfileURL: getValue(record, headerMap, fmt.Sprintf("Actor %d Profile", i)),
				Order:      i,
			}
			movie.Actors = append(movie.Actors, actor)
		}
	}

	return movie, nil
}

func insertMovie(ctx context.Context, tx pgx.Tx, movie *Movie,
	collectionCache, genreCache, studioCache, directorCache, producerCache, actorCache map[string]int,
) error {
	// Get or create collection ID
	var collectionID *int
	if movie.Collection != "" {
		id, err := getOrCreateCollection(ctx, tx, movie.Collection, collectionCache)
		if err != nil {
			return fmt.Errorf("failed to get/create collection: %w", err)
		}
		collectionID = &id
	}

	// Insert movie
	var movieID int
	err := tx.QueryRow(ctx, `
		INSERT INTO movies (title, original_title, release_date, runtime_minutes, overview, 
			budget, revenue, mpa_rating, collection_id, poster_url, backdrop_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING movie_id`,
		movie.Title, movie.OriginalTitle, movie.ReleaseDate, movie.Runtime, movie.Overview,
		movie.Budget, movie.Revenue, movie.MPARating, collectionID, movie.PosterURL, movie.BackdropURL,
	).Scan(&movieID)
	if err != nil {
		return fmt.Errorf("failed to insert movie: %w", err)
	}

	// Insert genres
	for _, genreName := range movie.Genres {
		genreID, err := getOrCreateGenre(ctx, tx, genreName, genreCache)
		if err != nil {
			return fmt.Errorf("failed to get/create genre: %w", err)
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, movieID, genreID)
		if err != nil {
			return fmt.Errorf("failed to insert movie_genre: %w", err)
		}
	}

	// Insert studios
	for i, studioName := range movie.Studios {
		logoURL := ""
		if i < len(movie.StudioLogos) {
			logoURL = movie.StudioLogos[i]
		}
		country := ""
		if i < len(movie.StudioCountries) {
			country = movie.StudioCountries[i]
		}

		studioID, err := getOrCreateStudio(ctx, tx, studioName, logoURL, country, studioCache)
		if err != nil {
			return fmt.Errorf("failed to get/create studio: %w", err)
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO movie_studios (movie_id, studio_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, movieID, studioID)
		if err != nil {
			return fmt.Errorf("failed to insert movie_studio: %w", err)
		}
	}

	// Insert directors
	for _, directorName := range movie.Directors {
		directorID, err := getOrCreateDirector(ctx, tx, directorName, directorCache)
		if err != nil {
			return fmt.Errorf("failed to get/create director: %w", err)
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO movie_directors (movie_id, director_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, movieID, directorID)
		if err != nil {
			return fmt.Errorf("failed to insert movie_director: %w", err)
		}
	}

	// Insert producers
	for _, producerName := range movie.Producers {
		producerID, err := getOrCreateProducer(ctx, tx, producerName, producerCache)
		if err != nil {
			return fmt.Errorf("failed to get/create producer: %w", err)
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO movie_producers (movie_id, producer_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, movieID, producerID)
		if err != nil {
			return fmt.Errorf("failed to insert movie_producer: %w", err)
		}
	}

	// Insert actors
	for _, actor := range movie.Actors {
		actorID, err := getOrCreateActor(ctx, tx, actor.Name, actor.ProfileURL, actorCache)
		if err != nil {
			return fmt.Errorf("failed to get/create actor: %w", err)
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO movie_actors (movie_id, actor_id, character_name, actor_order) 
			VALUES ($1, $2, $3, $4)
			ON CONFLICT DO NOTHING`, movieID, actorID, actor.Character, actor.Order)
		if err != nil {
			return fmt.Errorf("failed to insert movie_actor: %w", err)
		}
	}

	return nil
}

// Helper functions to get or create entities
func getOrCreateCollection(ctx context.Context, tx pgx.Tx, name string, cache map[string]int) (int, error) {
	if id, ok := cache[name]; ok {
		return id, nil
	}

	var id int
	err := tx.QueryRow(ctx, `
		INSERT INTO collections (collection_name) VALUES ($1)
		ON CONFLICT (collection_name) DO UPDATE SET collection_name = EXCLUDED.collection_name
		RETURNING collection_id`, name).Scan(&id)
	if err != nil {
		return 0, err
	}

	cache[name] = id
	return id, nil
}

func getOrCreateGenre(ctx context.Context, tx pgx.Tx, name string, cache map[string]int) (int, error) {
	if id, ok := cache[name]; ok {
		return id, nil
	}

	var id int
	err := tx.QueryRow(ctx, `
		INSERT INTO genres (genre_name) VALUES ($1)
		ON CONFLICT (genre_name) DO UPDATE SET genre_name = EXCLUDED.genre_name
		RETURNING genre_id`, name).Scan(&id)
	if err != nil {
		return 0, err
	}

	cache[name] = id
	return id, nil
}

func getOrCreateStudio(ctx context.Context, tx pgx.Tx, name, logoURL, country string, cache map[string]int) (int, error) {
	if id, ok := cache[name]; ok {
		return id, nil
	}

	var id int
	err := tx.QueryRow(ctx, `
		INSERT INTO studios (studio_name, logo_url, country) VALUES ($1, $2, $3)
		ON CONFLICT (studio_name) DO UPDATE SET logo_url = EXCLUDED.logo_url, country = EXCLUDED.country
		RETURNING studio_id`, name, nullString(logoURL), nullString(country)).Scan(&id)
	if err != nil {
		return 0, err
	}

	cache[name] = id
	return id, nil
}

func getOrCreateDirector(ctx context.Context, tx pgx.Tx, name string, cache map[string]int) (int, error) {
	if id, ok := cache[name]; ok {
		return id, nil
	}

	var id int
	err := tx.QueryRow(ctx, `
		INSERT INTO directors (director_name) VALUES ($1)
		ON CONFLICT (director_name) DO UPDATE SET director_name = EXCLUDED.director_name
		RETURNING director_id`, name).Scan(&id)
	if err != nil {
		return 0, err
	}

	cache[name] = id
	return id, nil
}

func getOrCreateProducer(ctx context.Context, tx pgx.Tx, name string, cache map[string]int) (int, error) {
	if id, ok := cache[name]; ok {
		return id, nil
	}

	var id int
	err := tx.QueryRow(ctx, `
		INSERT INTO producers (producer_name) VALUES ($1)
		ON CONFLICT (producer_name) DO UPDATE SET producer_name = EXCLUDED.producer_name
		RETURNING producer_id`, name).Scan(&id)
	if err != nil {
		return 0, err
	}

	cache[name] = id
	return id, nil
}

func getOrCreateActor(ctx context.Context, tx pgx.Tx, name, profileURL string, cache map[string]int) (int, error) {
	if id, ok := cache[name]; ok {
		return id, nil
	}

	var id int
	err := tx.QueryRow(ctx, `
		INSERT INTO actors (actor_name, profile_url) VALUES ($1, $2)
		ON CONFLICT (actor_name) DO UPDATE SET profile_url = EXCLUDED.profile_url
		RETURNING actor_id`, name, nullString(profileURL)).Scan(&id)
	if err != nil {
		return 0, err
	}

	cache[name] = id
	return id, nil
}

// Utility functions
func getValue(record []string, headerMap map[string]int, key string) string {
	if idx, ok := headerMap[key]; ok && idx < len(record) {
		return strings.TrimSpace(record[idx])
	}
	return ""
}

func splitAndTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
