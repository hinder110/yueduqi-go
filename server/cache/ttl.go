package cache

import "time"

const (
	SearchTTL   = 30 * time.Minute
	ChaptersTTL = 1 * time.Hour
	ContentTTL  = 24 * time.Hour
	HotTTL      = 30 * time.Minute
)
