package service

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"

	"github.com/Killreal226/lexis/backend/internal/model"
	"github.com/Killreal226/lexis/backend/internal/repository"
)

type Rank string

const (
	RankBad     Rank = "bad"
	RankGood    Rank = "good"
	RankPerfect Rank = "perfect"
)

const (
	rankBadLevel     int16 = 10
	rankGoodLevel    int16 = 14
	rankPerfectLevel int16 = 18
)

const (
	learningGraduationLevel int16 = 10
	reviewMaxLevel          int16 = 20
	reviewLevelDownStep     int16 = 3

	maxBatchStartSize = 200
	maxExcludeIDs     = 1000
)

var reviewBuckets = [3][2]int16{
	{10, 13},
	{14, 17},
	{18, 20},
}

// reviewBucketWeights — соотношение 7:3:1 для выборки в режиме review.
// Сумма (11) используется как верхняя граница для rand.IntN.
var reviewBucketWeights = [3]int{7, 3, 1}

const reviewBucketWeightsTotal = 11

type Mode string

const (
	ModeLearning Mode = "learning"
	ModeReview   Mode = "review"
)

type ProgressWithWord struct {
	Progress model.Progress
	Word     model.Word
}

type LearningStats struct {
	EnRu  repository.ProgressStats
	RuEn  repository.ProgressStats
	Total repository.ProgressStats
}

type ProgressRepository interface {
	GetLearning(
		ctx context.Context,
		userID int64,
		direction model.Direction,
		excludeProgressIDs []int64,
	) (model.Progress, error)
	GetReview(
		ctx context.Context,
		userID int64,
		direction model.Direction,
		minLevel int16,
		maxLevel int16,
	) (model.Progress, error)
	UpdateLevel(
		ctx context.Context, id int64, userID int64, newLevel int16,
	) error
	CreateMany(
		ctx context.Context, items []model.Progress,
	) (int, error)
	GetByID(
		ctx context.Context, id int64, userID int64,
	) (model.Progress, error)
	GetStats(
		ctx context.Context, userID int64,
	) (repository.ProgressStatsByDirection, error)
}

type WordRepositoryReadOnly interface {
	ListNewForUser(
		ctx context.Context, userID int64, limit int, excludeIDs []int64,
	) ([]model.Word, error)
	GetByID(
		ctx context.Context, id int64, userID int64,
	) (model.Word, error)
}

type LearningService struct {
	progressRepo ProgressRepository
	wordRepo     WordRepositoryReadOnly
}

func NewLearningService(
	progressRepo ProgressRepository, wordRepo WordRepositoryReadOnly,
) *LearningService {
	return &LearningService{progressRepo: progressRepo, wordRepo: wordRepo}
}

var (
	ErrInvalidLearningInput = errors.New("invalid learning input")
	ErrUnknownRank          = errors.New("unknown rank")
	ErrUnknownMode          = errors.New("unknown mode")
	ErrUnknownDirection     = errors.New("unknown direction")
)

func (s *LearningService) NextCandidate(
	ctx context.Context, userID int64, excludeIDs []int64,
) (*model.Word, error) {
	if len(excludeIDs) > maxExcludeIDs {
		excludeIDs = excludeIDs[:maxExcludeIDs]
	}
	words, err := s.wordRepo.ListNewForUser(ctx, userID, 1, excludeIDs)
	if err != nil {
		return nil, fmt.Errorf("list new for user: %w", err)
	}
	if len(words) == 0 {
		return nil, nil
	}
	return &words[0], nil
}

func (s *LearningService) Rate(
	ctx context.Context, userID int64, wordID int64, rank string,
) (int16, error) {
	if wordID <= 0 {
		return 0, ErrInvalidLearningInput
	}
	level, err := rankToLevel(Rank(rank))
	if err != nil {
		return 0, err
	}

	if _, err := s.wordRepo.GetByID(ctx, wordID, userID); err != nil {
		return 0, fmt.Errorf("get word: %w", err)
	}

	items := []model.Progress{
		{
			UserID:    userID,
			WordID:    wordID,
			Direction: model.DirectionEnRu,
			Level:     level,
		},
		{
			UserID:    userID,
			WordID:    wordID,
			Direction: model.DirectionRuEn,
			Level:     level,
		},
	}
	if _, err := s.progressRepo.CreateMany(ctx, items); err != nil {
		return 0, fmt.Errorf("create progress: %w", err)
	}
	return level, nil
}

