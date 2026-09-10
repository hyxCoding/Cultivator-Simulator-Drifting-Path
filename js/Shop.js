/**
 * 商店类
 * 管理商店的打开/关闭、商品浏览、购买和出售逻辑
 * 对话系统中通过 'open_shop' Action 触发打开
 */
class Shop {
    /**
     * @param {Object} config - 商店配置
     * @param {Object} config.main - Main 实例引用
     */
    constructor(config = {}) {
        this.main = config.main || null;

        // ========== 商店状态 ==========
        this.isOpen = false;
        this.currentNPC = null;
        this.mode = 'buy';            // 'buy' | 'sell'

        // ========== 商品列表 ==========
        this.shopItems = [];

        // ========== UI 状态 ==========
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.maxVisibleItems = 6;
        this.messageText = '';
        this.messageTimer = 0;

        // ========== 按钮 ==========
        this.tabButtons = [];
        this.actionButtons = [];
        this.initUI();

        // ========== 回调 ==========
        this.onOpen = null;
        this.onClose = null;
        this.onBuy = null;
        this.onSell = null;
    }

    /**
     * 打开商店
     * @param {NPC} npc - 商店所属 NPC
     * @param {Player} player - 玩家实例
     * @returns {boolean} 是否成功打开
     */
    open(npc, player) {
        if (this.isOpen) return false;
        if (!npc || !player) return false;

        this.currentNPC = npc;
        this.player = player;
        this.isOpen = true;
        this.mode = 'buy';
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.messageText = '';
        this.messageTimer = 0;

        this.loadShopItems(npc);

        if (this.main && this.main.inputManager) {
            this.main.inputManager.setMovementBlocked(true);
        }

        if (this.onOpen) {
            this.onOpen(npc);
        }
        return true;
    }

    /**
     * 关闭商店
     */
    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.currentNPC = null;
        this.shopItems = [];
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.messageText = '';
        this.messageTimer = 0;

        if (this.main && this.main.inputManager) {
            this.main.inputManager.setMovementBlocked(false);
        }

