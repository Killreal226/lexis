package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"

	"github.com/Killreal226/lexis/backend/internal/middleware"
	"github.com/Killreal226/lexis/backend/internal/model"
	"github.com/Killreal226/lexis/backend/internal/repository"
	"github.com/Killreal226/lexis/backend/internal/service"
)

const maxWordImageBytes = 5 << 20

type WordHandler struct {
	svc *service.WordService
}

func NewWordHandler(svc *service.WordService) *WordHandler {
	return &WordHandler{svc: svc}
}

type wordCheckRequest struct {
	Word string `json:"word" example:"backyard"`
}

type WordCheckResponse struct {
	ExactMatch []model.Word                     `json:"exact_match"`
	Similar    []repository.WordWithSimilarity `json:"similar"`
	Contains   []model.Word                     `json:"contains"`
}

// GetByID godoc
// @Summary      Слово по ID
// @Description  Возвращает карточку, если слово общее или создано текущим пользователем.
// @Tags         words
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      int64  true  "ID слова"
// @Success      200  {object}  model.Word
// @Failure      400  {object}  ErrorResponse  "невалидный id"
// @Failure      401  {object}  ErrorResponse
// @Failure      404  {object}  ErrorResponse  "нет доступа или слово не найдено"
// @Failure      500  {object}  ErrorResponse
// @Router       /words/{id} [get]
func (h *WordHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized, 
			ErrorResponse{Error: "unauthorized"},
		)
		return
	}

	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeJSON(
			w, http.StatusBadRequest, 
			ErrorResponse{Error: "invalid word id"},
		)
		return
	}

	word, err := h.svc.GetWordByID(r.Context(), id, userID)
	if err != nil {
		writeWordError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, word)
}

// Check godoc
// @Summary      Проверка слова перед созданием
// @Description  Точные совпадения по написанию (омонимы), похожие (pg_trgm) и вхождение подстроки; секции дедуплицированы по id.
// @Tags         words
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      wordCheckRequest  true  "Введённое слово"
// @Success      200   {object}  WordCheckResponse
// @Failure      400   {object}  ErrorResponse
// @Failure      401   {object}  ErrorResponse
// @Failure      500   {object}  ErrorResponse
// @Router       /words/check [post]
func (h *WordHandler) Check(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized, 
			ErrorResponse{Error: "unauthorized"},
		)
		return
	}

	var req wordCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(
			w, http.StatusBadRequest, 
			ErrorResponse{Error: "invalid request body"},
		)
		return
	}

	res, err := h.svc.CheckWord(r.Context(), req.Word, userID)
	if err != nil {
		writeWordError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, WordCheckResponse{
		ExactMatch: res.ExactMatch,
		Similar:    res.SimilarWords,
		Contains:   res.ContainingWords,
	})
}

// Create godoc
// @Summary      Создать приватное слово
// @Description  Форма multipart: текстовые поля + опциональный файл image (JPEG/PNG/WebP, до 5 МБ).
// @Tags         words
// @Accept       multipart/form-data
// @Produce      json
// @Security     BearerAuth
// @Param        word         formData  string  true   "Слово"
// @Param        translation  formData  string  true   "Перевод"
// @Param        example_en   formData  string  true   "Пример на английском"
// @Param        example_ru   formData  string  false  "Пример на русском"
// @Param        image        formData  file    false  "Картинка"
// @Success      201  {object}  model.Word
// @Failure      400  {object}  ErrorResponse
// @Failure      401  {object}  ErrorResponse
// @Failure      500  {object}  ErrorResponse
// @Router       /words [post]
func (h *WordHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeJSON(
			w, http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"},
		)
		return
	}

	if err := r.ParseMultipartForm(maxWordImageBytes); err != nil {
		writeJSON(
			w,
			http.StatusBadRequest,
			ErrorResponse{Error: "invalid multipart form"},
		)
		return
	}

	word := strings.TrimSpace(r.FormValue("word"))
	translation := strings.TrimSpace(r.FormValue("translation"))
	exampleEn := strings.TrimSpace(r.FormValue("example_en"))
	exampleRuVal := strings.TrimSpace(r.FormValue("example_ru"))

	var exampleRu *string
	if exampleRuVal != "" {
		exampleRu = &exampleRuVal
	}

	mw := &model.Word{
		Word:        word,
		Translation: translation,
		ExampleEn:   exampleEn,
		ExampleRu:   exampleRu,
	}

	var imageReader io.Reader
	file, hdr, err := r.FormFile("image")
	switch {
	case err == nil:
		defer file.Close()
		if hdr.Size > maxWordImageBytes {
			writeJSON(
				w, http.StatusBadRequest, 
				ErrorResponse{Error: "image file too large"},
			)
			return
		}
		imageReader = file
	case errors.Is(err, http.ErrMissingFile):
		// поле image не обязательное
		imageReader = nil
	case errors.Is(err, multipart.ErrMessageTooLarge):
		writeJSON(
			w, http.StatusBadRequest, 
			ErrorResponse{Error: "image file too large"},
		)
		return
	default:
		writeJSON(
			w, http.StatusBadRequest, 
			ErrorResponse{Error: "invalid image upload"},
		)
		return
	}

	created, err := h.svc.CreateWord(r.Context(), mw, imageReader, userID)
	if err != nil {
		writeWordError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func writeWordError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidWordInput):
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: err.Error()})
	case errors.Is(err, service.ErrUnsupportedImageType):
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: err.Error()})
	case errors.Is(err, service.ErrWordNotFound),
		errors.Is(err, repository.ErrWordNotFound):
		writeJSON(
			w, http.StatusNotFound, ErrorResponse{Error: "word not found"},
	)
	default:
		log.Printf("word handler: %v", err)
		writeJSON(
			w, http.StatusInternalServerError,
			ErrorResponse{Error: "internal server error"},
		)
	}
}
