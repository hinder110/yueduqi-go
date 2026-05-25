package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hinder110/yueduqi-go/server/config"
)

type contextKey string

const UserKey contextKey = "user"

type Claims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func Auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			http.Error(w, `{"success":false,"error":"请先登录"}`, http.StatusUnauthorized)
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(header[7:], claims, func(t *jwt.Token) (any, error) {
			return config.JWTSecret, nil
		})
		if err != nil || !token.Valid {
			http.Error(w, `{"success":false,"error":"请先登录"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserKey, claims)
		next(w, r.WithContext(ctx))
	}
}

func GetUserID(ctx context.Context) string {
	claims, _ := ctx.Value(UserKey).(*Claims)
	if claims == nil {
		return ""
	}
	return claims.UserID
}
