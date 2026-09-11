/**
 * 按键输入类
 * 管理键盘和鼠标输入，支持按键过滤
 * 当玩家打开商店、对话框等UI时，可阻止移动键等游戏操作
 */
class InputManager {
    /**
     * @param {HTMLElement} targetElement - 监听输入的目标元素（通常是canvas或document）
     */
    constructor(targetElement = document, canvasElement = null) {
        this.targetElement = targetElement;
        this.canvasElement = canvasElement;
        
        // ========== 键盘状态 ==========
        this.keys = {};           // 当前按下的键 {key: true}
        this.pressedKeys = {};    // 本帧刚按下的键 {key: true}
        this.releasedKeys = {};   // 本帧刚松开的键 {key: true}
        
        // ========== 鼠标状态 ==========
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseClicked = false;      // 本帧是否点击
        this.mousePressed = false;      // 鼠标是否按住
        this.mouseReleased = false;     // 本帧是否松开
        this.mouseButton = -1;          // 鼠标按钮：0=左键，1=中键，2=右键
        
        // ========== 输入过滤 ==========
        this.inputBlocked = false;          // 是否完全阻止游戏输入
        this.movementBlocked = false;       // 是否阻止移动输入
        this.combatBlocked = false;         // 是否阻止战斗输入
        this.interactionBlocked = false;    // 是否阻止交互输入
        this.uiInputEnabled = true;         // UI输入是否启用（用于对话框等）
        
        // ========== 按键映射 ==========
        this.keyMappings = {
            moveUp: ['w', 'arrowup'],
            moveDown: ['s', 'arrowdown'],
            moveLeft: ['a', 'arrowleft'],
            moveRight: ['d', 'arrowright'],
            interact: ['e'],
            attack: ['j', ' '],
            skill1: ['1'],
            skill2: ['2'],
            skill3: ['3'],
            ultimate: ['4'],
            inventory: ['i'],
            quest: ['q'],
            pause: ['escape'],
            confirm: ['enter'],
            cancel: ['backspace'],
            // 注：L 键已改为"闪避"（见 js/PlayerCombat.js），原 L 键小游戏入口已禁用
            dodge: ['l'],
        };
        
        // ========== 回调 ==========
        this.onKeyDown = null;       // 键盘按下回调 (key, event) => void
        this.onKeyUp = null;         // 键盘松开回调 (key, event) => void
        this.onMouseClick = null;    // 鼠标点击回调 (x, y, button) => void
        this.onMouseMove = null;     // 鼠标移动回调 (x, y) => void
        
        // ========== 绑定事件 ==========
        this.boundKeyDownHandler = this.handleKeyDown.bind(this);
        this.boundKeyUpHandler = this.handleKeyUp.bind(this);
        this.boundMouseDownHandler = this.handleMouseDown.bind(this);
        this.boundMouseUpHandler = this.handleMouseUp.bind(this);
        this.boundMouseMoveHandler = this.handleMouseMove.bind(this);
        
        this.attachEventListeners();
    }

    /**
     * 绑定事件监听
     */
    attachEventListeners() {
        this.targetElement.addEventListener('keydown', this.boundKeyDownHandler);
        this.targetElement.addEventListener('keyup', this.boundKeyUpHandler);
        this.targetElement.addEventListener('mousedown', this.boundMouseDownHandler);
        this.targetElement.addEventListener('mouseup', this.boundMouseUpHandler);
        this.targetElement.addEventListener('mousemove', this.boundMouseMoveHandler);
    }

    /**
     * 解绑事件监听
     */
    detachEventListeners() {
        this.targetElement.removeEventListener('keydown', this.boundKeyDownHandler);
        this.targetElement.removeEventListener('keyup', this.boundKeyUpHandler);
        this.targetElement.removeEventListener('mousedown', this.boundMouseDownHandler);
        this.targetElement.removeEventListener('mouseup', this.boundMouseUpHandler);
        this.targetElement.removeEventListener('mousemove', this.boundMouseMoveHandler);
    }

    /**
     * 处理键盘按下
     */
    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        
        // 防止重复触发
        if (event.repeat) {
            event.preventDefault();
            return;
        }
        
        // 记录按键状态
        if (!this.keys[key]) {
            this.pressedKeys[key] = true;
        }
        this.keys[key] = true;
        
        // 触发回调
        if (this.onKeyDown) {
            this.onKeyDown(key, event);
        }
        
