/**
 * 场景管理器类
 * 管理所有场景的注册、切换、更新和渲染
 */
class SceneManager {
    constructor() {
        this.scenes = new Map(); // 场景集合 {sceneId: Scene}
        this.currentScene = null; // 当前活动场景
        this.currentSceneId = null; // 当前场景ID
        this.nextSceneId = null; // 待切换的场景ID
        this.switchParams = null; // 切换参数
    }

    /**
     * 注册场景
     * @param {string} sceneId - 场景ID
     * @param {Scene} scene - 场景实例
     */
    registerScene(sceneId, scene) {
        this.scenes.set(sceneId, scene);
    }

    /**
     * 批量注册场景
     * @param {Object} scenes - 场景配置对象 {sceneId: Scene}
     */
    registerScenes(scenes) {
        for (const sceneId in scenes) {
            this.registerScene(sceneId, scenes[sceneId]);
        }
    }

    /**
     * 切换场景
     * @param {string} sceneId - 目标场景ID
     * @param {Object} params - 切换参数
     */
    switchScene(sceneId, params = {}) {
        this.nextSceneId = sceneId;
        this.switchParams = params;
    }

    /**
     * 执行场景切换
     */
    performSceneSwitch() {
        if (!this.nextSceneId) return;
        
        // 退出当前场景
        if (this.currentScene) {
            this.currentScene.exit();
        }
        
        // 获取目标场景
        const targetScene = this.scenes.get(this.nextSceneId);
        if (!targetScene) {
            console.error(`场景不存在: ${this.nextSceneId}`);
            this.nextSceneId = null;
            return;
        }
        
        // 初始化目标场景（如果未初始化）
        if (!targetScene.isInitialized) {
            targetScene.init();
        }
        
        // 进入目标场景
        targetScene.enter(this.switchParams);
        
        // 更新当前场景
        this.currentScene = targetScene;
        this.currentSceneId = this.nextSceneId;
        
        // 清空切换状态
        this.nextSceneId = null;
        this.switchParams = null;
    }

    /**
     * 获取当前场景
     * @returns {Scene|null} 当前场景实例
     */
    getCurrentScene() {
        return this.currentScene;
    }

    /**
     * 获取指定场景
     * @param {string} sceneId - 场景ID
     * @returns {Scene|null} 场景实例
     */
    getScene(sceneId) {
        return this.scenes.get(sceneId) || null;
    }

    /**
     * 更新当前场景
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        // 检查是否有待切换的场景
        if (this.nextSceneId) {
            this.performSceneSwitch();
        }
        
        // 更新当前场景
        if (this.currentScene) {
            this.currentScene.update(deltaTime, input);
        }
    }

    /**
     * 渲染当前场景
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (this.currentScene) {
            this.currentScene.render(ctx);
        }
    }

    /**
     * 序列化场景管理器状态（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        const sceneStates = {};
        this.scenes.forEach((scene, sceneId) => {
            sceneStates[sceneId] = scene.serialize();
        });
        
        return {
            currentSceneId: this.currentSceneId,
            scenes: sceneStates,
        };
    }

    /**
     * 反序列化场景管理器状态（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        if (data.scenes) {
            for (const sceneId in data.scenes) {
                const scene = this.scenes.get(sceneId);
                if (scene) {
                    scene.deserialize(data.scenes[sceneId]);
                }
            }
        }
        
        if (data.currentSceneId) {
            this.currentScene = this.scenes.get(data.currentSceneId) || null;
            this.currentSceneId = data.currentSceneId;
        }
    }
}