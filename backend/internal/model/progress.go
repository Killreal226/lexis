package model

import "time"

type Direction string

const (
	DirectionEnRu Direction = "en_ru"
	DirectionRuEn Direction = "ru_en"
)

type Progress struct {
	ID             int64      `json:"id"`
	UserID         int64      `json:"user_id"`
	WordID         int64      `json:"word_id"`
	Direction      Direction  `json:"direction"`
	Level          int16      `json:"level"`
	LastReviewedAt *time.Time `json:"last_reviewed_at"`
	CreatedAt      time.Time  `json:"created_at"`
}
