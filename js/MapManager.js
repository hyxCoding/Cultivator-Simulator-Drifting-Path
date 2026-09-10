

/**
 * 地图管理器类
 * 管理所有地图的加载、切换、更新和渲染
 */
class MapManager {
    constructor() {
        this.maps = new Map(); // 地图实例 {mapId: GameMap}
        this.currentMap = null; // 当前活动地图
        this.resourceManager = ResourceManager.getInstance();
        this.gameConfig = GameConfig.getInstance();
    }

    /**
     * 加载地图
     * @param {string} mapId - 地图ID
     * @returns {Promise<GameMap>} 加载完成的地图实例
     */
    async loadMap(mapId) {
        // 检查是否已加载
        if (this.maps.has(mapId)) {
            return this.maps.get(mapId);
        }
        
        // 获取地图配置
        const mapConfig = this.gameConfig.getMap(mapId);
        if (!mapConfig) {
            console.error(`地图配置不存在: ${mapId}`);
            return null;
        }
        
        // 加载地图资源
        const backgroundImage = await this.resourceManager.loadImage(`mapBackgrounds.${mapId}`);
        const collisionImage = await this.resourceManager.loadImage(`mapCollisions.${mapId}`);
        
        // 创建地图实例
        const gameMap = new GameMap(mapId, mapConfig, {
            backgroundImage: backgroundImage,
            collisionImage: collisionImage,
        });
        
        // 初始化地图
        gameMap.init();
        
        // 存储地图实例
        this.maps.set(mapId, gameMap);
        
        return gameMap;
    }

    /**
     * 切换当前地图
     * @param {string} mapId - 目标地图ID
     * @param {Object} player - 玩家实例
     * @returns {Promise<GameMap>} 切换后的地图实例
     */
    async switchMap(mapId, player) {
        // 停用当前地图
        if (this.currentMap) {
            this.currentMap.deactivate();
        }
        
        // 加载目标地图
        const targetMap = await this.loadMap(mapId);
        if (!targetMap) {
            console.error(`地图加载失败: ${mapId}`);
            return null;
        }
        
        // 设置玩家
        if (player) {
            targetMap.setPlayer(player);
        }
        
        // 激活目标地图
        targetMap.activate();
        this.currentMap = targetMap;
        
        return targetMap;
    }

    /**
     * 获取当前地图
     * @returns {GameMap|null} 当前地图实例
     */
    getCurrentMap() {
        return this.currentMap;
    }

    /**
     * 获取指定地图
     * @param {string} mapId - 地图ID
     * @returns {GameMap|null} 地图实例
     */
    getMap(mapId) {
        return this.maps.get(mapId) || null;
    }

    /**
     * 更新当前地图
     * @param {number} deltaTime - 帧时间差（毫秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        if (this.currentMap) {
            this.currentMap.update(deltaTime, input);
        }
    }

    /**
     * 渲染当前地图
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {Object} camera - 摄像机
     */
    render(ctx, camera) {
        if (this.currentMap) {
            this.currentMap.render(ctx, camera);
        }
    }

    /**
     * 序列化所有地图状态（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        const mapStates = {};
        this.maps.forEach((map, mapId) => {
            mapStates[mapId] = map.serialize();
        });
        
        return {
            currentMapId: this.currentMap ? this.currentMap.mapId : null,
            maps: mapStates,
        };
    }

    /**
     * 反序列化地图状态（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        if (data.maps) {
            for (const mapId in data.maps) {
                const map = this.maps.get(mapId);
                if (map) {
                    map.deserialize(data.maps[mapId]);
                }
            }
        }
        
        if (data.currentMapId) {
            this.currentMap = this.maps.get(data.currentMapId) || null;
        }
    }
}