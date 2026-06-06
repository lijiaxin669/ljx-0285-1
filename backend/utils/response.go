package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func Success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

func Error(c *gin.Context, code int, err string) {
	c.JSON(code, Response{
		Success: false,
		Error:   err,
	})
}

func BadRequest(c *gin.Context, err string) {
	Error(c, http.StatusBadRequest, err)
}

func NotFound(c *gin.Context, err string) {
	Error(c, http.StatusNotFound, err)
}

func InternalError(c *gin.Context, err string) {
	Error(c, http.StatusInternalServerError, err)
}

type StockError struct {
	Message string
}

func (e *StockError) Error() string {
	return e.Message
}
