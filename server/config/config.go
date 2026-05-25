package config

import "os"

var (
	Port      = env("PORT", "3001")
	DBHost    = env("DB_HOST", "localhost")
	DBPort    = env("DB_PORT", "5432")
	DBName    = env("DB_NAME", "yueduqi")
	DBUser    = env("DB_USER", "yueduqi")
	DBPass    = env("DB_PASSWORD", "yueduqi123")
	RedisHost = env("REDIS_HOST", "localhost")
	RedisPort = env("REDIS_PORT", "6379")
	JWTSecret = []byte(env("JWT_SECRET", "yueduqi-dev-secret"))
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
