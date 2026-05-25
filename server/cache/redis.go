package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	client *redis.Client
}

func New(addr string) *Cache {
	client := redis.NewClient(&redis.Options{
		Addr:       addr,
		MaxRetries: 1,
	})
	return &Cache{client: client}
}

func (c *Cache) Get(ctx context.Context, key string, dest any) bool {
	raw, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(raw, dest) == nil
}

func (c *Cache) Set(ctx context.Context, key string, value any, ttl time.Duration) {
	data, err := json.Marshal(value)
	if err != nil {
		return
	}
	c.client.Set(ctx, key, data, ttl)
}
