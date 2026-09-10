/**
 * 瓦片系统类
 * 负责管理地图瓦片数据，基于碰撞图判断瓦片是否可达
 */
class TileSystem {
    /**
     * @param {number} tileSize - 瓦片大小（像素）
     * @param {number} mapWidth - 地图宽度（瓦片数量）
     * @param {number} mapHeight - 地图高度（瓦片数量）
     * @param {Image} collisionImage - 碰撞图图片对象
     */
    constructor(tileSize, mapWidth, mapHeight, collisionImage) {
        this.tileSize = tileSize;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.collisionImage = collisionImage;
        
        // 瓦片可达性数组 [y][x]，true=可达，false=不可达
        this.walkableTiles = [];
        
        // 黑色像素占比阈值，超过此比例视为不可达
        this.blackPixelThreshold = 0.5;
        
        // 初始化瓦片数据
        this.initTilesFromCollisionImage();
    }

    /**
     * 从碰撞图初始化瓦片可达性数据
     * 通过分析每个瓦片区域内的黑色像素占比来判断是否可达
     */
    initTilesFromCollisionImage() {
        // 创建临时canvas来分析碰撞图
        const canvas = document.createElement('canvas');
        canvas.width = this.collisionImage.width;
        canvas.height = this.collisionImage.height;
        const ctx = canvas.getContext('2d');
        
        // 绘制碰撞图到canvas
        ctx.drawImage(this.collisionImage, 0, 0);
        
        // 获取图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // 计算每个瓦片的可达性
        for (let y = 0; y < this.mapHeight; y++) {
            this.walkableTiles[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
                this.walkableTiles[y][x] = this.analyzeTileWalkable(x, y, pixels);
            }
        }
    }

    /**
     * 分析单个瓦片是否可达
     * @param {number} tileX - 瓦片的x索引
     * @param {number} tileY - 瓦片的y索引
     * @param {Uint8ClampedArray} pixels - 碰撞图的像素数据
     * @returns {boolean} 是否可达
     */
    analyzeTileWalkable(tileX, tileY, pixels) {
        const startX = tileX * this.tileSize;
        const startY = tileY * this.tileSize;
        const endX = Math.min(startX + this.tileSize, this.collisionImage.width);
        const endY = Math.min(startY + this.tileSize, this.collisionImage.height);
        
        let blackPixelCount = 0;
        let totalPixelCount = 0;
        
        // 遍历瓦片内的像素
        for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
                const pixelIndex = (py * this.collisionImage.width + px) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                const a = pixels[pixelIndex + 3];
                
                totalPixelCount++;
                
                // 判断是否为黑色像素（考虑透明度和RGB值）
                if (a > 0 && r < 50 && g < 50 && b < 50) {
                    blackPixelCount++;
                }
            }
        }
        
        // 如果黑色像素占比超过阈值，则不可达
        const blackRatio = totalPixelCount > 0 ? blackPixelCount / totalPixelCount : 0;
        return blackRatio < this.blackPixelThreshold;
    }

    /**
     * 获取指定瓦片是否可达
     * @param {number} tileX - 瓦片的x索引
     * @param {number} tileY - 瓦片的y索引
     * @returns {boolean} 是否可达
     */
    isTileWalkable(tileX, tileY) {
        // 边界检查
        if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
            return false;
        }
        return this.walkableTiles[tileY][tileX];
    }

    /**
     * 获取像素坐标对应的瓦片索引
     * @param {number} pixelX - 像素x坐标
     * @param {number} pixelY - 像素y坐标
     * @returns {Object} 瓦片索引 {x, y}
     */
    getTileIndexFromPixel(pixelX, pixelY) {
        return {
            x: Math.floor(pixelX / this.tileSize),
            y: Math.floor(pixelY / this.tileSize)
        };
    }

    /**
     * 获取瓦片中心点的像素坐标
     * @param {number} tileX - 瓦片的x索引
     * @param {number} tileY - 瓦片的y索引
     * @returns {Object} 像素坐标 {x, y}
     */
    getTileCenterPixel(tileX, tileY) {
        return {
            x: tileX * this.tileSize + this.tileSize / 2,
            y: tileY * this.tileSize + this.tileSize / 2
        };
    }

    /**
     * 获取指定像素坐标周围的可达瓦片
     * @param {number} pixelX - 像素x坐标
     * @param {number} pixelY - 像素y坐标
     * @param {number} radius - 搜索半径（瓦片数量）
     * @returns {Array} 可达瓦片列表 [{x, y}, ...]
     */
    getWalkableTilesAround(pixelX, pixelY, radius = 3) {
        const centerTile = this.getTileIndexFromPixel(pixelX, pixelY);
        const walkableTiles = [];
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tileX = centerTile.x + dx;
                const tileY = centerTile.y + dy;
                if (this.isTileWalkable(tileX, tileY)) {
                    walkableTiles.push({ x: tileX, y: tileY });
                }
            }
        }
        
        return walkableTiles;
    }

    /**
     * 获取地图数据（用于A*寻路）
     * @returns {Array} 二维数组，true=可达，false=不可达
     */
    getWalkableGrid() {
        return this.walkableTiles.map(row => [...row]);
    }

    /**
     * 序列化瓦片数据（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            tileSize: this.tileSize,
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight,
            walkableTiles: this.walkableTiles.map(row => [...row]),
            blackPixelThreshold: this.blackPixelThreshold,
        };
    }

    /**
     * 反序列化瓦片数据（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.tileSize = data.tileSize || this.tileSize;
        this.mapWidth = data.mapWidth || this.mapWidth;
        this.mapHeight = data.mapHeight || this.mapHeight;
        this.walkableTiles = data.walkableTiles || this.walkableTiles;
        this.blackPixelThreshold = data.blackPixelThreshold || this.blackPixelThreshold;
    }
}