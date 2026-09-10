/**
 * 数据存档管理器
 * 统一管理所有游戏数据的序列化和反序列化
 * 使用 localStorage 进行持久化存储
 * 当前阶段实现完整的存档接口，便于后续接入存档功能
 */
class SaveManager {
    /**
     * @param {Object} config - 存档配置
     * @param {string} config.storageKey - localStorage存储键名
     * @param {boolean} config.autoSave - 是否自动保存
     * @param {number} config.autoSaveInterval - 自动保存间隔（秒）
     */
    constructor(config = {}) {
        this.storageKey = config.storageKey || 'xiuxian_save_data';
        this.autoSave = config.autoSave || false;
        this.autoSaveInterval = config.autoSaveInterval || 60; // 默认60秒自动保存
        this.autoSaveTimer = 0;
        
        // 存档版本
        this.saveVersion = '0.1.0';
        
        // 引用所有需要存档的系统
        this.gameLoop = null;
        this.sceneManager = null;
        this.mapManager = null;
        this.camera = null;
        this.inputManager = null;
        this.mapTeleport = null;
        this.miniGameManager = null;
        this.battleSystem = null;
        this.questUI = null;
        this.dialogBox = null;
        
        // 回调
        this.onSaveSuccess = null;  // 保存成功回调 (saveData) => void
        this.onSaveError = null;    // 保存失败回调 (error) => void
        this.onLoadSuccess = null;  // 读取成功回调 (saveData) => void
        this.onLoadError = null;    // 读取失败回调 (error) => void
        
        // 存档元数据
        this.lastSaveTime = null;
        this.saveCount = 0;
    }

    /**
     * 注册需要存档的系统实例
     * @param {Object} systems - 系统实例对象
     */
    registerSystems(systems = {}) {
        if (systems.gameLoop) this.gameLoop = systems.gameLoop;
        if (systems.sceneManager) this.sceneManager = systems.sceneManager;
        if (systems.mapManager) this.mapManager = systems.mapManager;
        if (systems.camera) this.camera = systems.camera;
        if (systems.inputManager) this.inputManager = systems.inputManager;
        if (systems.mapTeleport) this.mapTeleport = systems.mapTeleport;
        if (systems.miniGameManager) this.miniGameManager = systems.miniGameManager;
        if (systems.battleSystem) this.battleSystem = systems.battleSystem;
        if (systems.questUI) this.questUI = systems.questUI;
        if (systems.dialogBox) this.dialogBox = systems.dialogBox;
    }

    /**
     * 收集所有游戏数据
     * @returns {Object} 完整的游戏数据
     */
    collectSaveData() {
        const saveData = {
            // ========== 存档元数据 ==========
            meta: {
                version: this.saveVersion,
                saveTime: Date.now(),
                saveTimeFormatted: new Date().toLocaleString(),
                saveCount: this.saveCount + 1,
            },
            
            // ========== 游戏循环状态 ==========
            gameLoop: this.gameLoop ? this.gameLoop.serialize() : null,
            
            // ========== 场景管理器状态 ==========
            sceneManager: this.sceneManager ? this.sceneManager.serialize() : null,
            
            // ========== 地图管理器状态 ==========
            mapManager: this.mapManager ? this.mapManager.serialize() : null,
            
            // ========== 摄像机状态 ==========
            camera: this.camera ? this.camera.serialize() : null,
            
            // ========== 输入管理器状态 ==========
            inputManager: this.inputManager ? this.inputManager.serialize() : null,
            
            // ========== 地图传送状态 ==========
            mapTeleport: this.mapTeleport ? this.mapTeleport.serialize() : null,
            
            // ========== 小游戏管理器状态 ==========
            miniGameManager: this.miniGameManager ? this.miniGameManager.serialize() : null,
            
            // ========== 战斗系统状态 ==========
            battleSystem: this.battleSystem ? this.battleSystem.serialize() : null,
            
            // ========== 任务UI状态 ==========
            questUI: this.questUI ? this.questUI.serialize() : null,
            
            // ========== 对话框状态 ==========
            dialogBox: this.dialogBox ? this.dialogBox.serialize() : null,
        };
        
        return saveData;
    }

    /**
     * 应用存档数据到各系统
     * @param {Object} saveData - 存档数据
     */
    applySaveData(saveData) {
        if (!saveData) return false;
        
        // 应用游戏循环状态
        if (saveData.gameLoop && this.gameLoop) {
            this.gameLoop.deserialize(saveData.gameLoop);
        }
        
        // 应用场景管理器状态
        if (saveData.sceneManager && this.sceneManager) {
            this.sceneManager.deserialize(saveData.sceneManager);
        }
        
        // 应用地图管理器状态
        if (saveData.mapManager && this.mapManager) {
            this.mapManager.deserialize(saveData.mapManager);
        }
        
        // 应用摄像机状态
        if (saveData.camera && this.camera) {
            this.camera.deserialize(saveData.camera);
        }
        
        // 应用输入管理器状态
        if (saveData.inputManager && this.inputManager) {
            this.inputManager.deserialize(saveData.inputManager);
        }
        
        // 应用地图传送状态
        if (saveData.mapTeleport && this.mapTeleport) {
            this.mapTeleport.deserialize(saveData.mapTeleport);
        }
        
        // 应用小游戏管理器状态
        if (saveData.miniGameManager && this.miniGameManager) {
            this.miniGameManager.deserialize(saveData.miniGameManager);
        }
        
        // 应用战斗系统状态
        if (saveData.battleSystem && this.battleSystem) {
            this.battleSystem.deserialize(saveData.battleSystem);
        }
        
        // 应用任务UI状态
        if (saveData.questUI && this.questUI) {
            this.questUI.deserialize(saveData.questUI);
        }
        
        // 应用对话框状态
        if (saveData.dialogBox && this.dialogBox) {
            this.dialogBox.deserialize(saveData.dialogBox);
        }
        
        return true;
    }

