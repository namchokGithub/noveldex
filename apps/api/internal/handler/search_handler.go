package handler

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/usecase"
)

type SearchHandler struct {
	uc *usecase.SearchUsecase
}

func NewSearchHandler(uc *usecase.SearchUsecase) *SearchHandler {
	return &SearchHandler{uc: uc}
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	searchType := r.URL.Query().Get("type")
	if searchType == "" {
		searchType = "all"
	}
	if len(q) < 2 {
		writeError(w, http.StatusBadRequest, "q must be at least 2 characters")
		return
	}
	result, err := h.uc.Search(r.Context(), novelID, q, searchType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": result})
}
