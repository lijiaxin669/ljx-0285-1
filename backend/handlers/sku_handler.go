package handlers

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"yuexing-backend/db"
	"yuexing-backend/models"
	"yuexing-backend/utils"
)

func ListSKUs(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	category := c.Query("category")
	minPrice := c.Query("minPrice")
	maxPrice := c.Query("maxPrice")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	filter := bson.M{}
	if category != "" {
		filter["category"] = category
	}
	if minPrice != "" {
		min, _ := strconv.ParseFloat(minPrice, 64)
		filter["dailyRate"] = bson.M{"$gte": min}
	}
	if maxPrice != "" {
		max, _ := strconv.ParseFloat(maxPrice, 64)
		if existing, ok := filter["dailyRate"]; ok {
			filter["dailyRate"] = bson.M{
				"$gte": existing.(bson.M)["$gte"],
				"$lte": max,
			}
		} else {
			filter["dailyRate"] = bson.M{"$lte": max}
		}
	}

	skip := (page - 1) * limit

	opts := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(limit)).
		SetSort(bson.M{"createdAt": -1})

	col := db.Collection("skus")
	cursor, err := col.Find(ctx, filter, opts)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	defer cursor.Close(ctx)

	var skus []models.SKU
	if err := cursor.All(ctx, &skus); err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	total, _ := col.CountDocuments(ctx, filter)

	utils.Success(c, gin.H{
		"items": skus,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func GetSKU(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid SKU ID")
		return
	}

	var sku models.SKU
	col := db.Collection("skus")
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&sku); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "SKU not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, sku)
}

func CreateSKU(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var sku models.SKU
	if err := c.ShouldBindJSON(&sku); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	sku.ID = primitive.NewObjectID()
	sku.Available = sku.TotalStock
	sku.CreatedAt = time.Now()
	sku.UpdatedAt = time.Now()

	col := db.Collection("skus")
	_, err := col.InsertOne(ctx, sku)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, sku)
}

func UpdateSKU(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid SKU ID")
		return
	}

	var sku models.SKU
	if err := c.ShouldBindJSON(&sku); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	col := db.Collection("skus")
	var existing models.SKU
	if err := col.FindOne(ctx, bson.M{"_id": id}).Decode(&existing); err != nil {
		if err == mongo.ErrNoDocuments {
			utils.NotFound(c, "SKU not found")
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	stockDiff := sku.TotalStock - existing.TotalStock
	if existing.Available+stockDiff < 0 {
		utils.BadRequest(c, "Available stock cannot be negative")
		return
	}

	sku.ID = id
	sku.Available = existing.Available + stockDiff
	sku.UpdatedAt = time.Now()
	sku.CreatedAt = existing.CreatedAt

	update := bson.M{"$set": sku}
	_, err = col.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, sku)
}

func DeleteSKU(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid SKU ID")
		return
	}

	col := db.Collection("skus")
	result, err := col.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	if result.DeletedCount == 0 {
		utils.NotFound(c, "SKU not found")
		return
	}

	utils.Success(c, gin.H{"message": "SKU deleted successfully"})
}

func GetSKUCategories(c *gin.Context) {
	utils.Success(c, gin.H{
		"categories": []gin.H{
			{"key": "string", "name": "弦乐"},
			{"key": "wind", "name": "管乐"},
			{"key": "percussion", "name": "打击"},
			{"key": "keyboard", "name": "键盘"},
			{"key": "electronic", "name": "电子"},
		},
	})
}
