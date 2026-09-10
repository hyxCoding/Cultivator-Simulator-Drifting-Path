/**
 * 主游戏循环类（完整修正版）
 * 使用requestAnimationFrame实现固定时间步长的游戏循环
 * 直接管理所有游戏实体的更新和渲染顺序
 */
class GameLoop {
    /**
     * @param {Object} options - 游戏循环配置
     * @param {number} options.fps - 目标帧率，默认60
     * @param {HTMLCanvasElement} options.canvas - 游戏画布
     */
    constructor(options = {}) {
        this.fps = options.fps || 60;
        this.canvas = options.canvas || null;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // 实体引用
        this.player = null;           // 玩家实例
        this.currentMap = null;       // 当前地图实例
        this.camera = null;           // 摄像机实例
        this.inputManager = null;     // 输入管理器实例
        this.uiManager = null;        // UI管理器实例（可选）
        this.sceneManager = null;     // 场景管理器实例（可选）
        
        // 额外更新和渲染回调（用于扩展）
        this.extraUpdateCallbacks = [];
        this.extraRenderCallbacks = [];
        
        // 时间步长相关
        this.fixedDeltaTime = 1 / this.fps; // 固定时间步长（秒）
        this.maxDeltaTime = 0.1;            // 最大时间步长，防止卡顿时跳跃过大
        this.accumulator = 0;               // 时间累加器
        this.lastTime = 0;                  // 上一帧时间
        
        // 状态
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        
        // 统计信息
        this.fpsCounter = 0;
        this.fpsTimer = 0;
        this.currentFps = 0;
        this.updateCount = 0;  // 总更新次数
        this.frameCount = 0;   // 总渲染帧数
        
        // 调试信息
        this.debugMode = false;
        this.debugInfo = {};
        
        // 绑定循环函数
        this.loop = this.loop.bind(this);
    }

