package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"github.com/Killreal226/lexis/backend/internal/model"
)

var ErrProgressNotFound = errors.New("progress not found")

type ProgressRepository struct {
	db *sql.DB
}

type ProgressStats struct {
	New        int
	InProgress int
	Bad        int
	Good       int
	Perfect    int
}

type ProgressStatsByDirection struct {
	EnRu ProgressStats
	RuEn ProgressStats
}

func NewProgressRepository(db *sql.DB) *ProgressRepository {
	return &ProgressRepository{db: db}
}

func (r *ProgressRepository) CreateMany(
	ctx context.Context, items []model.Progress,
) (int, error) {
	if len(items) == 0 {
		return 0, nil
	}
	userIDs := make([]int64, len(items))
	wordIDs := make([]int64, len(items))
	directions := make([]string, len(items))
	levels := make([]int64, len(items))
	for i, p := range items {
		userIDs[i] = p.UserID
		wordIDs[i] = p.WordID
		directions[i] = string(p.Direction)
		levels[i] = int64(p.Level)
	}
	query := `
	INSERT INTO progress (user_id, word_id, direction, level)
	SELECT * FROM unnest(
		$1::bigint[],
		$2::bigint[],
		$3::text[],
		$4::int[]
	)
	ON CONFLICT (user_id, word_id, direction) DO NOTHING
	`
	result, err := r.db.ExecContext(ctx, query,
		pq.Array(userIDs),
		pq.Array(wordIDs),
		pq.Array(directions),
		pq.Array(levels),
	)
	if err != nil {
		return 0, fmt.Errorf("create many progress: %w", err)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("create many progress: %w", err)
	}
	return int(n), nil
}

func (r *ProgressRepository) GetByID(
	ctx context.Context, id int64, userID int64,
) (model.Progress, error) {
	query := `
	SELECT id, user_id, word_id, direction, level, last_reviewed_at, created_at
	FROM progress
	WHERE id = $1 AND user_id = $2
	`
	var progress model.Progress
	if err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&progress.ID,
		&progress.UserID,
		&progress.WordID,
		&progress.Direction,
		&progress.Level,
		&progress.LastReviewedAt,
		&progress.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.Progress{}, ErrProgressNotFound
		}
		return model.Progress{}, fmt.Errorf("get progress by id: %w", err)
	}
	return progress, nil
}

func (r *ProgressRepository) UpdateLevel(
	ctx context.Context, id int64, userID int64, newLevel int16,
) error {
	query := `
	UPDATE progress
	SET level = $1, last_reviewed_at = NOW()
	WHERE id = $2 AND user_id = $3
	`
	result, err := r.db.ExecContext(ctx, query, newLevel, id, userID)
	if err != nil {
		return fmt.Errorf("update progress level: %w", err)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("update progress level: %w", err)
	}
	if n == 0 {
		return ErrProgressNotFound
	}
	return nil
}

func (r *ProgressRepository) GetLearning(
	ctx context.Context, userID int64, direction model.Direction,
	excludeProgressIDs []int64,
) (model.Progress, error) {
	if excludeProgressIDs == nil {
		excludeProgressIDs = []int64{}
	}
	query := `
	SELECT id, user_id, word_id, direction, level, last_reviewed_at, created_at
	FROM progress
	WHERE user_id = $1 AND direction = $2 AND level < 10
	  AND NOT (id = ANY($3::bigint[]))
	ORDER BY last_reviewed_at NULLS FIRST
	LIMIT 1
	`
	var progress model.Progress
	if err := r.db.QueryRowContext(
		ctx, query, userID, direction, pq.Array(excludeProgressIDs),
	).Scan(
		&progress.ID,
		&progress.UserID,
		&progress.WordID,
		&progress.Direction,
		&progress.Level,
		&progress.LastReviewedAt,
		&progress.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.Progress{}, ErrProgressNotFound
		}
		return model.Progress{}, fmt.Errorf("get learning progress: %w", err)
	}
	return progress, nil
}

func (r *ProgressRepository) GetReview(
	ctx context.Context,
	userID int64,
	direction model.Direction,
	minLevel int16,
	maxLevel int16,
) (model.Progress, error) {
	query := `
	SELECT id, user_id, word_id, direction, level, last_reviewed_at, created_at
	FROM progress
	WHERE user_id = $1 AND direction = $2 AND level >= $3 AND level <= $4
	ORDER BY last_reviewed_at NULLS FIRST
	LIMIT 1
	`
	var progress model.Progress
	if err := r.db.QueryRowContext(
		ctx, query, userID, direction, minLevel, maxLevel,
	).Scan(
		&progress.ID,
		&progress.UserID,
		&progress.WordID,
		&progress.Direction,
		&progress.Level,
		&progress.LastReviewedAt,
		&progress.CreatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.Progress{}, ErrProgressNotFound
		}
		return model.Progress{}, fmt.Errorf("get review progress: %w", err)
	}
	return progress, nil
}

func (r *ProgressRepository) GetStats(
	ctx context.Context, userID int64,
) (ProgressStatsByDirection, error) {
	query := `
	SELECT 
		direction,
		COUNT(*) FILTER (WHERE level = 0) AS new,
		COUNT(*) FILTER (WHERE level BETWEEN 1 AND 9) AS in_progress,
		COUNT(*) FILTER (WHERE level BETWEEN 10 AND 13) AS bad,
		COUNT(*) FILTER (WHERE level BETWEEN 14 AND 17) AS good,
		COUNT(*) FILTER (WHERE level BETWEEN 18 AND 20) AS perfect
	FROM progress
	WHERE user_id = $1
	GROUP BY direction
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return ProgressStatsByDirection{}, fmt.Errorf("get stats: %w", err)
	}
	defer rows.Close()

	var statsByDirection ProgressStatsByDirection
	for rows.Next() {
		var direction model.Direction
		var stats ProgressStats
		if err := rows.Scan(
			&direction,
			&stats.New,
			&stats.InProgress,
			&stats.Bad,
			&stats.Good,
			&stats.Perfect,
		); err != nil {
			return ProgressStatsByDirection{}, fmt.Errorf("get stats: %w", err)
		}
		switch direction {
		case model.DirectionEnRu:
			statsByDirection.EnRu = stats
		case model.DirectionRuEn:
			statsByDirection.RuEn = stats
		}
	}
	if err := rows.Err(); err != nil {
		return ProgressStatsByDirection{}, fmt.Errorf("get stats: %w", err)
	}
	return statsByDirection, nil
}