        if (this.onClose) {
            this.onClose();
        }
    }

    /**
     * 从 NPC 加载商品列表
     */
    loadShopItems(npc) {
        this.shopItems = [];
        const gameConfig = GameConfig.getInstance();

        if (npc.shopItems && Array.isArray(npc.shopItems)) {
            npc.shopItems.forEach(item => {
                const itemConfig = gameConfig.getItem(item.itemId);
                if (itemConfig) {
                    this.shopItems.push({
                        itemId: item.itemId,
                        price: item.price || itemConfig.buyPrice || 0,
                        stock: item.stock !== undefined ? item.stock : -1,
                        name: itemConfig.name || item.itemId,
                        description: itemConfig.description || '',
                    });
                }
            });
        }

        if (this.shopItems.length === 0 && gameConfig.getNPCConfig) {
            const npcConfig = gameConfig.getNPCConfig(npc.id);
            if (npcConfig.shopItems && Array.isArray(npcConfig.shopItems)) {
                npcConfig.shopItems.forEach(item => {
                    const itemConfig = gameConfig.getItem(item.itemId);
                    if (itemConfig) {
                        this.shopItems.push({
                            itemId: item.itemId,
                            price: item.price || itemConfig.buyPrice || 0,
                            stock: item.stock !== undefined ? item.stock : -1,
                            name: itemConfig.name || item.itemId,
                            description: itemConfig.description || '',
                        });
                    }
                });
            }
        }
    }

    /**
     * 初始化 UI 按钮
     */
    initUI() {
        this.tabButtons = [
            new UIButton({
                x: 200, y: 108, width: 100, height: 32,
                text: '购买',
                fontSize: 16,
                textColor: '#ffffff',
                callback: () => {
                    this.mode = 'buy';
                    this.selectedIndex = 0;
                    this.scrollOffset = 0;
                    this.messageText = '';
                },
            }),
            new UIButton({
                x: 310, y: 108, width: 100, height: 32,
                text: '出售',
                fontSize: 16,
                textColor: '#ffffff',
                callback: () => {
                    this.mode = 'sell';
                    this.selectedIndex = 0;
                    this.scrollOffset = 0;
                    this.messageText = '';
                },
            }),
        ];

        this.actionButtons = [
            new UIButton({
                x: 620, y: 540, width: 120, height: 36,
                text: '购买',
                fontSize: 16,
                textColor: '#ffffff',
                callback: () => { this.executeAction(); },
            }),
            new UIButton({
                x: 760, y: 540, width: 120, height: 36,
                text: '关闭',
                fontSize: 16,
                textColor: '#ffffff',
                callback: () => { this.close(); },
            }),
        ];
    }

    getCurrentItemList() {
        if (this.mode === 'buy') return this.shopItems;
        return this.getSellableItems();
    }

    getSellableItems() {
        const r = [];
        if (!this.player) return r;
        const gc = GameConfig.getInstance();
        this.player.inventory.getAllItems().forEach((e, k) => {
            const c = gc.getItem(e.itemId);
            if (c && c.sellPrice > 0)
                r.push({ itemId: e.itemId, price: c.sellPrice, stock: e.count, name: c.name || e.itemId, description: c.description || '', inventoryKey: k });
        });
        return r;
    }

    executeAction() {
        if (this.mode === 'buy') this.performBuy();
        else this.performSell();
    }

    performBuy(q = 1) {
        const items = this.shopItems;
        if (this.selectedIndex < 0 || this.selectedIndex >= items.length) { this.showMessage('请选择一个商品'); return; }
        const si = items[this.selectedIndex]; if (!si) return;
        if (si.stock !== -1 && si.stock < q) { this.showMessage('库存不足（剩余' + si.stock + '）'); return; }
        const cost = si.price * q;
        if (!this.player.playerData.spendLingShi(cost)) { this.showMessage('灵石不足！需要' + cost + '灵石'); return; }
        if (!this.player.inventory.addItem(si.itemId, q)) { this.player.playerData.gainLingShi(cost); this.showMessage('背包已满！'); return; }
        if (si.stock !== -1) si.stock -= q;
        this.showMessage('成功购买 ' + si.name + ' x' + q);
    }

    performSell(q = 1) {
        const items = this.getSellableItems();
        if (this.selectedIndex < 0 || this.selectedIndex >= items.length) { this.showMessage('请选择一个物品'); return; }
        const si = items[this.selectedIndex]; if (!si) return;
        if (!this.player.inventory.hasItem(si.itemId, q)) { this.showMessage('数量不足（拥有' + si.stock + '）'); return; }
        const earn = si.price * q;
        if (!this.player.inventory.removeItem(si.itemId, q)) { this.showMessage('出售失败'); return; }
        this.player.playerData.gainLingShi(earn);
        this.showMessage('成功出售 ' + si.name + ' x' + q + '，获得' + earn + '灵石');
    }

    showMessage(t) { this.messageText = t; this.messageTimer = 3.0; }

    update(dt, input) {
        if (!this.isOpen) return;
        if (this.messageTimer > 0) { this.messageTimer -= dt; if (this.messageTimer <= 0) this.messageText = ''; }
        this.tabButtons.forEach(b => b.update(input.mouseX, input.mouseY, input.mousePressed, input.mouseClicked, dt));
        this.actionButtons.forEach(b => b.update(input.mouseX, input.mouseY, input.mousePressed, input.mouseClicked, dt));
        if (input.mouseWheelDelta) { this.scrollOffset -= input.mouseWheelDelta; this.clampScrollOffset(); }
        if (input.mouseClicked && !this.isButtonClicked(input)) this.handleItemSelection(input.mouseX, input.mouseY);
        if (input.pressedKeys) {
            if (input.pressedKeys['w'] || input.pressedKeys['arrowup']) { this.selectedIndex = Math.max(0, this.selectedIndex - 1); this.ensureSelectedVisible(); }
            if (input.pressedKeys['s'] || input.pressedKeys['arrowdown']) { this.selectedIndex = Math.min(this.getCurrentItemList().length - 1, this.selectedIndex + 1); this.ensureSelectedVisible(); }
            if (input.pressedKeys['enter']) this.executeAction();
            if (input.pressedKeys['escape']) this.close();
        }
        if (this.actionButtons.length > 0) this.actionButtons[0].text = this.mode === 'buy' ? '购买' : '出售';
    }

    isButtonClicked(input) { return [...this.tabButtons, ...this.actionButtons].some(b => b.containsPoint(input.mouseX, input.mouseY)); }

    handleItemSelection(mx, my) {
        const list = this.getCurrentItemList();
        for (let i = 0; i < list.length; i++) {
            const iy = 160 + (i - this.scrollOffset) * 52;
            if (mx >= 180 && mx <= 780 && my >= iy && my <= iy + 52) { this.selectedIndex = i; return; }
        }
    }

    ensureSelectedVisible() {
        if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex;
        if (this.selectedIndex >= this.scrollOffset + this.maxVisibleItems) this.scrollOffset = this.selectedIndex - this.maxVisibleItems + 1;
        this.clampScrollOffset();
    }

    clampScrollOffset() {
        const max = Math.max(0, this.getCurrentItemList().length - this.maxVisibleItems);
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, max));
    }

    render(ctx) {
        if (!this.isOpen) return;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const px = 150, py = 80, pw = 660, ph = 520;
        ctx.fillStyle = 'rgba(20,15,35,0.95)'; ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(180,150,80,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(180,150,80,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py+50); ctx.lineTo(px+pw, py+50); ctx.stroke();
        ctx.fillStyle = '#f0d080'; ctx.font = 'bold 22px Microsoft YaHei'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((this.currentNPC?this.currentNPC.name+'的店铺':'商店'), px+pw/2, py+25);
        if (this.player) {
            ctx.fillStyle = '#e0c060'; ctx.font = '16px Microsoft YaHei'; ctx.textAlign = 'right';
            ctx.fillText('灵石: '+this.player.playerData.lingShi, px+pw-20, py+25);
        }
        this.tabButtons.forEach(b => b.render(ctx));
        this.renderItemList(ctx, px, py, pw, ph);
        this.actionButtons.forEach(b => b.render(ctx));
        if (this.messageText && this.messageTimer > 0) this.renderMessage(ctx, px, py, pw);
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '12px Microsoft YaHei'; ctx.textAlign = 'left';
        ctx.fillText('方向键 ↑↓ 选择  Enter 确认  ESC 关闭', px+20, py+ph-15);
        ctx.restore();
    }

    renderItemList(ctx, px, py, pw, ph) {
        const list = this.getCurrentItemList();
        const sx = px+30, sy = py+150, lw = pw-60, ih = 52;
        ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, lw, this.maxVisibleItems*ih); ctx.clip();
        if (list.length === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '16px Microsoft YaHei'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(this.mode==='buy'?'暂无商品在售':'背包中没有可出售的物品', sx+lw/2, sy+ih);
        } else {
            list.forEach((item, i) => {
                const iy = sy + (i-this.scrollOffset)*ih;
                if (iy+ih < sy || iy > sy+this.maxVisibleItems*ih) return;
                const sel = (i === this.selectedIndex);
                if (sel) { ctx.fillStyle = 'rgba(255,215,0,0.2)'; ctx.fillRect(sx, iy, lw, ih-2); ctx.strokeStyle = 'rgba(255,215,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(sx, iy, lw, ih-2); }
                ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, iy+ih-1); ctx.lineTo(sx+lw, iy+ih-1); ctx.stroke();
                ctx.fillStyle = sel?'#ffffff':'#d0d0d0'; ctx.font = '16px Microsoft YaHei'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(item.name, sx+10, iy+ih/2);
                ctx.fillStyle = sel?'#f0d080':'#c0a060'; ctx.font = '14px Microsoft YaHei'; ctx.textAlign = 'right';
                ctx.fillText((this.mode==='buy'?'售价':'出售价')+': '+item.price+' 灵石', sx+lw-20, iy+ih/2-8);
                ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '12px Microsoft YaHei'; ctx.textAlign = 'right';
                if (this.mode==='buy') ctx.fillText(item.stock===-1?'库存: ∞':'库存: '+item.stock, sx+lw-20, iy+ih/2+12);
                else ctx.fillText('持有: '+item.stock, sx+lw-20, iy+ih/2+12);
            });
        }
        ctx.restore();
        if (list.length > this.maxVisibleItems) this.renderScrollbar(ctx, sx+lw+5, sy, this.maxVisibleItems*ih, list.length);
    }

    renderScrollbar(ctx, x, y, h, total) {
        const sw = 6;
        const pct = this.scrollOffset / Math.max(1, total-this.maxVisibleItems);
        const sh = Math.max(20, (this.maxVisibleItems/total)*h);
        const sy = y + pct*(h-sh);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, y, sw, h);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, sy, sw, sh);
    }

    renderMessage(ctx, px, py, pw) {
        ctx.save();
        const mw = 400, mh = 40;
        const mx = px+(pw-mw)/2, my = py+ph-80;
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(mx, my, mw, mh);
        ctx.strokeStyle = 'rgba(255,215,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
        ctx.fillStyle = '#f0d080'; ctx.font = '16px Microsoft YaHei'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.messageText, mx+mw/2, my+mh/2);
        ctx.restore();
    }

    serialize() {
        return {
            isOpen: this.isOpen,
            currentNPCId: this.currentNPC ? this.currentNPC.id : null,
            mode: this.mode, selectedIndex: this.selectedIndex,
            scrollOffset: this.scrollOffset,
            shopItems: this.shopItems.map(i => ({ itemId: i.itemId, price: i.price, stock: i.stock })),
        };
    }

    deserialize(data) {
        if (!data) return;
        this.isOpen = data.isOpen || false;
        this.mode = data.mode || 'buy';
        this.selectedIndex = data.selectedIndex || 0;
        this.scrollOffset = data.scrollOffset || 0;
        if (data.shopItems) this.shopItems = data.shopItems;
    }
}