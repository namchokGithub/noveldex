package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type CharacterHandler struct {
	uc *usecase.CharacterUsecase
}

func NewCharacterHandler(uc *usecase.CharacterUsecase) *CharacterHandler {
	return &CharacterHandler{uc: uc}
}

type characterCreateRequest struct {
	Name        string   `json:"name"`
	Role        string   `json:"role"`
	Description string   `json:"description"`
	Aliases     []string `json:"aliases"`
}

type characterUpdateRequest struct {
	Name        *string   `json:"name"`
	Role        *string   `json:"role"`
	Description *string   `json:"description"`
	Aliases     *[]string `json:"aliases"`
}

type characterLinkRequest struct {
	CharacterID string `json:"character_id"`
}

func (h *CharacterHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	chars, err := h.uc.List(r.Context(), novelID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if chars == nil {
		chars = []domain.Character{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": chars})
}

func (h *CharacterHandler) Create(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	var req characterCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c := &domain.Character{
		NovelID:     novelID,
		Name:        req.Name,
		Role:        req.Role,
		Description: req.Description,
		Aliases:     req.Aliases,
	}
	if err := h.uc.Create(r.Context(), c); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": c})
}

func (h *CharacterHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	characterID := chi.URLParam(r, "characterID")
	c, err := h.uc.GetByID(r.Context(), novelID, characterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": c})
}

func (h *CharacterHandler) Update(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	characterID := chi.URLParam(r, "characterID")

	c, err := h.uc.GetByID(r.Context(), novelID, characterID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req characterUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name != nil {
		c.Name = *req.Name
	}
	if req.Role != nil {
		c.Role = *req.Role
	}
	if req.Description != nil {
		c.Description = *req.Description
	}
	if req.Aliases != nil {
		c.Aliases = *req.Aliases
	}

	if err := h.uc.Update(r.Context(), c); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": c})
}

func (h *CharacterHandler) Delete(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	characterID := chi.URLParam(r, "characterID")
	if err := h.uc.Delete(r.Context(), novelID, characterID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CharacterHandler) ListByChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := chi.URLParam(r, "chapterID")
	chars, err := h.uc.ListByChapter(r.Context(), chapterID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if chars == nil {
		chars = []domain.Character{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": chars})
}

func (h *CharacterHandler) LinkToChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := chi.URLParam(r, "chapterID")
	var req characterLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CharacterID == "" {
		writeError(w, http.StatusBadRequest, "character_id is required")
		return
	}
	if err := h.uc.LinkToChapter(r.Context(), chapterID, req.CharacterID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CharacterHandler) UnlinkFromChapter(w http.ResponseWriter, r *http.Request) {
	chapterID := chi.URLParam(r, "chapterID")
	characterID := chi.URLParam(r, "characterID")
	if err := h.uc.UnlinkFromChapter(r.Context(), chapterID, characterID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
