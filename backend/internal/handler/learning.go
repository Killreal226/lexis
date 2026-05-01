package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/Killreal226/lexis/backend/internal/middleware"
	"github.com/Killreal226/lexis/backend/internal/model"
	"github.com/Killreal226/lexis/backend/internal/repository"
	"github.com/Killreal226/lexis/backend/internal/service"
)

type LearningHandler struct {
	svc *service.LearningService
}

func NewLearningHandler(svc *service.LearningService) *LearningHandler {
	return &LearningHandler{svc: svc}
}

func parseLearningExcludeQuery(r *http.Request) ([]int64, error) {
	raw := r.URL.Query().Get("exclude")
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	ids := make([]int64, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		id, err := strconv.ParseInt(p, 10, 64)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

type nextCandidateResponse struct {
	Word *model.Word `json:"word"`
}

type rateRequest struct {
	WordID int64  `json:"word_id" example:"42"`
	Rank   string `json:"rank" enums:"bad,good,perfect" example:"bad"`
}

type bucketStatsResponse struct {
	New        int `json:"new"`
	InProgress int `json:"in_progress"`
	Bad        int `json:"bad"`
	Good       int `json:"good"`
	Perfect    int `json:"perfect"`
	Total      int `json:"total"`
}

type statsResponse struct {
	EnRu  bucketStatsResponse `json:"en_ru"`
	RuEn  bucketStatsResponse `json:"ru_en"`
	Total bucketStatsResponse `json:"total"`
}

type rateResponse struct {
	Level int16 `json:"level"`
}

type batchStartRequest struct {
	WordIDs []int64 `json:"word_ids"`
}

type batchStartResponse struct {
	CreatedCount int `json:"created_count"`
}

// nextResponse — все поля кроме progress_id под omitempty: при «нет карточек»
// сериализуется в {"progress_id": null}, без direction/level/word.
type nextResponse struct {
	ProgressID *int64           `json:"progress_id"`
	Word       *model.Word      `json:"word,omitempty"`
	Direction  *model.Direction `json:"direction,omitempty"`
	Level      *int16           `json:"level,omitempty"`
}

type answerRequest struct {
	ProgressID int64 `json:"progress_id" example:"321"`
	Known      bool  `json:"known" example:"true"`
}

type answerResponse struct {
	NewLevel  int16 `json:"new_level" example:"4"`
	Graduated bool  `json:"graduated" example:"false"`
}

// NextCandidate godoc
// @Summary      Следующее новое слово (онбординг)
// @Description  Слово из словаря, у которого у пользователя ещё нет записей в progress. Query exclude — id через запятую (корзина и скипы текущей сессии на фронте). Если кандидатов нет — в теле word: null.
// @Tags         learning
// @Produce      json
// @Security     BearerAuth
// @Param        exclude  query  string  false  "ID слов через запятую, исключить из выборки, например: 12,45,78"
// @Success      200  {object}  nextCandidateResponse
// @Failure      400  {object}  ErrorResponse  "невалидный id в exclude"
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /learning/next-candidate [get]
func (h *LearningHandler) NextCandidate(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized,
			ErrorResponse{Error: "unauthorized"},
		)
		return
	}

	excludeIDs, err := parseLearningExcludeQuery(r)
	if err != nil {
		writeJSON(
			w, http.StatusBadRequest,
			ErrorResponse{Error: "invalid exclude id"},
		)
		return
	}

	word, err := h.svc.NextCandidate(r.Context(), userID, excludeIDs)
	if err != nil {
		writeLearningError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, nextCandidateResponse{Word: word})
}

// Rate godoc
// @Summary      Оценить рангом в онбординге
// @Description  Создаёт две строки progress (en_ru и ru_en) с одним level: bad→10, good→14, perfect→18.
// @Tags         learning
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  rateRequest  true  "word_id и rank"
// @Success      201  {object}  rateResponse
// @Failure      400  {object}  ErrorResponse  "невалидное тело, неизвестный rank, невалидный word_id"
// @Failure      401  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse  "слово не найдено"
// @Failure      500  {object}  ErrorResponse
// @Router       /learning/rate [post]
func (h *LearningHandler) Rate(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized,
			ErrorResponse{Error: "unauthorized"},
		)
		return
	}

	var req rateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(
			w, http.StatusBadRequest,
			ErrorResponse{Error: "invalid request body"},
		)
		return
	}

	level, err := h.svc.Rate(r.Context(), userID, req.WordID, req.Rank)
	if err != nil {
		writeLearningError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, rateResponse{Level: level})
}

// BatchStart godoc
// @Summary      Старт пачки из онбординга
// @Description  На каждый word_id создаётся по две строки progress (оба направления) с level 0. Уже существующие пары пропускаются (идемпотентность).
// @Tags         learning
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  batchStartRequest  true  "Список word_id"
// @Success      201  {object}  batchStartResponse
// @Failure      400  {object}  ErrorResponse  "пустой список, слишком много id, невалидные id"
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /learning/batch-start [post]
func (h *LearningHandler) BatchStart(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized,
			ErrorResponse{Error: "unauthorized"},
		)
		return
	}

	var req batchStartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(
			w, http.StatusBadRequest,
			ErrorResponse{Error: "invalid request body"},
		)
		return
	}

	createdCount, err := h.svc.BatchStart(r.Context(), userID, req.WordIDs)
	if err != nil {
		writeLearningError(w, err)
		return
	}
	writeJSON(
		w, http.StatusCreated,
		batchStartResponse{CreatedCount: createdCount},
	)
}

