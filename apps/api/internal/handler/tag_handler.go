package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type TagHandler struct {
	uc *usecase.TagUsecase
}

func NewTagHandler(uc *usecase.TagUsecase) *TagHandler {
	return &TagHandler{uc: uc}
}

type tagCreateRequest struct {
	Name string `json:"name"`
}

type chapterTagLinkRequest struct {
	TagID string `json:"tag_id"`
}

func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	tags, err := h.uc.ListByNovel(r.Context(), novelID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": tags})
}

func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	var req tagCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	t := &domain.Tag{NovelID: novelID, Name: req.Name}
	if err := h.uc.Create(r.Context(), t); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": t})
}

func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	tagID := chi.URLParam(r, "tagID")
	if err := h.uc.Delete(r.Context(), novelID, tagID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TagHandler) LinkToChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := chi.URLParam(r, "chapterID")
	var req chapterTagLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TagID == "" {
		writeError(w, http.StatusBadRequest, "tag_id is required")
		return
	}
	if err := h.uc.LinkToChapter(r.Context(), chapterID, req.TagID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TagHandler) UnlinkFromChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := chi.URLParam(r, "chapterID")
	tagID := chi.URLParam(r, "tagID")
	if err := h.uc.UnlinkFromChapter(r.Context(), chapterID, tagID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
