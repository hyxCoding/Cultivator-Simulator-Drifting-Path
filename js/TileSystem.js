/**
 * 瓦片系统类
 * 负责管理地图瓦片数据：加载碰撞图时就地生成整张“瓦片碰撞表”（只做一次），
 * 之后移动 / 寻路只查表，不再逐帧读像素。
 * 碰撞图约定：白色可通行，黑色不可通行（瓦片内黑像素占比 ≥ blackPixelThreshold 视为不可通行）。
 */
class TileSystem {
    /**
     * @param {number} tileSize - 瓦片大小（像素）
     * @param {number} mapWidth - 地图宽度（瓦片数量）
     * @param {number} mapHeight - 地图高度（瓦片数量）
     * @param {Image} collisionImage - 碰撞图图片对象（白色可通行 / 黑色不可通行）
     * @param {Array} [collisionData] - 预生成的瓦片碰撞数据（可选，兜底用）：
     *        二维数组，每格 '.' / '1' / 1 / true = 可通行，'#' / '0' / 0 / false = 不可通行。
     *        当碰撞图无法读取像素时使用（例如以 file:// 直接打开游戏，读取本地图片像素
     *        会被浏览器判定为跨源，getImageData 抛 SecurityError）。
     */
    constructor(tileSize, mapWidth, mapHeight, collisionImage, collisionData) {
        this.tileSize = tileSize;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.collisionImage = collisionImage;
        this.collisionData = collisionData || null;
        
        // 瓦片可达性数组 [y][x]，true=可达，false=不可达
        this.walkableTiles = [];
        
        // 黑色像素占比阈值，超过此比例视为不可达
        this.blackPixelThreshold = 0.5;
        
        // 初始化瓦片数据
        this.initTilesFromCollisionImage();
    }

    /**
     * 生成瓦片碰撞表（只在加载时执行一次，之后移动/寻路只查表）
     * 优先级：
     *   1) 解析碰撞图（白色可通行 / 黑色不可通行）—— 图片是唯一数据源，改图即生效；
     *   2) 地图配置里的 collisionData —— 由同一张碰撞图预生成，兜底“读不到像素”的情况；
     *   3) 两者都不可用 → 全部可通行（保持旧行为，游戏仍可运行）。
     */
    initTilesFromCollisionImage() {
        // 1) 有碰撞图 → 按瓦片统计黑像素占比生成
        if (this.collisionImage && this.collisionImage.width && this.collisionImage.height) {
            if (this._buildWalkableFromImage()) return;
        }

        // 2) 碰撞图缺失或无法读像素 → 用预生成的瓦片碰撞数据
        if (this._buildWalkableFromData(this.collisionData)) return;

        // 3) 兜底：全部可通行
        this._fillWalkable(true);
    }

    /**
     * 从碰撞图生成瓦片碰撞表（白色可通行 / 黑色不可通行）
     * @returns {boolean} 是否成功生成
     * @private
     */
    _buildWalkableFromImage() {
        try {
            // 尺寸校验：tileSize 需整除碰撞图尺寸，否则最后一行/列会取样不足
            if (this.collisionImage.width % this.tileSize !== 0 ||
                this.collisionImage.height % this.tileSize !== 0) {
                console.warn(`[TileSystem] 碰撞图 ${this.collisionImage.width}×${this.collisionImage.height} `
                    + `不是 tileSize(${this.tileSize}) 的整数倍，最后一行/列判定可能不准`);
            }

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
            const tiles = [];
            for (let y = 0; y < this.mapHeight; y++) {
                tiles[y] = [];
                for (let x = 0; x < this.mapWidth; x++) {
                    tiles[y][x] = this.analyzeTileWalkable(x, y, pixels);
                }
            }
            this.walkableTiles = tiles;
            return true;
        } catch (error) {
            // 说明：以 file:// 直接打开游戏时，读取本地图片像素会被浏览器判定为跨源，
            // getImageData 会抛 SecurityError，此时按下面的顺序兜底：
            //   地图配置 collisionData（预生成的瓦片碰撞数据）→ 全部可通行。
            console.warn(`[TileSystem] 碰撞图像素解析失败（${error && error.name}），`
                + (this.collisionData ? '改用地图配置中的 collisionData' : '本张地图按全部可通行处理'));
            return false;
        }
    }

    /**
     * 用预生成的瓦片碰撞数据填充碰撞表
     * @param {Array} data - 二维数组，'.' / '1' / 1 / true = 可通行，'#' / '0' / 0 / false = 不可通行
     * @returns {boolean} 是否成功填充
     * @private
     */
    _buildWalkableFromData(data) {
        if (!Array.isArray(data) || data.length < this.mapHeight) return false;

        const tiles = [];
        for (let y = 0; y < this.mapHeight; y++) {
            const row = data[y];
            if (!row || row.length < this.mapWidth) {
                console.warn(`[TileSystem] collisionData 第 ${y} 行不足 ${this.mapWidth} 格，忽略该数据`);
                return false;
            }
            const line = [];
            for (let x = 0; x < this.mapWidth; x++) {
                const cell = row[x];
                line.push(cell === '.' || cell === '1' || cell === 1 || cell === true);
            }
            tiles.push(line);
        }
        this.walkableTiles = tiles;
        return true;
    }

    /**
     * 将全部瓦片统一设为可通行/不可通行
     * @param {boolean} value - true=可通行
     * @private
     */
    _fillWalkable(value) {
        this.walkableTiles = [];
        for (let y = 0; y < this.mapHeight; y++) {
            this.walkableTiles[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
                this.walkableTiles[y][x] = value;
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
     *
     * 性能：结果**按 walkableTiles 的引用缓存**（寻路每个 pathUpdateInterval 调用一次，
     * 地图加载后碰撞表不再变），避免每次深拷贝整张网格（100×100 就是 1 万个元素）。
     * `initTilesFromCollisionImage` 每次重建都会**重新赋值** walkableTiles，
     * 这里用引用比对自动失效缓存，无需手动清理。
     *
     * ⚠ 返回的是**缓存副本**，调用方只读，请勿修改（AStar 只读取）。
     * @returns {Array} 二维数组，true=可达，false=不可达
     */
    getWalkableGrid() {
        if (this._walkableGridCache && this._walkableGridCacheSource === this.walkableTiles) {
            return this._walkableGridCache;
        }
        this._walkableGridCache = this.walkableTiles.map(row => [...row]);
        this._walkableGridCacheSource = this.walkableTiles;
        return this._walkableGridCache;
    }

    /**
     * 序列化瓦片数据（用于存档）
     * 注意：瓦片碰撞表不写入存档 —— 它是加载碰撞图时生成的派生数据，
     * 每次加载地图都会按当前碰撞图（或其 collisionData 兜底）重新生成。
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            tileSize: this.tileSize,
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight,
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
        this.blackPixelThreshold = data.blackPixelThreshold || this.blackPixelThreshold;
        
        // 瓦片碰撞表不随存档恢复，读档后按当前碰撞图重新生成；
        // 旧存档里的 data.walkableTiles（例如 file:// 下生成的“全可通行”）一律忽略
        this.initTilesFromCollisionImage();
    }
}