// Next godoc
// @Summary      Следующая карточка для повторения
// @Description  mode=learning — level меньше 10; mode=review — уровни 10–20 с выборкой 7:3:1 по «плохо/хорошо/отлично». direction задаёт направление карточки (en_ru или ru_en). Если карточек нет — в ответе только progress_id: null.
// @Tags         learning
// @Produce      json
// @Security     BearerAuth
// @Param        mode       query  string  true  "learning или review"
// @Param        direction  query  string  true  "en_ru или ru_en"
// @Param        exclude    query  string  false  "Для mode=learning: id progress через запятую; клиент передаёт строки, по которым уже ответили «знаю» в этой сессии по этому направлению"
// @Success      200  {object}  nextResponse
// @Failure      400  {object}  ErrorResponse  "нет mode или direction, неверные значения"
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /learning/next [get]
func (h *LearningHandler) Next(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized,
			ErrorResponse{Error: "unauthorized"},
		)
		return
	}

	mode := r.URL.Query().Get("mode")
	if mode == "" {
		writeJSON(
			w, http.StatusBadRequest,
			ErrorResponse{Error: "mode is required"},
		)
		return
	}
	direction := r.URL.Query().Get("direction")
	if direction == "" {
		writeJSON(
			w, http.StatusBadRequest,
			ErrorResponse{Error: "direction is required"},
		)
		return
	}

	excludeIDs, err := parseLearningExcludeQuery(r)
	if err != nil {
		writeJSON(
			w, http.StatusBadRequest,
			ErrorResponse{Error: "invalid exclude id"},
		)
		return
	}

	res, err := h.svc.NextProgressWithWord(
		r.Context(), userID,
		service.Mode(mode), model.Direction(direction),
		excludeIDs,
	)
	if err != nil {
		writeLearningError(w, err)
		return
	}

	if res == nil {
		writeJSON(w, http.StatusOK, nextResponse{})
		return
	}

	writeJSON(w, http.StatusOK, nextResponse{
		ProgressID: &res.Progress.ID,
		Word:       &res.Word,
		Direction:  &res.Progress.Direction,
		Level:      &res.Progress.Level,
	})
}

// Answer godoc
// @Summary      Ответ по карточке
// @Description  Обновляет level и last_reviewed_at по правилам learning/review. graduated=true при переходе с level ниже 10 на 10 или выше.
// @Tags         learning
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  answerRequest  true  "progress_id и known"
// @Success      200  {object}  answerResponse
// @Failure      400  {object}  ErrorResponse
// @Failure      401  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse  "progress не найден"
// @Failure      500  {object}  ErrorResponse
// @Router       /learning/answer [post]
func (h *LearningHandler) Answer(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized,
			ErrorResponse{Error: "unauthorized"},
		)
		return
	}

	var req answerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(
			w, http.StatusBadRequest,
			ErrorResponse{Error: "invalid request body"},
		)
		return
	}

	newLevel, graduated, err := h.svc.SubmitAnswer(
		r.Context(), userID, req.ProgressID, req.Known,
	)
	if err != nil {
		writeLearningError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, answerResponse{
		NewLevel:  newLevel,
		Graduated: graduated,
	})
}

// Stats godoc
// @Summary Статистика прогресса по ведёркам
// @Tags learning
// @Produce json
// @Security BearerAuth
// @Success 200 {object} statsResponse
// @Router /learning/stats [get]
func (h *LearningHandler) Stats(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized,
			ErrorResponse{Error: "unauthorized"},
		)
		return
	}
	stats, err := h.svc.GetStats(r.Context(), userID)
	if err != nil {
		writeLearningError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, statsResponse{
		EnRu: bucketStatsResponse{
			New:        stats.EnRu.New,
			InProgress: stats.EnRu.InProgress,
			Bad:        stats.EnRu.Bad,
			Good:       stats.EnRu.Good,
			Perfect:    stats.EnRu.Perfect,
			Total:      stats.EnRu.New + stats.EnRu.InProgress + stats.EnRu.Bad + stats.EnRu.Good + stats.EnRu.Perfect,
		},
		RuEn: bucketStatsResponse{
			New:        stats.RuEn.New,
			InProgress: stats.RuEn.InProgress,
			Bad:        stats.RuEn.Bad,
			Good:       stats.RuEn.Good,
			Perfect:    stats.RuEn.Perfect,
			Total:      stats.RuEn.New + stats.RuEn.InProgress + stats.RuEn.Bad + stats.RuEn.Good + stats.RuEn.Perfect,
		},
		Total: bucketStatsResponse{
			New:        stats.Total.New,
			InProgress: stats.Total.InProgress,
			Bad:        stats.Total.Bad,
			Good:       stats.Total.Good,
			Perfect:    stats.Total.Perfect,
			Total:      stats.Total.New + stats.Total.InProgress + stats.Total.Bad + stats.Total.Good + stats.Total.Perfect,
		},
	})
}

func writeLearningError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidLearningInput),
		errors.Is(err, service.ErrUnknownRank),
		errors.Is(err, service.ErrUnknownMode),
		errors.Is(err, service.ErrUnknownDirection):
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: err.Error()})
	case errors.Is(err, repository.ErrProgressNotFound):
		writeJSON(
			w, http.StatusNotFound,
			ErrorResponse{Error: "progress not found"},
		)
	case errors.Is(err, repository.ErrWordNotFound),
		errors.Is(err, service.ErrWordNotFound):
		writeJSON(
			w, http.StatusNotFound,
			ErrorResponse{Error: "word not found"},
		)
	default:
		log.Printf("learning handler: %v", err)
		writeJSON(
			w, http.StatusInternalServerError,
			ErrorResponse{Error: "internal server error"},
		)
	}
}
