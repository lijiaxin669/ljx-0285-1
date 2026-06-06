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
	keyword := c.Query("keyword")
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
	if keyword != "" {
		filter["$or"] = bson.A{
			bson.M{"name": bson.M{"$regex": keyword, "$options": "i"}},
			bson.M{"brand": bson.M{"$regex": keyword, "$options": "i"}},
			bson.M{"model": bson.M{"$regex": keyword, "$options": "i"}},
			bson.M{"description": bson.M{"$regex": keyword, "$options": "i"}},
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
	if stockDiff != 0 {
		newAvailable := existing.Available + stockDiff
		if newAvailable < 0 {
			rentedOut := existing.TotalStock - existing.Available
			utils.BadRequest(c, "Available stock cannot be negative. Current rented out: "+strconv.Itoa(rentedOut)+", new totalStock too low")
			return
		}
		sku.Available = newAvailable
	} else {
		sku.Available = existing.Available
	}

	sku.ID = id
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

	orderCol := db.Collection("orders")
	inTransitStatuses := bson.A{
		models.OrderStatusPending,
		models.OrderStatusPaid,
		models.OrderStatusPickedUp,
		models.OrderStatusOverdue,
		models.OrderStatusReturned,
	}
	inTransitCount, err := orderCol.CountDocuments(ctx, bson.M{
		"skuId":  id,
		"status": bson.M{"$in": inTransitStatuses},
	})
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	if inTransitCount > 0 {
		utils.BadRequest(c, "Cannot delete SKU with in-transit orders. There are "+strconv.FormatInt(inTransitCount, 10)+" active orders for this SKU")
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

	utils.Success(c, gin.H{"message": "SKU deleted successfully (hard delete)"})
}

func AdjustStock(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid SKU ID")
		return
	}

	var req models.AdjustStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	skuCol := db.Collection("skus")
	logCol := db.Collection("inventory_logs")

	session, err := db.GetClient().StartSession()
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	defer session.EndSession(ctx)

	var sku models.SKU
	var beforeAvailable, afterAvailable int

	_, err = session.WithTransaction(ctx, func(sessCtx mongo.SessionContext) (interface{}, error) {
		if err := skuCol.FindOne(sessCtx, bson.M{"_id": id}).Decode(&sku); err != nil {
			if err == mongo.ErrNoDocuments {
				return nil, utils.NewValidationError("SKU not found")
			}
			return nil, err
		}

		beforeAvailable = sku.Available
		afterAvailable = sku.Available + req.AdjustAmount
		if afterAvailable < 0 {
			return nil, utils.NewValidationError("Available stock cannot be negative. Current available: " + strconv.Itoa(beforeAvailable))
		}

		newTotalStock := sku.TotalStock + req.AdjustAmount
		if newTotalStock < 0 {
			return nil, utils.NewValidationError("Total stock cannot be negative")
		}

		_, err := skuCol.UpdateOne(sessCtx, bson.M{"_id": id}, bson.M{
			"$set": bson.M{
				"available": afterAvailable,
				"totalStock": newTotalStock,
				"updatedAt":  time.Now(),
			},
		})
		if err != nil {
			return nil, err
		}

		log := models.InventoryLog{
			ID:              primitive.NewObjectID(),
			SKUID:           id,
			SKUName:         sku.Name,
			AdjustAmount:    req.AdjustAmount,
			BeforeAvailable: beforeAvailable,
			AfterAvailable:  afterAvailable,
			Reason:          req.Reason,
			ReasonName:      req.Reason.Name(),
			Remark:          req.Remark,
			Operator:        "admin",
			CreatedAt:       time.Now(),
		}
		_, err = logCol.InsertOne(sessCtx, log)
		if err != nil {
			return nil, err
		}

		return nil, nil
	})

	if err != nil {
		if verr, ok := err.(*utils.ValidationError); ok {
			utils.BadRequest(c, verr.Error())
			return
		}
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, models.AdjustStockResponse{
		Success:         true,
		BeforeAvailable: beforeAvailable,
		AfterAvailable:  afterAvailable,
	})
}

func ListInventoryLogs(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	skuID := c.Query("skuId")
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	filter := bson.M{}
	if skuID != "" {
		id, err := primitive.ObjectIDFromHex(skuID)
		if err == nil {
			filter["skuId"] = id
		}
	}
	if startDate != "" || endDate != "" {
		dateFilter := bson.M{}
		if startDate != "" {
			if t, err := time.Parse("2006-01-02", startDate); err == nil {
				dateFilter["$gte"] = t
			}
		}
		if endDate != "" {
			if t, err := time.Parse("2006-01-02", endDate); err == nil {
				dateFilter["$lte"] = t.Add(24 * time.Hour)
			}
		}
		if len(dateFilter) > 0 {
			filter["createdAt"] = dateFilter
		}
	}

	skip := (page - 1) * limit

	opts := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(limit)).
		SetSort(bson.M{"createdAt": -1})

	col := db.Collection("inventory_logs")
	cursor, err := col.Find(ctx, filter, opts)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	defer cursor.Close(ctx)

	var logs []models.InventoryLog
	if err := cursor.All(ctx, &logs); err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	total, _ := col.CountDocuments(ctx, filter)

	utils.Success(c, gin.H{
		"items": logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
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
