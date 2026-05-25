package db

import (
	"context"
	"fmt"

	"github.com/hinder110/yueduqi-go/server/config"
	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect(ctx context.Context) error {
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		config.DBUser, config.DBPass, config.DBHost, config.DBPort, config.DBName,
	)
	var err error
	Pool, err = pgxpool.New(ctx, dsn)
	return err
}
