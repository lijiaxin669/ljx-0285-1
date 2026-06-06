package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"yuexing-backend/db"
)

type HealthStatus struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	MongoDB   string `json:"mongodb"`
}

func HealthCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	status := HealthStatus{
		Status:    "ok",
		Timestamp: time.Now().Format(time.RFC3339),
		MongoDB:   "connected",
	}

	if err := db.Client.Ping(ctx, nil); err != nil {
		status.Status = "degraded"
		status.MongoDB = "disconnected"
		c.JSON(http.StatusServiceUnavailable, status)
		return
	}

	c.JSON(http.StatusOK, status)
}