    /**
     * 启动游戏循环
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    /**
     * 停止游戏循环
     */
    stop() {
        this.isRunning = false;
        this.isPaused = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * 暂停游戏循环
     */
    pause() {
        if (!this.isRunning) return;
        
        this.isPaused = true;
    }

    /**
     * 恢复游戏循环
     */
    resume() {
        if (!this.isRunning) return;
        
        this.isPaused = false;
        this.lastTime = performance.now();
        this.accumulator = 0;
    }

    /**
     * 切换暂停状态
     */
    togglePause() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    /**
     * 主循环函数
     * @param {number} currentTime - 当前时间戳（毫秒）
     */
    loop(currentTime) {
        if (!this.isRunning) return;
        
        // 请求下一帧
        this.animationFrameId = requestAnimationFrame(this.loop);
        
        // 计算时间差
        let deltaTime = (currentTime - this.lastTime) / 1000; // 转换为秒
        this.lastTime = currentTime;
        
        // 如果暂停，跳过更新但仍渲染（保持画面）
        if (this.isPaused) {
            this.render(0);
            this.updateFpsCounter(deltaTime);
            return;
        }
        
        // 限制最大时间步长
        if (deltaTime > this.maxDeltaTime) {
            deltaTime = this.maxDeltaTime;
        }
        
        // 累加时间
        this.accumulator += deltaTime;
        
        // 固定时间步长更新
        let updateCount = 0;
        const maxUpdates = 5; // 防止死亡螺旋
        
        while (this.accumulator >= this.fixedDeltaTime && updateCount < maxUpdates) {
            // 执行固定步长更新
            this.update(this.fixedDeltaTime);
            
            this.accumulator -= this.fixedDeltaTime;
            updateCount++;
            this.updateCount++;
        }
        
        // 如果更新次数达到上限，丢弃剩余时间
        if (updateCount >= maxUpdates) {
            this.accumulator = 0;
        }
        
        // 计算插值因子（用于平滑渲染）
        const interpolation = this.accumulator / this.fixedDeltaTime;
        
        // 执行渲染
        this.render(interpolation);
        this.frameCount++;
        
        // 更新FPS统计
        this.updateFpsCounter(deltaTime);
    }

    /**
     * 主更新逻辑
     * 按固定顺序更新所有游戏实体
     * @param {number} deltaTime - 时间增量（秒）
     */
    update(deltaTime) {
        // 获取输入状态
        const input = this.inputManager ? this.inputManager.getInputState() : {};
        
        // 1. 更新场景管理器（处理场景切换等）
        if (this.sceneManager && this.sceneManager.update) {
            this.sceneManager.update(deltaTime, input);
        }
        
        // 2. 更新玩家
        if (this.player && this.player.update) {
            this.player.update(deltaTime, input, this.currentMap);
        }
        
        // 3. 更新NPC
        if (this.currentMap && this.currentMap.npcs) {
            this.currentMap.npcs.forEach(npc => {
                if (npc.update) {
                    npc.update(deltaTime, this.currentMap);
                }
            });
        }
        
        // 4. 更新普通怪物
        if (this.currentMap && this.currentMap.monsters) {
            this.currentMap.monsters.forEach(monster => {
                if (monster.update) {
                    monster.update(deltaTime, this.currentMap);
                }
            });
        }
        
        // 5. 更新地图场景动画（落叶、飘动等环境效果）
        if (this.currentMap && this.currentMap.updateSceneAnimations) {
            this.currentMap.updateSceneAnimations(deltaTime);
        }
        
        // 6. 更新摄像机
        if (this.camera && this.camera.update) {
            this.camera.update(deltaTime);
        }
        
        // 7. 更新UI管理器
        if (this.uiManager && this.uiManager.update) {
            this.uiManager.update(deltaTime);
        }
        
        // 8. 执行额外更新回调
        this.extraUpdateCallbacks.forEach(callback => {
            callback(deltaTime, input);
        });
        
        // 更新调试信息
        if (this.debugMode) {
            this.updateDebugInfo(deltaTime);
        }
    }

    /**
     * 主渲染逻辑
     * 按从下到上的顺序渲染
     * @param {number} interpolation - 插值因子（0-1）
     */
    render(interpolation) {
        if (!this.ctx) {
            console.warn('Canvas context not set');
            return;
        }
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. 渲染地图背景和场景动画
        if (this.currentMap && this.currentMap.render) {
            this.currentMap.render(this.ctx, this.camera);
        }
        
        // 2. 渲染NPC
        if (this.currentMap && this.currentMap.npcs) {
            this.currentMap.npcs.forEach(npc => {
                if (npc.render) {
                    npc.render(this.ctx, this.camera);
                }
            });
        }
        
        // 3. 渲染怪物
        if (this.currentMap && this.currentMap.monsters) {
            this.currentMap.monsters.forEach(monster => {
                if (monster.render) {
                    monster.render(this.ctx, this.camera);
                }
            });
        }

        // 4. 渲染传送法阵
        if (this.currentMap && this.currentMap.teleporters) {
            this.currentMap.teleporters.forEach(teleport => {
                if (teleport && teleport.render) {
                    teleport.render(this.ctx, this.camera);
                }
            });
        }
        
        // 5. 渲染玩家（最上层）
        if (this.player && this.player.render) {
            this.player.render(this.ctx, this.camera);
        }
        
        // 6. 渲染UI（最上层）
        if (this.uiManager && this.uiManager.render) {
            this.uiManager.render(this.ctx);
        }
        
        // 6. 执行额外渲染回调
        this.extraRenderCallbacks.forEach(callback => {
            callback(this.ctx, interpolation);
        });
        
        // 渲染调试信息
        if (this.debugMode) {
            this.renderDebugInfo(this.ctx);
        }
    }

    /**
     * 更新FPS统计
     * @param {number} deltaTime - 时间增量（秒）
     */
    updateFpsCounter(deltaTime) {
        this.fpsCounter++;
        this.fpsTimer += deltaTime;
        
        if (this.fpsTimer >= 1) {
            this.currentFps = this.fpsCounter;
            this.fpsCounter = 0;
            this.fpsTimer = 0;
            
            // 触发FPS更新回调
            if (this.onFpsUpdate) {
                this.onFpsUpdate(this.currentFps);
            }
        }
    }

    /**
     * 更新调试信息
     * @param {number} deltaTime - 时间增量（秒）
     */
    updateDebugInfo(deltaTime) {
        this.debugInfo = {
            fps: this.currentFps,
            deltaTime: deltaTime.toFixed(4),
            updateCount: this.updateCount,
            frameCount: this.frameCount,
            playerPosition: this.player ? {
                x: Math.round(this.player.position.x),
                y: Math.round(this.player.position.y),
            } : null,
            cameraPosition: this.camera ? {
                x: Math.round(this.camera.x),
                y: Math.round(this.camera.y),
            } : null,
            npcCount: this.currentMap ? this.currentMap.npcs.size : 0,
            monsterCount: this.currentMap ? this.currentMap.monsters.size : 0,
        };
    }

    /**
     * 渲染调试信息
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    renderDebugInfo(ctx) {
        if (!this.debugInfo || Object.keys(this.debugInfo).length === 0) return;
        
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 250, 150);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        
        let y = 30;
        const lineHeight = 18;
        
        const infoLines = [
            `FPS: ${this.debugInfo.fps}`,
            `Delta: ${this.debugInfo.deltaTime}s`,
            `Updates: ${this.debugInfo.updateCount}`,
            `Frames: ${this.debugInfo.frameCount}`,
            `NPCs: ${this.debugInfo.npcCount}`,
            `Monsters: ${this.debugInfo.monsterCount}`,
        ];
        
        if (this.debugInfo.playerPosition) {
            infoLines.push(`Player: (${this.debugInfo.playerPosition.x}, ${this.debugInfo.playerPosition.y})`);
        }
        
        if (this.debugInfo.cameraPosition) {
            infoLines.push(`Camera: (${this.debugInfo.cameraPosition.x}, ${this.debugInfo.cameraPosition.y})`);
        }
        
        infoLines.forEach(line => {
            ctx.fillText(line, 20, y);
            y += lineHeight;
        });
        
        ctx.restore();
    }

    /**
     * 设置玩家实例
     * @param {Object} player - 玩家实例
     */
    setPlayer(player) {
        this.player = player;
    }

    /**
     * 设置当前地图实例
     * @param {Object} map - 地图实例
     */
    setCurrentMap(map) {
        this.currentMap = map;
    }

    /**
     * 设置摄像机实例
     * @param {Object} camera - 摄像机实例
     */
    setCamera(camera) {
        this.camera = camera;
    }

    /**
     * 设置输入管理器
     * @param {Object} inputManager - 输入管理器实例
     */
    setInputManager(inputManager) {
        this.inputManager = inputManager;
    }

    /**
     * 设置UI管理器
     * @param {Object} uiManager - UI管理器实例
     */
    setUiManager(uiManager) {
        this.uiManager = uiManager;
    }

    /**
     * 设置场景管理器
     * @param {Object} sceneManager - 场景管理器实例
     */
    setSceneManager(sceneManager) {
        this.sceneManager = sceneManager;
    }

    /**
     * 添加额外更新回调
     * @param {Function} callback - 回调函数 (deltaTime, input) => void
     */
    addUpdateCallback(callback) {
        if (typeof callback === 'function') {
            this.extraUpdateCallbacks.push(callback);
        }
    }

    /**
     * 移除额外更新回调
     * @param {Function} callback - 要移除的回调函数
     */
    removeUpdateCallback(callback) {
        const index = this.extraUpdateCallbacks.indexOf(callback);
        if (index !== -1) {
            this.extraUpdateCallbacks.splice(index, 1);
        }
    }

    /**
     * 添加额外渲染回调
     * @param {Function} callback - 回调函数 (ctx, interpolation) => void
     */
    addRenderCallback(callback) {
        if (typeof callback === 'function') {
            this.extraRenderCallbacks.push(callback);
        }
    }

    /**
     * 移除额外渲染回调
     * @param {Function} callback - 要移除的回调函数
     */
    removeRenderCallback(callback) {
        const index = this.extraRenderCallbacks.indexOf(callback);
        if (index !== -1) {
            this.extraRenderCallbacks.splice(index, 1);
        }
    }

    /**
     * 启用/禁用调试模式
     * @param {boolean} enabled - 是否启用
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * 获取当前FPS
     * @returns {number} 当前FPS
     */
    getCurrentFps() {
        return this.currentFps;
    }

    /**
     * 获取是否正在运行
     * @returns {boolean} 是否正在运行
     */
    getIsRunning() {
        return this.isRunning;
    }

    /**
     * 获取是否已暂停
     * @returns {boolean} 是否已暂停
     */
    getIsPaused() {
        return this.isPaused;
    }

    /**
     * 设置目标帧率
     * @param {number} fps - 目标帧率
     */
    setFps(fps) {
        this.fps = fps;
        this.fixedDeltaTime = 1 / fps;
    }

    /**
     * 设置最大时间步长
     * @param {number} maxDeltaTime - 最大时间步长（秒）
     */
    setMaxDeltaTime(maxDeltaTime) {
        this.maxDeltaTime = maxDeltaTime;
    }

    /**
     * 序列化游戏循环状态（用于存档）
     * @returns {Object} 序列化数据
     */
    serialize() {
        return {
            fps: this.fps,
            updateCount: this.updateCount,
            frameCount: this.frameCount,
            currentFps: this.currentFps,
            isPaused: this.isPaused,
        };
    }

    /**
     * 反序列化游戏循环状态（用于读档）
     * @param {Object} data - 序列化数据
     */
    deserialize(data) {
        if (!data) return;
        
        this.fps = data.fps || this.fps;
        this.fixedDeltaTime = 1 / this.fps;
        this.updateCount = data.updateCount || 0;
        this.frameCount = data.frameCount || 0;
        this.currentFps = data.currentFps || 0;
        this.isPaused = data.isPaused || false;
    }
}