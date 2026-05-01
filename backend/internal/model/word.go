package model

import "time"

type Word struct {
	ID          int64     `json:"id"`
	Word        string    `json:"word"`
	Translation string    `json:"translation"`
	ExampleEn   string    `json:"example_en"`
	ExampleRu   *string   `json:"example_ru"`
	ImagePath   *string   `json:"image_path"`
	CreatedBy   *int64    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
}
