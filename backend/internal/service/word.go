package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/Killreal226/lexis/backend/internal/model"
	"github.com/Killreal226/lexis/backend/internal/repository"
	"github.com/Killreal226/lexis/backend/internal/storage"
)

const (
	maxWordLength        = 100
	maxTranslationLength = 255
	limitExactMatch      = 5
	limitSimilarWords    = 10
	limitContainingWords = 15
	maxListNewWordsLimit = 100
	minContainsQueryLen  = 3
)

type WordCheckResult struct {
	ExactMatch      []model.Word
	SimilarWords    []repository.WordWithSimilarity
	ContainingWords []model.Word
}

var (
	ErrInvalidWordInput     = errors.New("invalid word input")
	ErrUnsupportedImageType = errors.New("unsupported image type")
	ErrWordNotFound         = errors.New("word not found")
)

type WordRepository interface {
	Create(
		ctx context.Context, word *model.Word,
	) (model.Word, error)
	GetByID(
		ctx context.Context, id int64, userID int64,
	) (model.Word, error)
	ListNewForUser(
		ctx context.Context, userID int64, limit int, excludeIDs []int64,
	) ([]model.Word, error)
	ExactMatch(
		ctx context.Context, word string, userID int64, limit int,
	) ([]model.Word, error)
	FindSimilar(
		ctx context.Context, word string, userID int64, limit int,
	) ([]repository.WordWithSimilarity, error)
	FindContaining(
		ctx context.Context, word string, userID int64, limit int,
	) ([]model.Word, error)
}

type WordService struct {
	repo       WordRepository
	imageStore *storage.ImageStore
}

func NewWordService(
	repo WordRepository, imageStore *storage.ImageStore,
) *WordService {
	return &WordService{
		repo:       repo,
		imageStore: imageStore,
	}
}

func (s *WordService) CreateWord(
	ctx context.Context,
	word *model.Word,
	imageFile io.Reader,
	userID int64,
) (model.Word, error) {
	word.Word = normalizeWord(word.Word)
	word.Translation = strings.TrimSpace(word.Translation)
	word.ExampleEn = strings.TrimSpace(word.ExampleEn)
	if word.ExampleRu != nil {
		trimmed := strings.TrimSpace(*word.ExampleRu)
		if trimmed == "" {
			word.ExampleRu = nil
		} else {
			word.ExampleRu = &trimmed
		}
	}

	if word.Word == "" || len(word.Word) > maxWordLength {
		return model.Word{}, ErrInvalidWordInput
	}
	if word.Translation == "" || len(word.Translation) > maxTranslationLength {
		return model.Word{}, ErrInvalidWordInput
	}
	if word.ExampleEn == "" {
		return model.Word{}, ErrInvalidWordInput
	}

	var imagePath *string
	if imageFile != nil {
		path, err := s.imageStore.Save(imageFile)
		if err != nil {
			if errors.Is(err, storage.ErrUnsupportedImageType) {
				return model.Word{}, ErrUnsupportedImageType
			}
			return model.Word{}, fmt.Errorf("save image: %w", err)
		}
		imagePath = &path
	}
	word.ImagePath = imagePath
	word.CreatedBy = &userID

	created, err := s.repo.Create(ctx, word)
	if err != nil {
		if imagePath != nil {
			_ = s.imageStore.Delete(*imagePath)
		}
		return model.Word{}, fmt.Errorf("create word: %w", err)
	}

	return created, nil
}

func (s *WordService) GetWordByID(
	ctx context.Context, id int64, userID int64,
) (model.Word, error) {
	if id <= 0 {
		return model.Word{}, ErrInvalidWordInput
	}
	word, err := s.repo.GetByID(ctx, id, userID)
	if err != nil {
		return model.Word{}, fmt.Errorf("get word by id: %w", err)
	}
	return word, nil
}

func (s *WordService) CheckWord(
	ctx context.Context, word string, userID int64,
) (WordCheckResult, error) {
	w := normalizeWord(word)
	if w == "" || len(w) > maxWordLength {
		return WordCheckResult{}, ErrInvalidWordInput
	}

	var (
		exact    []model.Word
		similar  []repository.WordWithSimilarity
		contains []model.Word
	)

	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		var err error
		exact, err = s.repo.ExactMatch(gctx, w, userID, limitExactMatch)
		return err
	})

	g.Go(func() error {
		var err error
		similar, err = s.repo.FindSimilar(gctx, w, userID, limitSimilarWords)
		return err
	})

	if len(w) >= minContainsQueryLen {
		g.Go(func() error {
			var err error
			contains, err = s.repo.FindContaining(
				gctx, w, userID, limitContainingWords,
			)
			return err
		})
	}

	if err := g.Wait(); err != nil {
		return WordCheckResult{}, fmt.Errorf("check word: %w", err)
	}

	return dedupeWordCheck(exact, similar, contains), nil
}

func (s *WordService) ListNewWordsForUser(
	ctx context.Context, userID int64, limit int, excludeIDs []int64,
) ([]model.Word, error) {
	if userID <= 0 {
		return nil, ErrInvalidWordInput
	}
	if limit <= 0 {
		return nil, ErrInvalidWordInput
	}
	if limit > maxListNewWordsLimit {
		limit = maxListNewWordsLimit
	}
	words, err := s.repo.ListNewForUser(ctx, userID, limit, excludeIDs)
	if err != nil {
		return nil, fmt.Errorf("list new words: %w", err)
	}
	return words, nil
}

func dedupeWordCheck(
	exact []model.Word,
	similar []repository.WordWithSimilarity,
	contains []model.Word,
) WordCheckResult {
	exactIDs := make(map[int64]struct{}, len(exact))
	for _, e := range exact {
		exactIDs[e.ID] = struct{}{}
	}

	similarFiltered := make([]repository.WordWithSimilarity, 0, len(similar))
	similarIDs := make(map[int64]struct{})
	for _, sw := range similar {
		if _, inExact := exactIDs[sw.ID]; inExact {
			continue
		}
		similarFiltered = append(similarFiltered, sw)
		similarIDs[sw.ID] = struct{}{}
	}

	containsFiltered := make([]model.Word, 0, len(contains))
	for _, c := range contains {
		if _, inExact := exactIDs[c.ID]; inExact {
			continue
		}
		if _, inSimilar := similarIDs[c.ID]; inSimilar {
			continue
		}
		containsFiltered = append(containsFiltered, c)
	}

	return WordCheckResult{
		ExactMatch:      exact,
		SimilarWords:    similarFiltered,
		ContainingWords: containsFiltered,
	}
}

func normalizeWord(w string) string {
	return strings.ToLower(strings.TrimSpace(w))
}
