/**
 * 地图传送类
 * 显示世界地图，在地图上放置区域按钮
 * 支持自定义按钮数量、位置、大小、可否点击、按钮图标
 * 鼠标悬停时按钮图片上移，实现选中提示效果
 *
 * 打开方式（见 js/Main.js）：
 *   - 调试期：M 键开关（Main.handleKeyDown → mapTeleport.toggle()），ESC 也可关闭
 *   - 剧情：第一章码头登船（Main.boardShipAndOpenWorldMap → show()）
 * 地图已删减为前两章，区域按钮只有青岚浮野 / 云渡泽两个（调试期均常开，点击即传送）
 */
class MapTeleport {
    /**
     * @param {Object} config - 地图传送配置
     * @param {Image} config.backgroundImage - 地图背景图
     * @param {Array} config.areaButtons - 区域按钮配置列表
     * @param {Object} config.canvas - 画布尺寸 {width, height}
     */
    constructor(config = {}) {
        // ========== 背景图 ==========
        this.backgroundImage = config.backgroundImage || null;
        
        // ========== 画布尺寸 ==========
        this.canvasWidth = config.canvas?.width || 800;
        this.canvasHeight = config.canvas?.height || 600;
        
        // ========== 状态 ==========
        this.isVisible = false;
        this.isActive = false;
        
        // ========== 区域按钮 ==========
        this.areaButtons = [];
        
        // ========== 回调 ==========
        this.onAreaSelected = null;  // 区域选中回调 (areaId, button) => void
        this.onMapClose = null;      // 地图关闭回调
        
        // ========== 悬停动画 ==========
        this.hoverTransitionSpeed = 8;
        
        // ========== 初始化按钮 ==========
        if (config.areaButtons) {
            this.initAreaButtons(config.areaButtons);
        }
    }

    /**
     * 初始化区域按钮
     * @param {Array} buttonConfigs - 按钮配置列表
     * @param {string} buttonConfigs[].id - 按钮唯一ID
     * @param {number} buttonConfigs[].x - 按钮x坐标（逻辑位置）
     * @param {number} buttonConfigs[].y - 按钮y坐标（逻辑位置）
     * @param {number} buttonConfigs[].width - 按钮宽度
     * @param {number} buttonConfigs[].height - 按钮高度
     * @param {Image} buttonConfigs[].image - 按钮图标
     * @param {Image} buttonConfigs[].hoverImage - 悬停时显示的图片（可选）
     * @param {boolean} buttonConfigs[].enabled - 是否可点击
     * @param {boolean} buttonConfigs[].visible - 是否可见
     * @param {Function} buttonConfigs[].callback - 点击回调
     * @param {Object} buttonConfigs[].hoverOffset - 悬停偏移 {x, y}
     * @param {string} buttonConfigs[].areaName - 区域名称（用于显示提示）
     * @param {string} buttonConfigs[].targetMapId - 目标地图ID
     */
    initAreaButtons(buttonConfigs) {
        this.areaButtons = [];
        
        buttonConfigs.forEach(config => {
            const button = new MapAreaButton({
                ...config,
                hoverTransitionSpeed: this.hoverTransitionSpeed,
            });
            
            // 绑定默认点击逻辑
            const originalCallback = config.callback;
            button.setCallback((btn) => {
                // 执行自定义回调
                if (originalCallback) {
                    originalCallback(btn);
                }
                
                // 触发区域选中回调
                if (this.onAreaSelected && btn.isEnabled) {
                    this.onAreaSelected(btn.id, btn);
                }
            });
            
            this.areaButtons.push(button);
        });
    }

    /**
     * 添加单个区域按钮
     * @param {Object} config - 按钮配置
     */
    addAreaButton(config) {
        const button = new MapAreaButton({
            ...config,
            hoverTransitionSpeed: this.hoverTransitionSpeed,
        });
        
        const originalCallback = config.callback;
        button.setCallback((btn) => {
            if (originalCallback) {
                originalCallback(btn);
            }
            
            if (this.onAreaSelected && btn.isEnabled) {
                this.onAreaSelected(btn.id, btn);
            }
        });
        
        this.areaButtons.push(button);
        
        return button;
    }

    /**
     * 移除区域按钮
     * @param {string} buttonId - 按钮ID
     */
    removeAreaButton(buttonId) {
        const index = this.areaButtons.findIndex(btn => btn.id === buttonId);
        if (index !== -1) {
            this.areaButtons.splice(index, 1);
        }
    }

