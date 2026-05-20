package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type ChapterHandler struct {
	uc *usecase.ChapterUsecase
}

func NewChapterHandler(uc *usecase.ChapterUsecase) *ChapterHandler {
	return &ChapterHandler{uc: uc}
}

type chapterCreateRequest struct {
	Number  int    `json:"number"`
	Title   string `json:"title"`
	Summary string `json:"summary"`
	ReadAt  string `json:"read_at"`
}

type chapterUpdateRequest struct {
	Number  *int    `json:"number"`
	Title   *string `json:"title"`
	Summary *string `json:"summary"`
	ReadAt  *string `json:"read_at"`
}

func parseReadAt(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil, errors.New("read_at must be in YYYY-MM-DD format")
	}
	return &t, nil
}

func (h *ChapterHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chapters, err := h.uc.List(r.Context(), novelID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if chapters == nil {
		chapters = []domain.Chapter{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": chapters})
}

func (h *ChapterHandler) Create(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	var req chapterCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	readAt, err := parseReadAt(req.ReadAt)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ch := &domain.Chapter{
		NovelID: novelID,
		Number:  req.Number,
		Title:   req.Title,
		Summary: req.Summary,
		ReadAt:  readAt,
	}
	if err := h.uc.Create(r.Context(), ch); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": ch})
}

func (h *ChapterHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chapterID := chi.URLParam(r, "chapterID")
	ch, err := h.uc.GetByID(r.Context(), novelID, chapterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": ch})
}

func (h *ChapterHandler) Update(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chapterID := chi.URLParam(r, "chapterID")

	ch, err := h.uc.GetByID(r.Context(), novelID, chapterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req chapterUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Number != nil {
		ch.Number = *req.Number
	}
	if req.Title != nil {
		ch.Title = *req.Title
	}
	if req.Summary != nil {
		ch.Summary = *req.Summary
	}
	if req.ReadAt != nil {
		readAt, err := parseReadAt(*req.ReadAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		ch.ReadAt = readAt
	}

	if err := h.uc.Update(r.Context(), ch); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": ch})
}

func (h *ChapterHandler) Delete(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chapterID := chi.URLParam(r, "chapterID")
	if err := h.uc.Delete(r.Context(), novelID, chapterID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
