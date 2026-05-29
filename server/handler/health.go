package handler

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/hinder110/yueduqi-go/server/parser"
)

type SourceStatus string

const (
	StatusHealthy  SourceStatus = "healthy"
	StatusDegraded SourceStatus = "degraded"
	StatusDown     SourceStatus = "down"
)

type SourceEntry struct {
	Status        SourceStatus `json:"status"`
	LastSuccessAt time.Time    `json:"lastSuccessAt"`
	LastError     string       `json:"lastError,omitempty"`
	FailCount     int          `json:"failCount"`
	AvgLatency    int64        `json:"avgLatencyMs"`
}

type SourceHealth struct {
	mu       sync.RWMutex
	entries  map[string]*SourceEntry
	sources  []string
	parserFn func(string) parser.Parser
}

func NewSourceHealth(sources []string, parserFn func(string) parser.Parser) *SourceHealth {
	h := &SourceHealth{
		entries:  make(map[string]*SourceEntry),
		sources:  sources,
		parserFn: parserFn,
	}
	for _, s := range sources {
		h.entries[s] = &SourceEntry{Status: StatusHealthy}
	}
	return h
}

func (h *SourceHealth) Record(name string, success bool, latency time.Duration, err string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	e := h.entries[name]
	if e == nil {
		return
	}
	if success {
		e.Status = StatusHealthy
		e.LastSuccessAt = time.Now()
		e.LastError = ""
		e.FailCount = 0
	} else {
		e.FailCount++
		e.LastError = err
		if e.FailCount >= 3 {
			e.Status = StatusDown
		} else {
			e.Status = StatusDegraded
		}
	}
	e.AvgLatency = latency.Milliseconds()
}

func (h *SourceHealth) Get(name string) *SourceEntry {
	h.mu.RLock()
	defer h.mu.RUnlock()
	e := h.entries[name]
	if e == nil {
		return &SourceEntry{Status: StatusDown}
	}
	cp := *e
	return &cp
}

func (h *SourceHealth) ProbeOnce(ctx context.Context, name string) {
	start := time.Now()
	p := h.parserFn(name)
	if p == nil {
		h.Record(name, false, time.Since(start), "parser not found")
		return
	}
	_, err := p.SearchBooks(ctx, "测试")
	if err != nil {
		h.Record(name, false, time.Since(start), err.Error())
	} else {
		h.Record(name, true, time.Since(start), "")
	}
}

func (h *SourceHealth) ProbeAll(ctx context.Context) {
	for _, name := range h.sources {
		h.ProbeOnce(ctx, name)
	}
}

func (h *SourceHealth) ProbeLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.ProbeAll(ctx)
		}
	}
}

func (s *Server) HandleSourceStatus(w http.ResponseWriter, r *http.Request) {
	statuses := make(map[string]*SourceEntry)
	for _, name := range s.Health.sources {
		statuses[name] = s.Health.Get(name)
	}
	writeOK(w, statuses)
}