    /**
     * 获取指定按钮
     * @param {string} buttonId - 按钮ID
     */
    getAreaButton(buttonId) {
        return this.areaButtons.find(btn => btn.id === buttonId) || null;
    }

    /**
     * 设置按钮可用状态
     * @param {string} buttonId - 按钮ID
     * @param {boolean} enabled - 是否可用
     */
    setButtonEnabled(buttonId, enabled) {
        const button = this.getAreaButton(buttonId);
        if (button) {
            button.setEnabled(enabled);
        }
    }

    /**
     * 设置按钮可见状态
     * @param {string} buttonId - 按钮ID
     * @param {boolean} visible - 是否可见
     */
    setButtonVisible(buttonId, visible) {
        const button = this.getAreaButton(buttonId);
        if (button) {
            button.setVisible(visible);
        }
    }

    /**
     * 更新地图传送界面
     * @param {number} deltaTime - 时间增量（秒）
     * @param {Object} input - 输入状态
     */
    update(deltaTime, input) {
        if (!this.isVisible || !this.isActive) return;
        
        if (!input) return;
        
        // 更新所有按钮
        this.areaButtons.forEach(button => {
            button.update(
                input.mouseX,
                input.mouseY,
                input.mousePressed,
                input.mouseClicked,
                deltaTime
            );
        });
    }

    /**
     * 渲染地图传送界面
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    render(ctx) {
        if (!this.isVisible) return;
        
        ctx.save();
        
        // 渲染背景图
        if (this.backgroundImage) {
            ctx.drawImage(
                this.backgroundImage,
                0,
                0,
                this.canvasWidth,
                this.canvasHeight
            );
        } else {
            // 无背景图时渲染默认背景
            this.renderDefaultBackground(ctx);
        }
        
        // 渲染区域按钮
        this.areaButtons.forEach(button => {
            button.render(ctx);
        });
        
        // 渲染关闭提示
        this.renderCloseHint(ctx);
        
        ctx.restore();
    }

    /**
     * 渲染默认背景
     */
    renderDefaultBackground(ctx) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // 网格线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < this.canvasWidth; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvasHeight);
            ctx.stroke();
        }
        for (let y = 0; y < this.canvasHeight; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvasWidth, y);
            ctx.stroke();
        }
    }

    /**
     * 渲染关闭提示
     */
    renderCloseHint(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '14px Microsoft YaHei';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
            '按 M / ESC 关闭地图',
            this.canvasWidth - 20,
            this.canvasHeight - 20
        );
    }

    /**
     * 显示地图传送界面
     */
    show() {
        this.isVisible = true;
        this.isActive = true;
    }

    /**
     * 隐藏地图传送界面
     */
    hide() {
        this.isVisible = false;
        this.isActive = false;
        
        // 重置所有按钮的悬停状态
        this.areaButtons.forEach(button => {
            button.isHovered = false;
            button.isPressed = false;
            button.currentOffsetY = 0;
            button.renderY = button.y;
        });
    }

    /**
     * 切换显示/隐藏
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 从配置加载按钮
     * @param {Object} mapConfig - 地图配置（来自GameConfig）
     */
    loadFromConfig(mapConfig) {
        if (!mapConfig || !mapConfig.buttons) return;
        
        const resourceManager = ResourceManager.getInstance();
        
        const buttonConfigs = mapConfig.buttons.map(btnConfig => ({
            id: btnConfig.id,
            x: btnConfig.x,
            y: btnConfig.y,
            width: btnConfig.width,
            height: btnConfig.height,
            enabled: btnConfig.unlocked !== false,
            targetMapId: btnConfig.targetMap,
            areaName: btnConfig.name || btnConfig.id,
            // 图片资源通过ResourceManager加载
            // image: resourceManager.getCachedImage(`worldMap.${btnConfig.id}`),
        }));
        
        this.initAreaButtons(buttonConfigs);
    }

    /**
     * 序列化地图传送状态（用于存档）
     */
    serialize() {
        return {
            isVisible: this.isVisible,
            isActive: this.isActive,
            buttons: this.areaButtons.map(btn => btn.serialize()),
        };
    }

    /**
     * 反序列化地图传送状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        this.isVisible = data.isVisible || false;
        this.isActive = data.isActive || false;
        
        if (data.buttons) {
            data.buttons.forEach(btnData => {
                const button = this.getAreaButton(btnData.id);
                if (button) {
                    button.deserialize(btnData);
                }
            });
        }
    }
}