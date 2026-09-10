/**
 * 资源管理类（单例）
 * 统一管理游戏中所有图片、音频资源的路径和加载状态
 * 所有外部加载资源时，必须通过此类访问资源路径
 */
class ResourceManager {
    /**
     * 获取资源管理器的单例实例
     */
    static getInstance() {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager();
        }
        return ResourceManager.instance;
    }

    constructor() {
        if (ResourceManager.instance) {
            return ResourceManager.instance;
        }
        ResourceManager.instance = this;
        
        // 资源路径配置表
        this.resources = {
            images: {
                // === UI相关 ===
                ui: {
                    button_normal: 'assets/images/ui/button_normal.png',
                    button_hover: 'assets/images/ui/button_hover.png',
                    button_pressed: 'assets/images/ui/button_pressed.png',
                    dialog_box: 'assets/images/ui/dialog_box.png',
                    task_panel: 'assets/images/ui/task_panel.png',
                    skill_panel: 'assets/images/ui/skill_panel.png',
                    inventory_panel: 'assets/images/ui/inventory_panel.png',
                    health_bar_bg: 'assets/images/ui/health_bar_bg.png',
                    health_bar_fill: 'assets/images/ui/health_bar_fill.png',
                    mana_bar_bg: 'assets/images/ui/mana_bar_bg.png',
                    mana_bar_fill: 'assets/images/ui/mana_bar_fill.png',
                },
                
                // === 地图传送界面 ===
                worldMap: {
                    background: 'assets/images/worldmap/world_map_bg.png',
                    // 四个区域的按钮图片
                    button_qinglan: 'assets/images/worldmap/btn_qinglan.png',
                    button_yunduze: 'assets/images/worldmap/btn_yunduze.png',
                    button_zhaochen: 'assets/images/worldmap/btn_zhaochen.png',
                    button_wuxiang: 'assets/images/worldmap/btn_wuxiang.png',
                    button_tianxin: 'assets/images/worldmap/btn_tianxin.png',
                },
                
                // === 地图瓦片 ===
                tiles: {
                    // 青岚浮野
                    qinglan_grass: 'assets/images/tiles/qinglan/grass.png',
                    qinglan_road: 'assets/images/tiles/qinglan/road.png',
                    qinglan_water: 'assets/images/tiles/qinglan/water.png',
                    qinglan_rock: 'assets/images/tiles/qinglan/rock.png',
                    // 云渡泽
                    yunduze_water: 'assets/images/tiles/yunduze/water.png',
                    yunduze_boat: 'assets/images/tiles/yunduze/boat.png',
                    // 后续地图瓦片可继续添加...
                },

                // 在 resources.images 中添加以下内容
                mapBackgrounds: {
                    qinglan_fuye: 'assets/images/maps/qinglan_fuye/bg.png',
                    yunduze: 'assets/images/maps/yunduze/bg.png',
                    zhaochen_xiancheng: 'assets/images/maps/zhaochen_xiancheng/bg.png',
                    wuxiang_tianque: 'assets/images/maps/wuxiang_tianque/bg.png',
                    boss_arena: 'assets/images/maps/boss_arena/bg.png',
                },

                mapCollisions: {
                    qinglan_fuye: 'assets/images/maps/qinglan_fuye/collision.png',
                    yunduze: 'assets/images/maps/yunduze/collision.png',
                    zhaochen_xiancheng: 'assets/images/maps/zhaochen_xiancheng/collision.png',
                    wuxiang_tianque: 'assets/images/maps/wuxiang_tianque/collision.png',
                    boss_arena: 'assets/images/maps/boss_arena/collision.png',
                },

                // === 主角动画精灵图 ===
                player: {
                    // 散修（练气期，未选职业）
                    sanxiu_idle: 'assets/images/player/sanxiu/idle.png',
                    sanxiu_walk: 'assets/images/player/sanxiu/walk.png',
                    sanxiu_attack: 'assets/images/player/sanxiu/attack.png',
                    sanxiu_skill: 'assets/images/player/sanxiu/skill.png',
                    sanxiu_hurt: 'assets/images/player/sanxiu/hurt.png',
                    sanxiu_dead: 'assets/images/player/sanxiu/dead.png',
                    
                    // 剑修
                    jianxiu_idle: 'assets/images/player/jianxiu/idle.png',
                    jianxiu_walk: 'assets/images/player/jianxiu/walk.png',
                    jianxiu_attack: 'assets/images/player/jianxiu/attack.png',
                    jianxiu_skill1: 'assets/images/player/jianxiu/skill1.png',
                    jianxiu_skill2: 'assets/images/player/jianxiu/skill2.png',
                    jianxiu_skill3: 'assets/images/player/jianxiu/skill3.png',
                    jianxiu_ultimate: 'assets/images/player/jianxiu/ultimate.png',
                    jianxiu_hurt: 'assets/images/player/jianxiu/hurt.png',
                    jianxiu_dead: 'assets/images/player/jianxiu/dead.png',
                    
                    // 法修
                    faxiu_idle: 'assets/images/player/faxiu/idle.png',
                    faxiu_walk: 'assets/images/player/faxiu/walk.png',
                    faxiu_attack: 'assets/images/player/faxiu/attack.png',
                    faxiu_skill1: 'assets/images/player/faxiu/skill1.png',
                    faxiu_skill2: 'assets/images/player/faxiu/skill2.png',
                    faxiu_skill3: 'assets/images/player/faxiu/skill3.png',
                    faxiu_ultimate: 'assets/images/player/faxiu/ultimate.png',
                    faxiu_hurt: 'assets/images/player/faxiu/hurt.png',
                    faxiu_dead: 'assets/images/player/faxiu/dead.png',
                    
                    // 体修
                    tixiu_idle: 'assets/images/player/tixiu/idle.png',
                    tixiu_walk: 'assets/images/player/tixiu/walk.png',
                    tixiu_attack: 'assets/images/player/tixiu/attack.png',
                    tixiu_skill1: 'assets/images/player/tixiu/skill1.png',
                    tixiu_skill2: 'assets/images/player/tixiu/skill2.png',
                    tixiu_skill3: 'assets/images/player/tixiu/skill3.png',
                    tixiu_ultimate: 'assets/images/player/tixiu/ultimate.png',
                    tixiu_hurt: 'assets/images/player/tixiu/hurt.png',
                    tixiu_dead: 'assets/images/player/tixiu/dead.png',
                    
                    // 符修
                    fuxiu_idle: 'assets/images/player/fuxiu/idle.png',
                    fuxiu_walk: 'assets/images/player/fuxiu/walk.png',
                    fuxiu_attack: 'assets/images/player/fuxiu/attack.png',
                    fuxiu_skill1: 'assets/images/player/fuxiu/skill1.png',
                    fuxiu_skill2: 'assets/images/player/fuxiu/skill2.png',
                    fuxiu_skill3: 'assets/images/player/fuxiu/skill3.png',
                    fuxiu_ultimate: 'assets/images/player/fuxiu/ultimate.png',
                    fuxiu_hurt: 'assets/images/player/fuxiu/hurt.png',
                    fuxiu_dead: 'assets/images/player/fuxiu/dead.png',
                },
                
                // === NPC动画精灵图 ===
                npc: {
                    ahe_idle: 'assets/images/npc/ahe/idle.png',
                    ahe_walk: 'assets/images/npc/ahe/walk.png',
                    qibo_idle: 'assets/images/npc/qibo/idle.png',
                    qibo_walk: 'assets/images/npc/qibo/walk.png',
                    luzhou_idle: 'assets/images/npc/luzhou/idle.png',
                    luzhou_walk: 'assets/images/npc/luzhou/walk.png',
                    jiangpo_idle: 'assets/images/npc/jiangpo/idle.png',
                    jiangpo_walk: 'assets/images/npc/jiangpo/walk.png',
                    wensheng_idle: 'assets/images/npc/wensheng/idle.png',
                    wensheng_walk: 'assets/images/npc/wensheng/walk.png',
                    zhiwei_idle: 'assets/images/npc/zhiwei/idle.png',
                    zhiwei_walk: 'assets/images/npc/zhiwei/walk.png',
                },
                
                // === 怪物动画精灵图 ===
                monsters: {
                    // 普通怪物
                    fenglang_idle: 'assets/images/monsters/fenglang/idle.png',
                    fenglang_attack: 'assets/images/monsters/fenglang/attack.png',
                    fenglang_hurt: 'assets/images/monsters/fenglang/hurt.png',
                    fenglang_dead: 'assets/images/monsters/fenglang/dead.png',
                    
                    // Boss - 摄风山魈
                    boss_shanxiao_walk: 'assets/images/monsters/boss_shanxiao/walk.png',
                    boss_shanxiao_idle: 'assets/images/monsters/boss_shanxiao/idle.png',
                    boss_shanxiao_attack: 'assets/images/monsters/boss_shanxiao/attack.png',
                    boss_shanxiao_skill1: 'assets/images/monsters/boss_shanxiao/skill1.png',
                    boss_shanxiao_skill2: 'assets/images/monsters/boss_shanxiao/skill2.png',
                    boss_shanxiao_hurt: 'assets/images/monsters/boss_shanxiao/hurt.png',
                    boss_shanxiao_dead: 'assets/images/monsters/boss_shanxiao/dead.png',
                    
                    // Boss - 渡厄使
                    boss_due_walk: 'assets/images/monsters/boss_due/walk.png',
                    boss_due_idle: 'assets/images/monsters/boss_due/idle.png',
                    boss_due_attack: 'assets/images/monsters/boss_due/attack.png',
                    boss_due_skill1: 'assets/images/monsters/boss_due/skill1.png',
                    boss_due_skill2: 'assets/images/monsters/boss_due/skill2.png',
                    boss_due_hurt: 'assets/images/monsters/boss_due/hurt.png',
                    boss_due_dead: 'assets/images/monsters/boss_due/dead.png',
                    
                    // Boss - 丹霞真人
                    boss_danxia_walk: 'assets/images/monsters/boss_danxia/walk.png',
                    boss_danxia_idle: 'assets/images/monsters/boss_danxia/idle.png',
                    boss_danxia_attack: 'assets/images/monsters/boss_danxia/attack.png',
                    boss_danxia_skill1: 'assets/images/monsters/boss_danxia/skill1.png',
                    boss_danxia_skill2: 'assets/images/monsters/boss_danxia/skill2.png',
                    boss_danxia_hurt: 'assets/images/monsters/boss_danxia/hurt.png',
                    boss_danxia_dead: 'assets/images/monsters/boss_danxia/dead.png',
                    
                    // Boss - 无相真君
                    boss_wuxiang_walk: 'assets/images/monsters/boss_wuxiang/walk.png',
                    boss_wuxiang_idle: 'assets/images/monsters/boss_wuxiang/idle.png',
                    boss_wuxiang_attack: 'assets/images/monsters/boss_wuxiang/attack.png',
                    boss_wuxiang_skill1: 'assets/images/monsters/boss_wuxiang/skill1.png',
                    boss_wuxiang_skill2: 'assets/images/monsters/boss_wuxiang/skill2.png',
                    boss_wuxiang_hurt: 'assets/images/monsters/boss_wuxiang/hurt.png',
                    boss_wuxiang_dead: 'assets/images/monsters/boss_wuxiang/dead.png',
                    
                    // 最终Boss - 太玄道君
                    boss_taixuan_walk: 'assets/images/monsters/boss_taixuan/walk.png',
                    boss_taixuan_idle: 'assets/images/monsters/boss_taixuan/idle.png',
                    boss_taixuan_attack: 'assets/images/monsters/boss_taixuan/attack.png',
                    boss_taixuan_skill1: 'assets/images/monsters/boss_taixuan/skill1.png',
                    boss_taixuan_skill2: 'assets/images/monsters/boss_taixuan/skill2.png',
                    boss_taixuan_skill3: 'assets/images/monsters/boss_taixuan/skill3.png',
                    boss_taixuan_hurt: 'assets/images/monsters/boss_taixuan/hurt.png',
                    boss_taixuan_dead: 'assets/images/monsters/boss_taixuan/dead.png',
                },
                
                // === 技能特效 ===
                skills: {
                    // 基础技能
                    lingxi_dan: 'assets/images/skills/basic/lingxi_dan.png',
                    huti_shu: 'assets/images/skills/basic/huti_shu.png',
                    huixi_shu: 'assets/images/skills/basic/huixi_shu.png',
                    // 剑修技能
                    jian_tangfeng: 'assets/images/skills/jianxiu/tangfeng.png',
                    jian_guiyi: 'assets/images/skills/jianxiu/guiyi.png',
                    jian_jianying: 'assets/images/skills/jianxiu/jianying.png',
                    jian_wanjian: 'assets/images/skills/jianxiu/wanjian.png',
                    // 法修技能
                    fa_yanling: 'assets/images/skills/faxiu/yanling.png',
                    fa_hanchao: 'assets/images/skills/faxiu/hanchao.png',
                    fa_tianlei: 'assets/images/skills/faxiu/tianlei.png',
                    fa_sanxiang: 'assets/images/skills/faxiu/sanxiang.png',
                    // 体修技能
                    ti_bengshan: 'assets/images/skills/tixiu/bengshan.png',
                    ti_jingang: 'assets/images/skills/tixiu/jingang.png',
                    ti_zhenyue: 'assets/images/skills/tixiu/zhenyue.png',
                    ti_faxiang: 'assets/images/skills/tixiu/faxiang.png',
                    // 符修技能
                    fu_zhuihun: 'assets/images/skills/fuxiu/zhuihun.png',
                    fu_fuling: 'assets/images/skills/fuxiu/fuling.png',
                    fu_baofu: 'assets/images/skills/fuxiu/baofu.png',
                    fu_qianfu: 'assets/images/skills/fuxiu/qianfu.png',
                },
                
                // === 物品图标 ===
                items: {
                    // 丹药
                    dan_wangchen: 'assets/images/items/dan_wangchen.png',
                    dan_huiyuan: 'assets/images/items/dan_huiyuan.png',
                    dan_huiling: 'assets/images/items/dan_huiling.png',
                    // 材料
                    material_lingcao: 'assets/images/items/material_lingcao.png',
                    material_ninglu: 'assets/images/items/material_ninglu.png',
                    // 剧情物品
                    item_guixiangpai: 'assets/images/items/item_guixiangpai.png',
                    item_hundeng: 'assets/images/items/item_hundeng.png',
                    item_yisha: 'assets/images/items/item_yisha.png',
                    item_zhenfengzhuang: 'assets/images/items/item_zhenfengzhuang.png',
                    item_hunlu: 'assets/images/items/item_hunlu.png',
                    item_zhenqi: 'assets/images/items/item_zhenqi.png',

                },
                
                // === 小游戏相关 ===
                miniGame: {
                    // 乘风采药
                    caoyao_bg: 'assets/images/minigame/caoyao/bg.png',
                    caoyao_wind: 'assets/images/minigame/caoyao/wind.png',
                    caoyao_player: 'assets/images/minigame/caoyao/player.png',
                    caoyao_herb: 'assets/images/minigame/caoyao/herb.png',
                    // 定息引气
                    yinqi_bg: 'assets/images/minigame/yinqi/bg.png',
                    yinqi_circle: 'assets/images/minigame/yinqi/circle.png',
                    yinqi_dot: 'assets/images/minigame/yinqi/dot.png',
                    // 逆流行舟
                    xingzhou_bg: 'assets/images/minigame/xingzhou/bg.png',
                    xingzhou_boat: 'assets/images/minigame/xingzhou/boat.png',
                    xingzhou_rock: 'assets/images/minigame/xingzhou/rock.png',
                    // 认灯归魂
                    rendeng_bg: 'assets/images/minigame/rendeng/bg.png',
                    rendeng_deng: 'assets/images/minigame/rendeng/deng.png',
                    rendeng_guang: 'assets/images/minigame/rendeng/guang.png',
                    // 忆片归序
                    yipian_bg: 'assets/images/minigame/yipian/bg.png',
                    yipian_card: 'assets/images/minigame/yipian/card.png',
                    // 控火炼丹
                    konghuo_bg: 'assets/images/minigame/konghuo/bg.png',
                    konghuo_fire: 'assets/images/minigame/konghuo/fire.png',
                    konghuo_danlu: 'assets/images/minigame/konghuo/danlu.png',
                    // 元婴双身解阵
                    yuanying_bg: 'assets/images/minigame/yuanying/bg.png',
                    yuanying_body: 'assets/images/minigame/yuanying/body.png',
                    yuanying_soul: 'assets/images/minigame/yuanying/soul.png',
                },
            },
            
            audio: {
                // === 背景音乐 ===
                bgm: {
                    main_menu: 'assets/audio/bgm/main_menu.mp3',
                    qinglan: 'assets/audio/bgm/qinglan.mp3',
                    yunduze: 'assets/audio/bgm/yunduze.mp3',
                    zhaochen: 'assets/audio/bgm/zhaochen.mp3',
                    wuxiang: 'assets/audio/bgm/wuxiang.mp3',
                    boss_fight: 'assets/audio/bgm/boss_fight.mp3',
                    final_boss: 'assets/audio/bgm/final_boss.mp3',
                    ending: 'assets/audio/bgm/ending.mp3',
                },
                
                // === 音效 ===
                sfx: {
                    // 界面音效
                    ui_click: 'assets/audio/sfx/ui_click.mp3',
                    ui_hover: 'assets/audio/sfx/ui_hover.mp3',
                    ui_confirm: 'assets/audio/sfx/ui_confirm.mp3',
                    ui_cancel: 'assets/audio/sfx/ui_cancel.mp3',
                    // 战斗音效
                    battle_attack: 'assets/audio/sfx/battle_attack.mp3',
                    battle_hit: 'assets/audio/sfx/battle_hit.mp3',
                    battle_skill: 'assets/audio/sfx/battle_skill.mp3',
                    battle_hurt: 'assets/audio/sfx/battle_hurt.mp3',
                    battle_dead: 'assets/audio/sfx/battle_dead.mp3',
                    battle_levelup: 'assets/audio/sfx/battle_levelup.mp3',
                    // 移动音效
                    move_footstep: 'assets/audio/sfx/move_footstep.mp3',
                    move_jump: 'assets/audio/sfx/move_jump.mp3',
                    // 环境音效
                    env_wind: 'assets/audio/sfx/env_wind.mp3',
                    env_water: 'assets/audio/sfx/env_water.mp3',
                    // 小游戏音效
                    game_success: 'assets/audio/sfx/game_success.mp3',
                    game_fail: 'assets/audio/sfx/game_fail.mp3',
                    //其他音效
                    env_fire: 'assets/audio/sfx/env_fire.mp3',
                    env_thunder: 'assets/audio/sfx/env_thunder.mp3',
                    env_bell: 'assets/audio/sfx/env_bell.mp3',
                    breakthrough: 'assets/audio/sfx/breakthrough.mp3',
                    teleport: 'assets/audio/sfx/teleport.mp3',
                    item_use: 'assets/audio/sfx/item_use.mp3',
                    quest_complete: 'assets/audio/sfx/quest_complete.mp3',
                },
            },
        };
        
        // 图片缓存，用于存储已加载的图片对象
        this.imageCache = new Map();
        // 音频缓存，用于存储已加载的音频对象
        this.audioCache = new Map();
    }

    /**
     * 获取图片资源路径
     * @param {string} path - 使用点号分隔的路径，如 'player.jianxiu_idle'
     * @returns {string} 图片资源路径
     */
    getImagePath(path) {
        const keys = path.split('.');
        let current = this.resources.images;
        for (const key of keys) {
            if (current[key] === undefined) {
                console.error(`图片资源路径不存在: ${path}`);
                return null;
            }
            current = current[key];
        }
        return current;
    }

    /**
     * 获取音频资源路径
     * @param {string} path - 使用点号分隔的路径，如 'bgm.qinglan'
     * @returns {string} 音频资源路径
     */
    getAudioPath(path) {
        const keys = path.split('.');
        let current = this.resources.audio;
        for (const key of keys) {
            if (current[key] === undefined) {
                console.error(`音频资源路径不存在: ${path}`);
                return null;
            }
            current = current[key];
        }
        return current;
    }

    /**
     * 加载图片资源
     * @param {string} path - 资源路径（点号分隔）
     * @returns {Promise<Image>} 加载完成的图片对象
     */
    loadImage(path) {
        const imagePath = this.getImagePath(path);
        if (!imagePath) {
            console.warn(`图片资源路径不存在: ${path}`);
            // 返回一个空的占位图，而不是 reject
            return Promise.resolve(this.createPlaceholderImage());
        }
        
        if (this.imageCache.has(imagePath)) {
            return Promise.resolve(this.imageCache.get(imagePath));
        }
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(imagePath, img);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`图片加载失败: ${imagePath}，使用占位图`);
                // 失败时返回占位图，不 reject
                const placeholder = this.createPlaceholderImage();
                this.imageCache.set(imagePath, placeholder);
                resolve(placeholder);
            };
            img.src = imagePath;
        });
    }

    /**
     * 创建占位图片（当资源加载失败时使用）
     */
    createPlaceholderImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // 画一个品红色的方块作为占位
        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(0, 0, 32, 32);
        
        // 画一个叉
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, 4);
        ctx.lineTo(28, 28);
        ctx.moveTo(28, 4);
        ctx.lineTo(4, 28);
        ctx.stroke();
        
        const img = new Image();
        img.src = canvas.toDataURL();
        return img;
    }

    /**
     * 批量加载图片资源
     * @param {string[]} paths - 资源路径数组
     * @returns {Promise<Map>} 加载完成的图片对象Map
     */
    async loadImages(paths) {
        const results = new Map();
        const promises = paths.map(async (path) => {
            const img = await this.loadImage(path);
            results.set(path, img);
        });
        await Promise.all(promises);
        return results;
    }

    /**
     * 获取已缓存的图片对象
     * @param {string} path - 资源路径（点号分隔）
     * @returns {Image|null} 图片对象或null
     */
    getCachedImage(path) {
        const imagePath = this.getImagePath(path);
        if (!imagePath) return null;
        return this.imageCache.get(imagePath) || null;
    }

    /**
     * 加载音频资源
     * @param {string} path - 资源路径（点号分隔）
     * @returns {Promise<Audio>} 加载完成的音频对象
     */
    loadAudio(path) {
        const audioPath = this.getAudioPath(path);
        if (!audioPath) {
            console.warn(`音频资源路径不存在: ${path}`);
            return Promise.resolve(new Audio()); // 返回空音频
        }
        
        if (this.audioCache.has(audioPath)) {
            return Promise.resolve(this.audioCache.get(audioPath));
        }
        
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.audioCache.set(audioPath, audio);
                resolve(audio);
            };
            audio.onerror = () => {
                console.warn(`音频加载失败: ${audioPath}，使用空音频`);
                this.audioCache.set(audioPath, audio);
                resolve(audio); // 失败也返回，不 reject
            };
            audio.src = audioPath;
        });
    }

    /**
     * 预加载某一类资源（如某个地图的所有资源）
     * @param {Object} resourceGroup - 资源组配置
     */
    async preloadResources(resourceGroup) {
        const loadPromises = [];
        
        if (resourceGroup.images) {
            resourceGroup.images.forEach(path => {
                loadPromises.push(this.loadImage(path));
            });
        }
        
        if (resourceGroup.audio) {
            resourceGroup.audio.forEach(path => {
                loadPromises.push(this.loadAudio(path));
            });
        }
        
        await Promise.all(loadPromises);
    }
}
