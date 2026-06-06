package seed

import (
	"context"
	"log"
	"time"

	"yuexing-backend/db"
	"yuexing-backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func Seed() error {
	ctx := context.Background()

	if err := seedStores(ctx); err != nil {
		return err
	}

	if err := seedSKUs(ctx); err != nil {
		return err
	}

	log.Println("Seed data completed successfully")
	return nil
}

func seedStores(ctx context.Context) error {
	stores := []models.Store{
		{Name: "乐行琴行·旗舰店", Address: "北京市朝阳区建国路88号", Phone: "010-88888888"},
		{Name: "乐行琴行·上海店", Address: "上海市浦东新区陆家嘴环路100号", Phone: "021-66666666"},
		{Name: "乐行琴行·广州店", Address: "广州市天河区天河路385号", Phone: "020-77777777"},
	}

	storeCol := db.Collection("stores")
	for i := range stores {
		existing := storeCol.FindOne(ctx, bson.M{"name": stores[i].Name})
		if existing.Err() == mongo.ErrNoDocuments {
			stores[i].CreatedAt = time.Now()
			stores[i].UpdatedAt = time.Now()
			_, err := storeCol.InsertOne(ctx, stores[i])
			if err != nil {
				return err
			}
			log.Printf("Created store: %s", stores[i].Name)
		}
	}
	return nil
}

