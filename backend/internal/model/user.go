package model

import "time"

type User struct {
	ID           int64      `json:"id"`
	Email        string     `json:"email"`
	PasswordHash string     `json:"-"`
	IsSuperuser  *bool      `json:"is_superuser"`
	CreatedAt    *time.Time `json:"created_at"`
}
