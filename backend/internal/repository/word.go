package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"github.com/Killreal226/lexis/backend/internal/model"
)

var ErrWordNotFound = errors.New("word not found")

type WordRepository struct {
	db *sql.DB
}

type wordRow = model.Word

type WordWithSimilarity struct {
	wordRow
	Similarity float64
}

func NewWordRepository(db *sql.DB) *WordRepository {
	return &WordRepository{db: db}
}

func (r *WordRepository) Create(
	ctx context.Context, word *model.Word,
) (model.Word, error) {
	query := `
	INSERT INTO words (
		word, translation, example_en, example_ru, image_path, created_by
	)
	VALUES ($1, $2, $3, $4, $5, $6)
	RETURNING 
		id, 
		word, 
		translation, 
		example_en, 
		example_ru, 
		image_path, 
		created_by, 
		created_at
	`
	var created model.Word
	if err := r.db.QueryRowContext(
		ctx,
		query,
		word.Word,
		word.Translation,
		word.ExampleEn,
		word.ExampleRu,
		word.ImagePath,
		word.CreatedBy,
	).Scan(
		&created.ID,
		&created.Word,
		&created.Translation,
		&created.ExampleEn,
		&created.ExampleRu,
		&created.ImagePath,
		&created.CreatedBy,
		&created.CreatedAt,
	); err != nil {
		return model.Word{}, err
	}
	return created, nil
}

func (r *WordRepository) GetByID(
	ctx context.Context, id int64, userID int64,
) (model.Word, error) {
	query := `
	SELECT 
		id, 
		word, 
		translation, 
		example_en, 
		example_ru, 
		image_path, 
		created_by, 
		created_at
	FROM words
	WHERE id = $1
	  AND (created_by IS NULL OR created_by = $2)
	`
	var word model.Word
	if err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&word.ID,
		&word.Word,
		&word.Translation,
		&word.ExampleEn,
		&word.ExampleRu,
		&word.ImagePath,
		&word.CreatedBy,
		&word.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.Word{}, ErrWordNotFound
		}
		return model.Word{}, err
	}
	return word, nil
}

func (r *WordRepository) ListNewForUser(
	ctx context.Context, userID int64, limit int, excludeIDs []int64,
) ([]model.Word, error) {
	if excludeIDs == nil {
		excludeIDs = []int64{}
	}
	query := `
	SELECT 
		w.id, 
		w.word, 
		w.translation, 
		w.example_en, 
		w.example_ru, 
		w.image_path, 
		w.created_by, 
		w.created_at
	FROM words w
	WHERE (w.created_by IS NULL OR w.created_by = $1)
	  AND NOT EXISTS (
	      SELECT 1 FROM progress p
	      WHERE p.user_id = $1 AND p.word_id = w.id
	  )
	  AND NOT (w.id = ANY($3::bigint[]))
	ORDER BY w.created_at DESC
	LIMIT $2
	`
	rows, err := r.db.QueryContext(
		ctx, query, userID, limit, pq.Array(excludeIDs),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	words := make([]model.Word, 0, limit)
	for rows.Next() {
		var w model.Word
		if err := rows.Scan(
			&w.ID,
			&w.Word,
			&w.Translation,
			&w.ExampleEn,
			&w.ExampleRu,
			&w.ImagePath,
			&w.CreatedBy,
			&w.CreatedAt,
		); err != nil {
			return nil, err
		}
		words = append(words, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return words, nil
}

func (r *WordRepository) ExactMatch(
	ctx context.Context, word string, userID int64, limit int,
) ([]model.Word, error) {
	query := `
	SELECT
		id, 
		word, 
		translation, 
		example_en, 
		example_ru, 
		image_path, 
		created_by, 
		created_at
	FROM words
	WHERE LOWER(TRIM(word)) = LOWER(TRIM($1))
	  AND (created_by IS NULL OR created_by = $2)
	ORDER BY created_by NULLS LAST
	LIMIT $3
	`
	rows, err := r.db.QueryContext(ctx, query, word, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	words := make([]model.Word, 0, limit)
	for rows.Next() {
		var w model.Word
		if err := rows.Scan(
			&w.ID,
			&w.Word,
			&w.Translation,
			&w.ExampleEn,
			&w.ExampleRu,
			&w.ImagePath,
			&w.CreatedBy,
			&w.CreatedAt,
		); err != nil {
			return nil, err
		}
		words = append(words, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return words, nil
}

func (r *WordRepository) FindSimilar(
	ctx context.Context, word string, userID int64, limit int,
) ([]WordWithSimilarity, error) {
	query := `
	SELECT 
		id, 
		word, 
		translation, 
		example_en, 
		example_ru, 
		image_path, 
		created_by, 
		created_at, 
		similarity(word, $1) AS sim
	FROM words
	WHERE (created_by IS NULL OR created_by = $2)
	  AND similarity(word, $1) > 0.4
	  AND LOWER(TRIM(word)) <> LOWER(TRIM($1))
	ORDER BY sim DESC
	LIMIT $3
	`
	rows, err := r.db.QueryContext(ctx, query, word, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	words := make([]WordWithSimilarity, 0, limit)
	for rows.Next() {
		var w WordWithSimilarity
		if err := rows.Scan(
			&w.ID,
			&w.Word,
			&w.Translation,
			&w.ExampleEn,
			&w.ExampleRu,
			&w.ImagePath,
			&w.CreatedBy,
			&w.CreatedAt,
			&w.Similarity,
		); err != nil {
			return nil, err
		}
		words = append(words, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return words, nil
}

func (r *WordRepository) FindContaining(
	ctx context.Context, word string, userID int64, limit int,
) ([]model.Word, error) {
	query := `
	SELECT 
		id, 
		word, 
		translation, 
		example_en, 
		example_ru, 
		image_path, 
		created_by, 
		created_at
	FROM words
	WHERE (created_by IS NULL OR created_by = $2)
	  AND word ILIKE '%' || $1 || '%'
	  AND LOWER(TRIM(word)) <> LOWER(TRIM($1))
	  AND similarity(word, $1) <= 0.4
	ORDER BY length(word) ASC, word ASC
	LIMIT $3
	`
	rows, err := r.db.QueryContext(ctx, query, word, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	words := make([]model.Word, 0, limit)
	for rows.Next() {
		var w model.Word
		if err := rows.Scan(
			&w.ID,
			&w.Word,
			&w.Translation,
			&w.ExampleEn,
			&w.ExampleRu,
			&w.ImagePath,
			&w.CreatedBy,
			&w.CreatedAt,
		); err != nil {
			return nil, err
		}
		words = append(words, w)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return words, nil
}
