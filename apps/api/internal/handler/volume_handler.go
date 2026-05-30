package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/Namchok/noveldex/api/internal/domain"
	"github.com/Namchok/noveldex/api/internal/usecase"
)

type VolumeHandler struct {
	uc *usecase.VolumeUsecase
}

func NewVolumeHandler(uc *usecase.VolumeUsecase) *VolumeHandler {
	return &VolumeHandler{uc: uc}
}

type volumeCreateRequest struct {
	Number int    `json:"number"`
	Title  string `json:"title"`
}

type volumeUpdateRequest struct {
	Number *int    `json:"number"`
	Title  *string `json:"title"`
}

var allowedVolumePageSizes = map[int]struct{}{
	5:  {},
	10: {},
	20: {},
	50: {},
}

func (h *VolumeHandler) List(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	page := parsePositiveInt(r.URL.Query().Get("page"), 1)
	perPage := parsePositiveInt(r.URL.Query().Get("per_page"), 5)
	if _, ok := allowedVolumePageSizes[perPage]; !ok {
		perPage = 5
	}

	volumes, err := h.uc.List(r.Context(), novelID, page, perPage)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": volumes})
}

func (h *VolumeHandler) Create(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	var req volumeCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	v := &domain.Volume{
		NovelID: novelID,
		Number:  req.Number,
		Title:   req.Title,
	}
	if err := h.uc.Create(r.Context(), v); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": v})
}

func (h *VolumeHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	v, err := h.uc.GetByID(r.Context(), novelID, volumeID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": v})
}

func (h *VolumeHandler) Update(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")

	v, err := h.uc.GetByID(r.Context(), novelID, volumeID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req volumeUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Number != nil {
		v.Number = *req.Number
	}
	if req.Title != nil {
		v.Title = *req.Title
	}

	if err := h.uc.Update(r.Context(), v); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": v})
}

func (h *VolumeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	novelID := chi.URLParam(r, "novelID")
	volumeID := chi.URLParam(r, "volumeID")
	if err := h.uc.Delete(r.Context(), novelID, volumeID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parsePositiveInt(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