    /**
     * 保存游戏
     * @returns {boolean} 是否保存成功
     */
    save() {
        try {
            const saveData = this.collectSaveData();
            
            // 序列化为JSON字符串
            const jsonString = JSON.stringify(saveData);
            
            // 存储到localStorage
            localStorage.setItem(this.storageKey, jsonString);
            
            // 更新元数据
            this.lastSaveTime = Date.now();
            this.saveCount++;
            
            if (this.onSaveSuccess) {
                this.onSaveSuccess(saveData);
            }
            
            console.log(`[存档] 保存成功 (第${this.saveCount}次) - ${saveData.meta.saveTimeFormatted}`);
            
            return true;
        } catch (error) {
            console.error('[存档] 保存失败:', error);
            
            if (this.onSaveError) {
                this.onSaveError(error);
            }
            
            return false;
        }
    }

    /**
     * 读取游戏
     * @returns {Object|null} 存档数据，无存档时返回null
     */
    load() {
        try {
            const jsonString = localStorage.getItem(this.storageKey);
            
            if (!jsonString) {
                console.log('[存档] 无存档数据');
                return null;
            }
            
            const saveData = JSON.parse(jsonString);
            
            // 版本检查
            if (saveData.meta && saveData.meta.version !== this.saveVersion) {
                console.warn(`[存档] 版本不匹配: 存档版本 ${saveData.meta.version}, 当前版本 ${this.saveVersion}`);
                // 尝试兼容性处理
            }
            
            // 应用存档数据
            this.applySaveData(saveData);
            
            this.lastSaveTime = saveData.meta ? saveData.meta.saveTime : null;
            this.saveCount = saveData.meta ? saveData.meta.saveCount : 0;
            
            if (this.onLoadSuccess) {
                this.onLoadSuccess(saveData);
            }
            
            console.log(`[存档] 读取成功 - ${saveData.meta ? saveData.meta.saveTimeFormatted : '未知时间'}`);
            
            return saveData;
        } catch (error) {
            console.error('[存档] 读取失败:', error);
            
            if (this.onLoadError) {
                this.onLoadError(error);
            }
            
            return null;
        }
    }

    /**
     * 检查是否存在存档
     * @returns {boolean} 是否存在存档
     */
    hasSave() {
        try {
            return localStorage.getItem(this.storageKey) !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * 删除存档
     * @returns {boolean} 是否删除成功
     */
    deleteSave() {
        try {
            localStorage.removeItem(this.storageKey);
            this.lastSaveTime = null;
            this.saveCount = 0;
            console.log('[存档] 存档已删除');
            return true;
        } catch (error) {
            console.error('[存档] 删除失败:', error);
            return false;
        }
    }

    /**
     * 获取存档信息
     * @returns {Object|null} 存档信息
     */
    getSaveInfo() {
        try {
            const jsonString = localStorage.getItem(this.storageKey);
            
            if (!jsonString) {
                return null;
            }
            
            const saveData = JSON.parse(jsonString);
            
            return {
                version: saveData.meta ? saveData.meta.version : null,
                saveTime: saveData.meta ? saveData.meta.saveTime : null,
                saveTimeFormatted: saveData.meta ? saveData.meta.saveTimeFormatted : null,
                saveCount: saveData.meta ? saveData.meta.saveCount : 0,
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * 更新自动保存
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        if (!this.autoSave) return;
        
        this.autoSaveTimer += deltaTime;
        
        if (this.autoSaveTimer >= this.autoSaveInterval) {
            this.autoSaveTimer = 0;
            this.save();
        }
    }

    /**
     * 启用自动保存
     * @param {number} interval - 自动保存间隔（秒）
     */
    enableAutoSave(interval = 60) {
        this.autoSave = true;
        this.autoSaveInterval = interval;
        this.autoSaveTimer = 0;
    }

    /**
     * 禁用自动保存
     */
    disableAutoSave() {
        this.autoSave = false;
    }

    /**
     * 导出存档为JSON字符串
     * @returns {string} JSON字符串
     */
    exportSave() {
        const saveData = this.collectSaveData();
        return JSON.stringify(saveData, null, 2);
    }

    /**
     * 导入存档
     * @param {string} jsonString - JSON字符串
     * @returns {boolean} 是否导入成功
     */
    importSave(jsonString) {
        try {
            const saveData = JSON.parse(jsonString);
            
            this.applySaveData(saveData);
            
            this.lastSaveTime = saveData.meta ? saveData.meta.saveTime : Date.now();
            this.saveCount = saveData.meta ? saveData.meta.saveCount : this.saveCount + 1;
            
            // 保存到localStorage
            localStorage.setItem(this.storageKey, jsonString);
            
            console.log('[存档] 导入成功');
            
            return true;
        } catch (error) {
            console.error('[存档] 导入失败:', error);
            return false;
        }
    }
}