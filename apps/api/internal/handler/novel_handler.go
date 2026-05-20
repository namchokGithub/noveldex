package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type NovelHandler struct {
	uc *usecase.NovelUsecase
}

func NewNovelHandler(uc *usecase.NovelUsecase) *NovelHandler {
	return &NovelHandler{uc: uc}
}

type novelRequest struct {
	Title       string `json:"title"`
	Author      string `json:"author"`
	Status      string `json:"status"`
	Description string `json:"description"`
	CoverURL    string `json:"cover_url"`
}

func (h *NovelHandler) List(w http.ResponseWriter, r *http.Request) {
	novels, err := h.uc.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if novels == nil {
		novels = []domain.Novel{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": novels})
}

func (h *NovelHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req novelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	n := &domain.Novel{
		Title:       req.Title,
		Author:      req.Author,
		Status:      req.Status,
		Description: req.Description,
		CoverURL:    req.CoverURL,
	}
	if err := h.uc.Create(r.Context(), n); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": n})
}

func (h *NovelHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	n, err := h.uc.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": n})
}

func (h *NovelHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req novelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	n := &domain.Novel{
		ID:          id,
		Title:       req.Title,
		Author:      req.Author,
		Status:      req.Status,
		Description: req.Description,
		CoverURL:    req.CoverURL,
	}
	if err := h.uc.Update(r.Context(), n); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": n})
}

func (h *NovelHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.uc.Delete(r.Context(), id); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
