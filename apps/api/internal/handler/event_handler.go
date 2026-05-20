package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type EventHandler struct {
	uc *usecase.EventUsecase
}

func NewEventHandler(uc *usecase.EventUsecase) *EventHandler {
	return &EventHandler{uc: uc}
}

type eventCreateRequest struct {
	ChapterID   *string `json:"chapter_id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	StoryDate   string  `json:"story_date"`
	SortOrder   int     `json:"sort_order"`
}

type eventUpdateRequest struct {
	ChapterID   *string `json:"chapter_id"`
	Title       *string `json:"title"`
	Description *string `json:"description"`
	StoryDate   *string `json:"story_date"`
	SortOrder   *int    `json:"sort_order"`
}

type eventCharacterLinkRequest struct {
	CharacterID string `json:"character_id"`
}

func (h *EventHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	events, err := h.uc.List(r.Context(), novelID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if events == nil {
		events = []domain.Event{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": events})
}

func (h *EventHandler) Create(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	var req eventCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	e := &domain.Event{
		NovelID:     novelID,
		ChapterID:   req.ChapterID,
		Title:       req.Title,
		Description: req.Description,
		StoryDate:   req.StoryDate,
		SortOrder:   req.SortOrder,
	}
	if err := h.uc.Create(r.Context(), e); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": e})
}

func (h *EventHandler) Update(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	eventID := chi.URLParam(r, "eventID")

	e, err := h.uc.GetByID(r.Context(), novelID, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req eventUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ChapterID != nil {
		e.ChapterID = req.ChapterID
	}
	if req.Title != nil {
		e.Title = *req.Title
	}
	if req.Description != nil {
		e.Description = *req.Description
	}
	if req.StoryDate != nil {
		e.StoryDate = *req.StoryDate
	}
	if req.SortOrder != nil {
		e.SortOrder = *req.SortOrder
	}

	if err := h.uc.Update(r.Context(), e); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": e})
}

func (h *EventHandler) Delete(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	eventID := chi.URLParam(r, "eventID")
	if err := h.uc.Delete(r.Context(), novelID, eventID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *EventHandler) LinkCharacter(w http.ResponseWriter, r *http.Request) {
	eventID := chi.URLParam(r, "eventID")
	var req eventCharacterLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CharacterID == "" {
		writeError(w, http.StatusBadRequest, "character_id is required")
		return
	}
	if err := h.uc.LinkCharacter(r.Context(), eventID, req.CharacterID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *EventHandler) UnlinkCharacter(w http.ResponseWriter, r *http.Request) {
	eventID := chi.URLParam(r, "eventID")
	characterID := chi.URLParam(r, "characterID")
	if err := h.uc.UnlinkCharacter(r.Context(), eventID, characterID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
