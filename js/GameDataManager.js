/**
 * 全局游戏数据管理器
 * 整合所有游戏系统的引用，统一管理
 * 提供给 SaveManager 使用
 */
class GameDataManager {
    constructor() {
        // ========== 核心系统 ==========
        this.gameLoop = null;
        this.sceneManager = null;
        this.mapManager = null;
        this.camera = null;
        this.inputManager = null;
        
        // ========== UI系统 ==========
        this.mapTeleport = null;
        this.questUI = null;
        this.dialogBox = null;
        this.uiManager = null;
        
        // ========== 游戏系统 ==========
        this.battleSystem = null;
        this.miniGameManager = null;
        this.shop = null;   // 商店系统
        
        // ========== 实体引用 ==========
        this.player = null;
        this.currentMap = null;
        
        // ========== 存档管理器 ==========
        this.saveManager = null;
    }

    /**
     * 初始化所有系统
     * @param {Object} config - 系统配置
     */
    init(config = {}) {
        // 创建核心系统
        this.gameLoop = config.gameLoop || new GameLoop({ fps: 60 });
        this.sceneManager = config.sceneManager || new SceneManager();
        this.mapManager = config.mapManager || new MapManager();
        this.camera = config.camera || new Camera({ width: 800, height: 600 });
        this.inputManager = config.inputManager || new InputManager();
        
        // 创建UI系统
        this.mapTeleport = config.mapTeleport || new MapTeleport();
        this.questUI = config.questUI || new QuestUI();
        this.dialogBox = config.dialogBox || new DialogBox();
        
        // 创建游戏系统
        this.battleSystem = config.battleSystem || new BattleSystem();
        this.miniGameManager = config.miniGameManager || new MiniGameManager();
        this.shop = config.shop || null;
        
        // 创建存档管理器
        this.saveManager = new SaveManager();
        
        // 注册系统到存档管理器
        this.saveManager.registerSystems({
            gameLoop: this.gameLoop,
            sceneManager: this.sceneManager,
            mapManager: this.mapManager,
            camera: this.camera,
            inputManager: this.inputManager,
            mapTeleport: this.mapTeleport,
            questUI: this.questUI,
            dialogBox: this.dialogBox,
            battleSystem: this.battleSystem,
            miniGameManager: this.miniGameManager,
        });
    }

    /**
     * 设置玩家引用
     * @param {Player} player - 玩家实例
     */
    setPlayer(player) {
        this.player = player;
        this.gameLoop.setPlayer(player);
    }

    /**
     * 设置当前地图
     * @param {GameMap} map - 地图实例
     */
    setCurrentMap(map) {
        this.currentMap = map;
        this.gameLoop.setCurrentMap(map);
    }

    /**
     * 保存游戏
     */
    save() {
        if (this.saveManager) {
            return this.saveManager.save();
        }
        return false;
    }

    /**
     * 读取游戏
     */
    load() {
        if (this.saveManager) {
            return this.saveManager.load();
        }
        return null;
    }

    /**
     * 序列化所有数据
     * @returns {Object} 完整游戏数据
     */
    serialize() {
        if (this.saveManager) {
            return this.saveManager.collectSaveData();
        }
        return null;
    }

    /**
     * 反序列化数据
     * @param {Object} data - 游戏数据
     */
    deserialize(data) {
        if (this.saveManager) {
            this.saveManager.applySaveData(data);
        }
    }
}