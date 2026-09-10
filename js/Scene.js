/**
 * 场景基类
 * 所有场景（主菜单、游戏地图、战斗等）都继承此类
 */
class Scene {
    /**
     * @param {string} sceneId - 场景ID
     */
    constructor(sceneId) {
        this.sceneId = sceneId;
        this.isActive = false; // 是否为活动场景
        this.isInitialized = false; // 是否已初始化
    }

    /**
     * 初始化场景
     */
    init() {
        this.isInitialized = true;
    }

    /**
     * 进入场景
     * @param {Object} params - 场景参数
     */
    enter(params = {}) {
        this.isActive = true;
    }

    /**
     * 退出场景
     */
    exit() {
        this.isActive = false;
    }

    /**
     * 更新场景
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        // 子类实现
    }

    /**
     * 渲染场景
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        // 子类实现
    }

    /**
     * 序列化场景状态（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            sceneId: this.sceneId,
            isActive: this.isActive,
            isInitialized: this.isInitialized,
        };
    }

    /**
     * 反序列化场景状态（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.isActive = data.isActive || false;
        this.isInitialized = data.isInitialized || false;
    }
}