func (s *LearningService) BatchStart(
	ctx context.Context, userID int64, wordIDs []int64,
) (int, error) {
	if len(wordIDs) == 0 || len(wordIDs) > maxBatchStartSize {
		return 0, ErrInvalidLearningInput
	}

	seen := make(map[int64]struct{}, len(wordIDs))
	deduped := make([]int64, 0, len(wordIDs))
	for _, id := range wordIDs {
		if id <= 0 {
			return 0, ErrInvalidLearningInput
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		deduped = append(deduped, id)
	}

	items := make([]model.Progress, 0, len(deduped)*2)
	for _, wordID := range deduped {
		items = append(items,
			model.Progress{
				UserID:    userID,
				WordID:    wordID,
				Direction: model.DirectionEnRu,
				Level:     0,
			},
			model.Progress{
				UserID:    userID,
				WordID:    wordID,
				Direction: model.DirectionRuEn,
				Level:     0,
			},
		)
	}
	return s.progressRepo.CreateMany(ctx, items)
}

func (s *LearningService) NextProgressWithWord(
	ctx context.Context,
	userID int64,
	mode Mode,
	direction model.Direction,
	excludeProgressIDs []int64,
) (*ProgressWithWord, error) {
	if direction != model.DirectionEnRu && direction != model.DirectionRuEn {
		return nil, ErrUnknownDirection
	}

	if len(excludeProgressIDs) > maxExcludeIDs {
		excludeProgressIDs = excludeProgressIDs[:maxExcludeIDs]
	}

	var (
		progress model.Progress
		err      error
	)
	switch mode {
	case ModeLearning:
		progress, err = s.progressRepo.GetLearning(
			ctx, userID, direction, excludeProgressIDs,
		)
	case ModeReview:
		progress, err = s.pickReviewProgress(ctx, userID, direction)
	default:
		return nil, ErrUnknownMode
	}
	if errors.Is(err, repository.ErrProgressNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get progress: %w", err)
	}

	word, err := s.wordRepo.GetByID(ctx, progress.WordID, userID)
	if err != nil {
		return nil, fmt.Errorf("get word: %w", err)
	}
	return &ProgressWithWord{Progress: progress, Word: word}, nil
}

func (s *LearningService) SubmitAnswer(
	ctx context.Context, userID int64, progressID int64, known bool,
) (newLevel int16, graduated bool, err error) {
	if progressID <= 0 {
		return 0, false, ErrInvalidLearningInput
	}
	progress, err := s.progressRepo.GetByID(ctx, progressID, userID)
	if err != nil {
		return 0, false, fmt.Errorf("get progress by id: %w", err)
	}

	newLevel = nextLevel(progress.Level, known)

	if err := s.progressRepo.UpdateLevel(
		ctx, progress.ID, userID, newLevel,
	); err != nil {
		return 0, false, fmt.Errorf("update level: %w", err)
	}

	graduated = progress.Level < learningGraduationLevel &&
		newLevel >= learningGraduationLevel
	return newLevel, graduated, nil
}

func (s *LearningService) pickReviewProgress(
	ctx context.Context, userID int64, direction model.Direction,
) (model.Progress, error) {
	primary := bucketIndexForRoll(rand.IntN(reviewBucketWeightsTotal))
	order := [3]int{
		primary,
		(primary + 1) % len(reviewBuckets),
		(primary + 2) % len(reviewBuckets),
	}

	for _, idx := range order {
		bucket := reviewBuckets[idx]
		progress, err := s.progressRepo.GetReview(
			ctx, userID, direction, bucket[0], bucket[1],
		)
		if err == nil {
			return progress, nil
		}
		if !errors.Is(err, repository.ErrProgressNotFound) {
			return model.Progress{}, fmt.Errorf("get review: %w", err)
		}
	}
	return model.Progress{}, repository.ErrProgressNotFound
}

func bucketIndexForRoll(r int) int {
	cumulative := 0
	for i, w := range reviewBucketWeights {
		cumulative += w
		if r < cumulative {
			return i
		}
	}
	return len(reviewBucketWeights) - 1
}

func rankToLevel(r Rank) (int16, error) {
	switch r {
	case RankBad:
		return rankBadLevel, nil
	case RankGood:
		return rankGoodLevel, nil
	case RankPerfect:
		return rankPerfectLevel, nil
	default:
		return 0, ErrUnknownRank
	}
}

func nextLevel(current int16, known bool) int16 {
	if current < learningGraduationLevel {
		if known {
			return current + 1
		}
		return current
	}
	if known {
		next := current + 1
		if next > reviewMaxLevel {
			return reviewMaxLevel
		}
		return next
	}
	next := current - reviewLevelDownStep
	if next < learningGraduationLevel {
		return learningGraduationLevel
	}
	return next
}

func (s *LearningService) GetStats(
	ctx context.Context, userID int64,
) (LearningStats, error) {
	res, err := s.progressRepo.GetStats(ctx, userID)
	if err != nil {
		return LearningStats{}, fmt.Errorf("get stats: %w", err)
	}
	return LearningStats{
		EnRu: res.EnRu,
		RuEn: res.RuEn,
		Total: repository.ProgressStats{
			New:        res.EnRu.New + res.RuEn.New,
			InProgress: res.EnRu.InProgress + res.RuEn.InProgress,
			Bad:        res.EnRu.Bad + res.RuEn.Bad,
			Good:       res.EnRu.Good + res.RuEn.Good,
			Perfect:    res.EnRu.Perfect + res.RuEn.Perfect,
		},
	}, nil
}
