package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/hinder110/yueduqi-go/server/config"
	"github.com/hinder110/yueduqi-go/server/db"
	"github.com/hinder110/yueduqi-go/server/middleware"
	"github.com/hinder110/yueduqi-go/server/model"
)

type authBody struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func HandleRegister(w http.ResponseWriter, r *http.Request) {
	var body authBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "用户名和密码不能为空")
		return
	}
	if body.Username == "" || body.Password == "" {
		writeErr(w, 400, "用户名和密码不能为空")
		return
	}
	if len(body.Username) < 2 || len(body.Username) > 50 {
		writeErr(w, 400, "用户名长度 2-50 个字符")
		return
	}
	if len(body.Password) < 6 {
		writeErr(w, 400, "密码至少 6 位")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), 10)
	if err != nil {
		writeErr(w, 500, "注册失败")
		return
	}

	var id, username string
	var createdAt time.Time
	err = db.Pool.QueryRow(r.Context(),
		`INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at`,
		body.Username, string(hash),
	).Scan(&id, &username, &createdAt)

	if err != nil {
		if strings.Contains(err.Error(), "23505") {
			writeErr(w, 409, "用户名已存在")
			return
		}
		writeErr(w, 500, "注册失败")
		return
	}

	writeJSON(w, 201, model.APIResponse{Success: true, Data: map[string]any{
		"id": id, "username": username, "created_at": createdAt,
	}})
}

func HandleLogin(w http.ResponseWriter, r *http.Request) {
	var body authBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "用户名和密码不能为空")
		return
	}
	if body.Username == "" || body.Password == "" {
		writeErr(w, 400, "用户名和密码不能为空")
		return
	}

	var id, username, hash string
	err := db.Pool.QueryRow(r.Context(),
		`SELECT id, username, password_hash FROM users WHERE username = $1`, body.Username,
	).Scan(&id, &username, &hash)
	if err != nil {
		writeErr(w, 401, "用户名或密码错误")
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		writeErr(w, 401, "用户名或密码错误")
		return
	}

	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, &middleware.Claims{
		UserID:   id,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		},
	}).SignedString(config.JWTSecret)

	writeOK(w, map[string]any{
		"token": token,
		"user":  map[string]string{"id": id, "username": username},
	})
}
