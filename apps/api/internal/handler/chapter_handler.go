package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type ChapterHandler struct {
	uc       *usecase.ChapterUsecase
	volumeUC *usecase.VolumeUsecase
}

func NewChapterHandler(uc *usecase.ChapterUsecase, volumeUC *usecase.VolumeUsecase) *ChapterHandler {
	return &ChapterHandler{uc: uc, volumeUC: volumeUC}
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

	// Accept both legacy date-only values and full timestamps during rollout.
	for _, layout := range []string{
		time.RFC3339,
		"2006-01-02T15:04",
		"2006-01-02",
	} {
		t, err := time.Parse(layout, s)
		if err == nil {
			return &t, nil
		}
	}

	return nil, errors.New("read_at must be an ISO timestamp or YYYY-MM-DD")
}

// resolveVolume verifies volumeID belongs to novelID. Writes error and returns false on failure.
func (h *ChapterHandler) resolveVolume(ctx context.Context, w http.ResponseWriter, novelID, volumeID string) bool {
	_, err := h.volumeUC.GetByID(ctx, novelID, volumeID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return false
	}
	return true
}

func (h *ChapterHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}
	chapters, err := h.uc.List(r.Context(), volumeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if chapters == nil {
		chapters = []domain.Chapter{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": chapters})
}

func (h *ChapterHandler) ListByNovel(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chapters, err := h.uc.ListByNovel(r.Context(), novelID)
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
	volumeID := chi.URLParam(r, "volumeID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}
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
		VolumeID: volumeID,
		Number:   req.Number,
		Title:    req.Title,
		Summary:  req.Summary,
		ReadAt:   readAt,
	}
	if err := h.uc.Create(r.Context(), novelID, ch); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": ch})
}

func (h *ChapterHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	chapterID := chi.URLParam(r, "chapterID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}
	ch, err := h.uc.GetByIDWithCharacters(r.Context(), volumeID, chapterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": ch})
}

func (h *ChapterHandler) Update(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	chapterID := chi.URLParam(r, "chapterID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}

	ch, err := h.uc.GetByID(r.Context(), volumeID, chapterID)
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

	if err := h.uc.Update(r.Context(), novelID, ch); err != nil {
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
	volumeID := chi.URLParam(r, "volumeID")
	chapterID := chi.URLParam(r, "chapterID")
	if !h.resolveVolume(r.Context(), w, novelID, volumeID) {
		return
	}
	if err := h.uc.Delete(r.Context(), volumeID, chapterID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