        // 阻止默认行为（如方向键滚动页面）
        if (this.isGameKey(key)) {
            event.preventDefault();
        }
    }

    /**
     * 处理键盘松开
     */
    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        
        this.keys[key] = false;
        this.releasedKeys[key] = true;
        
        if (this.onKeyUp) {
            this.onKeyUp(key, event);
        }
        
        if (this.isGameKey(key)) {
            event.preventDefault();
        }
    }

    /**
     * 处理鼠标按下
     */
    handleMouseDown(event) {
        const rect = this.getCanvasRect();
        this.mouseX = event.clientX - rect.left;
        this.mouseY = event.clientY - rect.top;
        this.mousePressed = true;
        this.mouseClicked = true;
        this.mouseButton = event.button;
        
        if (this.onMouseClick) {
            this.onMouseClick(this.mouseX, this.mouseY, event.button);
        }
    }

    /**
     * 处理鼠标松开
     */
    handleMouseUp(event) {
        const rect = this.getCanvasRect();
        this.mouseX = event.clientX - rect.left;
        this.mouseY = event.clientY - rect.top;
        this.mousePressed = false;
        this.mouseReleased = true;
        this.mouseButton = event.button;
    }

    /**
     * 处理鼠标移动
     */
    handleMouseMove(event) {
        const rect = this.getCanvasRect();
        this.mouseX = event.clientX - rect.left;
        this.mouseY = event.clientY - rect.top;
        
        if (this.onMouseMove) {
            this.onMouseMove(this.mouseX, this.mouseY);
        }
    }

    /**
     * 获取Canvas的边界矩形
     */
    getCanvasRect() {
        if (this.canvasElement && this.canvasElement.getBoundingClientRect) {
            return this.canvasElement.getBoundingClientRect();
        }
        
        if (this.targetElement && this.targetElement.getBoundingClientRect) {
            return this.targetElement.getBoundingClientRect();
        }
        
        return { left: 0, top: 0 };
    }

    /**
     * 检查是否是游戏按键（需要阻止默认行为）
     */
    isGameKey(key) {
        const allGameKeys = [
            ...this.keyMappings.moveUp,
            ...this.keyMappings.moveDown,
            ...this.keyMappings.moveLeft,
            ...this.keyMappings.moveRight,
            ...this.keyMappings.interact,
            ...this.keyMappings.attack,
            ...this.keyMappings.skill1,
            ...this.keyMappings.skill2,
            ...this.keyMappings.skill3,
            ...this.keyMappings.ultimate,
        ];
        
        return allGameKeys.includes(key);
    }

    /**
     * 获取当前输入状态（供游戏循环使用）
     * @returns {Object} 输入状态
     */
    getInputState() {
        return {
            keys: this.keys,
            pressedKeys: this.pressedKeys,
            releasedKeys: this.releasedKeys,
            mouseX: this.mouseX,
            mouseY: this.mouseY,
            mouseClicked: this.mouseClicked,
            mousePressed: this.mousePressed,
            mouseReleased: this.mouseReleased,
            mouseButton: this.mouseButton,
            movementBlocked: this.movementBlocked || this.inputBlocked,
            combatBlocked: this.combatBlocked || this.inputBlocked,
            interactionBlocked: this.interactionBlocked || this.inputBlocked,
        };
    }

    /**
     * 检查某个键是否被按下（持续按住）
     * @param {string} key - 键名
     */
    isKeyDown(key) {
        const actualKey = key.toLowerCase();
        return !!this.keys[actualKey];
    }

    /**
     * 检查某个键是否刚被按下（本帧）
     * @param {string} key - 键名
     */
    isKeyPressed(key) {
        const actualKey = key.toLowerCase();
        return !!this.pressedKeys[actualKey];
    }

    /**
     * 检查某个键是否刚被松开（本帧）
     * @param {string} key - 键名
     */
    isKeyReleased(key) {
        const actualKey = key.toLowerCase();
        return !!this.releasedKeys[actualKey];
    }

    /**
     * 检查移动键是否被按下
     */
    isMovementKeyPressed() {
        const moveKeys = [
            ...this.keyMappings.moveUp,
            ...this.keyMappings.moveDown,
            ...this.keyMappings.moveLeft,
            ...this.keyMappings.moveRight,
        ];
        
        return moveKeys.some(key => this.keys[key]);
    }

    /**
     * 检查交互键是否刚被按下
     */
    isInteractKeyPressed() {
        return this.keyMappings.interact.some(key => this.pressedKeys[key]);
    }

    /**
     * 检查攻击键是否刚被按下
     */
    isAttackKeyPressed() {
        return this.keyMappings.attack.some(key => this.pressedKeys[key]);
    }

    /**
     * 检查技能键是否刚被按下
     * @param {number} slotIndex - 技能槽位索引（0-3）
     */
    isSkillKeyPressed(slotIndex) {
        const mappingKey = ['skill1', 'skill2', 'skill3', 'ultimate'][slotIndex];
        if (!mappingKey) return false;
        
        return this.keyMappings[mappingKey].some(key => this.pressedKeys[key]);
    }

    // ==================== 输入过滤 ====================

    /**
     * 设置是否阻止所有游戏输入
     * @param {boolean} blocked - 是否阻止
     */
    setInputBlocked(blocked) {
        this.inputBlocked = blocked;
    }

    /**
     * 设置是否阻止移动输入
     */
    setMovementBlocked(blocked) {
        this.movementBlocked = blocked;
    }

    /**
     * 设置是否阻止战斗输入
     */
    setCombatBlocked(blocked) {
        this.combatBlocked = blocked;
    }

    /**
     * 设置是否阻止交互输入
     */
    setInteractionBlocked(blocked) {
        this.interactionBlocked = blocked;
    }

    /**
     * 清空本帧的瞬时状态（在每帧结束后调用）
     */
    clearFrameState() {
        this.pressedKeys = {};
        this.releasedKeys = {};
        this.mouseClicked = false;
        this.mouseReleased = false;
    }

    /**
     * 序列化输入状态（用于存档）
     */
    serialize() {
        return {
            keyMappings: { ...this.keyMappings },
            inputBlocked: this.inputBlocked,
            movementBlocked: this.movementBlocked,
            combatBlocked: this.combatBlocked,
            interactionBlocked: this.interactionBlocked,
        };
    }

    /**
     * 反序列化输入状态（用于读档）
     */
    deserialize(data) {
        if (!data) return;
        
        if (data.keyMappings) this.keyMappings = data.keyMappings;
        this.inputBlocked = data.inputBlocked || false;
        this.movementBlocked = data.movementBlocked || false;
        this.combatBlocked = data.combatBlocked || false;
        this.interactionBlocked = data.interactionBlocked || false;
    }
}