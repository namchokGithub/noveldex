package handler

import (
	"net/http"

	"github.com/Namchok/noveldex/api/internal/usecase"
)

type MasterHandler struct {
	c *usecase.ChapterUsecase
	v *usecase.VolumeUsecase
	n *usecase.NovelUsecase
}

func NewMasterHandler(chapterUsecase *usecase.ChapterUsecase, volumeUsecase *usecase.VolumeUsecase, novelUsecase *usecase.NovelUsecase) *MasterHandler {
	return &MasterHandler{c: chapterUsecase, v: volumeUsecase, n: novelUsecase}
}

func (h *MasterHandler) GetLastOrderNos(w http.ResponseWriter, r *http.Request) {
	novelID := r.URL.Query().Get("novel_id")
	volumeID := r.URL.Query().Get("volume_id")
	if novelID == "" && volumeID == "" {
		writeError(w, http.StatusBadRequest, "novel_id or volume_id is required")
		return
	}

	lastVolumeNo := 0
	if novelID != "" {
		if _, err := h.n.GetByID(r.Context(), novelID); err != nil {
			writeError(w, http.StatusNotFound, "not found")
			return
		}

		var err error
		lastVolumeNo, err = h.v.GetLastNumber(r.Context(), novelID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	lastChapterNo := 0
	if volumeID != "" {
		var err error
		lastChapterNo, err = h.c.GetLastNumber(r.Context(), volumeID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"data": map[string]int{
			"volume":  lastVolumeNo,
			"chapter": lastChapterNo,
		},
	})
}
