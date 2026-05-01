package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
)

type HealthHandler struct {
	db * sql.DB
}

func NewHealthHandler(db *sql.DB) *HealthHandler {
	return &HealthHandler{db: db}
}


// Check godoc
// @Summary      Health check
// @Description  Проверяет, что сервер жив и соединение с БД работает.
// @Tags         system
// @Produce      json
// @Success      200  {object}  map[string]string  "{\"status\":\"ok\"}"
// @Failure      503  {object}  map[string]string  "{\"status\":\"db unavailable\",\"error\":\"...\"}"
// @Router       /health [get]
func (h *HealthHandler) Check(w http.ResponseWriter, r *http.Request) {
	if err := h.db.PingContext(r.Context()); err != nil {
		writeJSON(
			w, 
			http.StatusServiceUnavailable, 
			map[string] string{"status": "db unavailable", "error": err.Error()},
		)
		return
	}
	writeJSON(
		w,
		http.StatusOK,
		map[string] string{"status": "ok"},
	)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}