func seedSKUs(ctx context.Context) error {
	skus := []models.SKU{
		{Name: "雅马哈 C40 古典吉他", Category: models.CategoryString, Brand: "Yamaha", Model: "C40", Description: "入门级古典吉他，适合初学者", DailyRate: 15, Deposit: 500, TotalStock: 10, Available: 10},
		{Name: "芬达 Player 电吉他", Category: models.CategoryString, Brand: "Fender", Model: "Player Stratocaster", Description: "墨西哥产玩家系列电吉他", DailyRate: 35, Deposit: 2000, TotalStock: 5, Available: 5},
		{Name: "吉普森 J-45 原声吉他", Category: models.CategoryString, Brand: "Gibson", Model: "J-45 Standard", Description: "经典民谣吉他，音色温暖", DailyRate: 80, Deposit: 5000, TotalStock: 3, Available: 3},
		{Name: "玛蒂娜 MC-88 小提琴", Category: models.CategoryString, Brand: "Martina", Model: "MC-88", Description: "4/4尺寸手工小提琴", DailyRate: 25, Deposit: 1500, TotalStock: 8, Available: 8},
		{Name: "星海 4/4 大提琴", Category: models.CategoryString, Brand: "星海", Model: "XC-100", Description: "初学者大提琴，性价比高", DailyRate: 30, Deposit: 1800, TotalStock: 4, Available: 4},

		{Name: "雅马哈 YAS-280 中音萨克斯", Category: models.CategoryWind, Brand: "Yamaha", Model: "YAS-280", Description: "初学者中音萨克斯", DailyRate: 40, Deposit: 3000, TotalStock: 4, Available: 4},
		{Name: "杰普特 JFL-511 长笛", Category: models.CategoryWind, Brand: "Jupiter", Model: "JFL-511", Description: "镀银长笛，音色优美", DailyRate: 30, Deposit: 2000, TotalStock: 6, Available: 6},
		{Name: "巴哈 TR-500 小号", Category: models.CategoryWind, Brand: "Bach", Model: "TR-500", Description: "学生级小号，黄铜材质", DailyRate: 35, Deposit: 2500, TotalStock: 3, Available: 3},
		{Name: "布菲 E13 单簧管", Category: models.CategoryWind, Brand: "Buffet", Model: "E13", Description: "专业级单簧管，木管体", DailyRate: 50, Deposit: 4000, TotalStock: 3, Available: 3},
		{Name: "塞尔玛 S80 次中音萨克斯", Category: models.CategoryWind, Brand: "Selmer", Model: "S80", Description: "高级次中音萨克斯", DailyRate: 100, Deposit: 8000, TotalStock: 2, Available: 2},

		{Name: "罗兰 TD-17KV 电子鼓", Category: models.CategoryPercussion, Brand: "Roland", Model: "TD-17KV", Description: "中级电子鼓，静音练习", DailyRate: 45, Deposit: 3500, TotalStock: 3, Available: 3},
		{Name: "雅马哈 Stage Custom 架子鼓", Category: models.CategoryPercussion, Brand: "Yamaha", Model: "Stage Custom", Description: "桦木鼓腔套鼓，5鼓配置", DailyRate: 60, Deposit: 4000, TotalStock: 2, Available: 2},
		{Name: "珍珠 Masters 架子鼓", Category: models.CategoryPercussion, Brand: "Pearl", Model: "Masters", Description: "专业级架子鼓，音色通透", DailyRate: 80, Deposit: 6000, TotalStock: 2, Available: 2},
		{Name: "知音 K Custom 镲片套装", Category: models.CategoryPercussion, Brand: "Zildjian", Model: "K Custom", Description: "专业镲片套装，5片装", DailyRate: 50, Deposit: 5000, TotalStock: 2, Available: 2},
		{Name: "专业定音鼓", Category: models.CategoryPercussion, Brand: "Ludwig", Model: "LE-CM", Description: "专业定音鼓，铜制鼓腔", DailyRate: 120, Deposit: 10000, TotalStock: 1, Available: 1},

		{Name: "卡西欧 PX-S7000 电钢琴", Category: models.CategoryKeyboard, Brand: "Casio", Model: "PX-S7000", Description: "便携电钢琴，88键逐级配重", DailyRate: 30, Deposit: 2000, TotalStock: 5, Available: 5},
		{Name: "雅马哈 CVP-805 数码钢琴", Category: models.CategoryKeyboard, Brand: "Yamaha", Model: "CVP-805", Description: "高端数码钢琴，丰富音色", DailyRate: 80, Deposit: 5000, TotalStock: 2, Available: 2},
		{Name: "罗兰 RD-2000 舞台电钢", Category: models.CategoryKeyboard, Brand: "Roland", Model: "RD-2000", Description: "专业舞台电钢琴", DailyRate: 100, Deposit: 6000, TotalStock: 2, Available: 2},
		{Name: "科音 KRONOS 合成器", Category: models.CategoryKeyboard, Brand: "Korg", Model: "KRONOS 2", Description: "顶级音乐工作站合成器", DailyRate: 120, Deposit: 8000, TotalStock: 1, Available: 1},
		{Name: "罗兰 HP704 立式电钢琴", Category: models.CategoryKeyboard, Brand: "Roland", Model: "HP704", Description: "家用立式电钢琴，实木键盘", DailyRate: 70, Deposit: 4500, TotalStock: 3, Available: 3},

		{Name: "莱恩 SL3 数码打碟机", Category: models.CategoryElectronic, Brand: "Rane", Model: "SL3", Description: "专业DJ控制器，Serato兼容", DailyRate: 50, Deposit: 3500, TotalStock: 3, Available: 3},
		{Name: "先锋 DDJ-1000 DJ控制器", Category: models.CategoryElectronic, Brand: "Pioneer", Model: "DDJ-1000", Description: "专业级DJ控制器， Rekordbox", DailyRate: 60, Deposit: 4000, TotalStock: 2, Available: 2},
		{Name: "Korg Volca 合成器套装", Category: models.CategoryElectronic, Brand: "Korg", Model: "Volca Bundle", Description: "便携模拟合成器三件套", DailyRate: 40, Deposit: 2500, TotalStock: 2, Available: 2},
		{Name: "Ableton Push 2 MIDI控制器", Category: models.CategoryElectronic, Brand: "Ableton", Model: "Push 2", Description: "Live一体化MIDI控制器", DailyRate: 45, Deposit: 3000, TotalStock: 2, Available: 2},
		{Name: "专业监听音箱套装", Category: models.CategoryElectronic, Brand: "KRK", Model: "RP-8 G4", Description: "8寸有源监听音箱一对", DailyRate: 35, Deposit: 2000, TotalStock: 4, Available: 4},
	}

	skuCol := db.Collection("skus")
	count, err := skuCol.CountDocuments(ctx, bson.M{})
	if err != nil {
		return err
	}
	if count >= 20 {
		log.Printf("SKU count: %d, seed skipped", count)
		return nil
	}

	for i := range skus {
		existing := skuCol.FindOne(ctx, bson.M{"name": skus[i].Name})
		if existing.Err() == mongo.ErrNoDocuments {
			skus[i].CreatedAt = time.Now()
			skus[i].UpdatedAt = time.Now()
			_, err := skuCol.InsertOne(ctx, skus[i])
			if err != nil {
				return err
			}
			log.Printf("Created SKU: %s", skus[i].Name)
		}
	}
	return nil
}
