class GameConfig {
    static getInstance() { if (!GameConfig.instance) { GameConfig.instance = new GameConfig(); } return GameConfig.instance; }
    constructor() { if (GameConfig.instance) { return GameConfig.instance; } GameConfig.instance = this; this.initConfig(); }
    initConfig() {
        this.realms = {
            // 初始（练气）：气血上限 150 / 灵息上限 70，建号时即为满值；灵息每秒恢复 2 点
            LIANQI: { id:'lianqi',name:'练气',stages:['初期','中期','后期','圆满'],maxExp:100,moveSpeed:200,maxHealth:150,maxMana:70 },
            // 筑基：第一章章末「筑基调息」完成后进入 —— 气血上限 400 / 灵息上限 250，并即时回满；灵息每秒恢复 4 点
            ZHUJI: { id:'zhuji',name:'筑基',stages:['初期','中期','后期','圆满'],maxExp:200,moveSpeed:220,maxHealth:400,maxMana:250 },
            // 结丹：第二章章末「结丹调息」完成后进入 —— 气血上限 1000 / 灵息上限 500，并即时回满；灵息每秒恢复 10 点
            JIEDAN: { id:'jiedan',name:'结丹',stages:['初期','中期','后期','圆满'],maxExp:400,moveSpeed:240,maxHealth:1000,maxMana:500 },
            // 元婴 / 化神：第三、四章尚未实现，此处为**单调递增的占位值**（元婴 > 结丹 > 筑基）。
            // ⚠ 历史问题：旧占位值 元婴 300/150、化神 500/250 低于结丹 1000/500，
            //   一旦 applyRealmStats('yuanying') 被调用会让上限**倒退**。已按递增补齐。
            YUANYING: { id:'yuanying',name:'元婴',stages:['初期','中期','后期','圆满'],maxExp:800,moveSpeed:260,maxHealth:1600,maxMana:800 },
            HUASHEN: { id:'huashen',name:'化神',stages:['初期'],maxExp:0,moveSpeed:300,maxHealth:2400,maxMana:1200 },
        };
        this.professions = {
            SANXIU: { id:'sanxiu',name:'散修',description:'尚未选择职业',attackType:'basic',unlocked:true },
            JIANXIU: { id:'jianxiu',name:'剑修',description:'灵力凝剑，近中距离机动连击',attackType:'melee',moveSpeedBonus:30,skills:['tangfeng','guiyi','jianying','wanjian'],passive:'jianyi',unlockedAt:'zhuji',respecCost:{zhuji:600,jiedan:1200,yuanying:2400},schools:['zhufeng','liuying'] },
            FAXIU: { id:'faxiu',name:'法修',description:'灵力法器，中远距离术法爆发',attackType:'ranged',rangeBonus:100,skills:['yanling','hanchao','tianlei','sanxiang'],passive:'lingfa',unlockedAt:'zhuji',respecCost:{zhuji:600,jiedan:1200,yuanying:2400},schools:['jizhou','ningfa'] },
            TIXIU: { id:'tixiu',name:'体修',description:'拳影，近距离防护反击',attackType:'melee',defenseBonus:20,skills:['bengshan','jingang','zhenyue','faxiang'],passive:'xujin',unlockedAt:'zhuji',respecCost:{zhuji:600,jiedan:1200,yuanying:2400},schools:['budong','pojun'] },
            FUXIU: { id:'fuxiu',name:'符修',description:'符箓，中距离布置与引爆',attackType:'ranged',skills:['zhuihun','fuling','baofu','qianfu'],passive:'yumo',unlockedAt:'zhuji',respecCost:{zhuji:600,jiedan:1200,yuanying:2400},schools:['xumo','zhusha'] },
        };
        // ========== 技能表（全项目唯一技能数值源）==========
        // 大地图实时战斗（PlayerCombat）在启动时把 manaCost / cooldown / damage / range /
        // projectileSpeed / 减伤等全部从这里同步过去 —— 改这里的数字即全局生效，
        // 不需要再去 PlayerCombat.CONFIG 里改第二遍。
        this.skills = {
            basic: {
                lingxidan:{id:'lingxidan',name:'灵息弹',type:'basic',description:'发射单体灵力攻击',manaCost:10,cooldown:3,damage:20,range:300,projectileSpeed:400,maxLevel:3,upgradeCost:[1,2]},
                hutishu:{id:'hutishu',name:'护体术',type:'basic',description:'获得短时护盾',manaCost:15,cooldown:30,duration:10,shieldPercent:30,maxLevel:3,upgradeCost:[1,2]},
                huixishu:{id:'huixishu',name:'回息术',type:'basic',description:'短暂原地调息，恢复部分灵息',manaCost:0,cooldown:12,manaRestorePercent:30,channelTime:1.5,maxLevel:3,upgradeCost:[1,2]},
            },
            jianxiu: {
                tangfeng:{id:'tangfeng',name:'踏风斩',type:'active',profession:'jianxiu',unlockStage:'zhuji',description:'朝指定方向短距突进并斩击',manaCost:20,cooldown:5,damage:25,dashDistance:150,maxLevel:3,upgradeCost:[1,2]},
                guiyi:{id:'guiyi',name:'归刃',type:'active',profession:'jianxiu',unlockStage:'zhuji',description:'掷出灵剑再回收',manaCost:25,cooldown:6,damage:30,range:250,maxLevel:3,upgradeCost:[1,2]},
                jianying:{id:'jianying',name:'剑影连斩',type:'active',profession:'jianxiu',unlockStage:'jiedan',description:'在角色的上下左右四个方向各生成一道剑气，命中敌人后消散',manaCost:30,cooldown:15,damage:40,range:240,projectileSpeed:360,maxLevel:3,upgradeCost:[1,2]},
                wanjian:{id:'wanjian',name:'万剑归宗',type:'ultimate',profession:'jianxiu',unlockStage:'yuanying',description:'在选定区域落下剑雨',manaCost:80,cooldown:30,damage:150,range:300,areaRadius:100,maxLevel:3,upgradeCost:[1,2]},
            },
            faxiu: {
                yanling:{id:'yanling',name:'炎灵术',type:'active',profession:'faxiu',unlockStage:'zhuji',description:'发射火焰，对命中点周围造成伤害',manaCost:25,cooldown:4,damage:28,range:350,areaRadius:50,maxLevel:3,upgradeCost:[1,2]},
                hanchao:{id:'hanchao',name:'寒潮术',type:'active',profession:'faxiu',unlockStage:'zhuji',description:'向前释放寒潮并施加减速',manaCost:30,cooldown:6,damage:22,range:300,slowPercent:30,slowDuration:2,maxLevel:3,upgradeCost:[1,2]},
                tianlei:{id:'tianlei',name:'天雷引',type:'active',profession:'faxiu',unlockStage:'jiedan',description:'在指定区域预示雷击',manaCost:45,cooldown:12,damage:70,range:400,areaRadius:60,delayTime:1,maxLevel:3,upgradeCost:[1,2]},
                sanxiang:{id:'sanxiang',name:'三象天劫',type:'ultimate',profession:'faxiu',unlockStage:'yuanying',description:'在选定范围依次触发火、冰、雷攻击',manaCost:90,cooldown:35,damage:180,range:350,areaRadius:120,maxLevel:3,upgradeCost:[1,2]},
            },
            tixiu: {
                bengshan:{id:'bengshan',name:'崩山拳',type:'active',profession:'tixiu',unlockStage:'zhuji',description:'向前踏步出拳',manaCost:20,cooldown:4,damage:25,toughnessDamage:40,range:100,maxLevel:3,upgradeCost:[1,2]},
                jingang:{id:'jingang',name:'金刚护体',type:'active',profession:'tixiu',unlockStage:'zhuji',description:'短时减伤并提升抗打断',manaCost:30,cooldown:10,duration:4,damageReduction:30,maxLevel:3,upgradeCost:[1,2]},
                zhenyue:{id:'zhenyue',name:'震岳踏',type:'active',profession:'tixiu',unlockStage:'jiedan',description:'踏地造成周身范围伤害',manaCost:40,cooldown:12,damage:55,toughnessDamage:50,areaRadius:80,maxLevel:3,upgradeCost:[1,2]},
                faxiang:{id:'faxiang',name:'法相镇岳',type:'ultimate',profession:'tixiu',unlockStage:'yuanying',description:'短时显化法相',manaCost:70,cooldown:30,duration:8,damageReduction:40,toughnessBonus:30,maxLevel:3,upgradeCost:[1,2]},
            },
            fuxiu: {
                zhuihun:{id:'zhuihun',name:'追魂符',type:'active',profession:'fuxiu',unlockStage:'zhuji',description:'发射轻度追踪灵符',manaCost:20,cooldown:3,damage:18,range:350,markDuration:5,maxLevel:3,upgradeCost:[1,2]},
                fuling:{id:'fuling',name:'缚灵阵',type:'active',profession:'fuxiu',unlockStage:'zhuji',description:'放置小型符阵',manaCost:35,cooldown:8,damage:8,duration:6,areaRadius:70,slowPercent:25,maxCount:2,maxLevel:3,upgradeCost:[1,2]},
                baofu:{id:'baofu',name:'爆符诀',type:'active',profession:'fuxiu',unlockStage:'jiedan',description:'引爆目标身上的符印',manaCost:30,cooldown:6,baseDamage:35,markBonusDamage:50,range:400,maxLevel:3,upgradeCost:[1,2]},
                qianfu:{id:'qianfu',name:'千符归一',type:'ultimate',profession:'fuxiu',unlockStage:'yuanying',description:'在所选区域展开符雨并集中爆破',manaCost:85,cooldown:32,damage:160,range:350,areaRadius:100,maxLevel:3,upgradeCost:[1,2]},
            },
        };
        this.passives = {
            jianyi:{id:'jianyi',name:'剑意',profession:'jianxiu',description:'普通攻击命中积累剑意',maxStacks:3,damageBonusPerStack:15},
            lingfa:{id:'lingfa',name:'灵法相生',profession:'faxiu',description:'交替使用不同技能命中，后一个技能伤害提高',damageBonus:15},
            xujin:{id:'xujin',name:'蓄劲',profession:'tixiu',description:'闪避或金刚护体受击后，下次攻击附加韧性伤害',toughnessBonus:25},
            yumo:{id:'yumo',name:'余墨',profession:'fuxiu',description:'追魂符命中后附加持续伤害',dotDamage:5,dotDuration:4},
        };
        this.items = {
            huiyuan_dan:{id:'huiyuan_dan',name:'回元丹',type:'consumable',description:'恢复最大气血的35%',effect:'restore_health_percent',value:35,stackable:true,maxStack:99,sellPrice:20,buyPrice:50},
            huiling_dan:{id:'huiling_dan',name:'回灵丹',type:'consumable',description:'恢复最大灵息的40%',effect:'restore_mana_percent',value:40,stackable:true,maxStack:99,sellPrice:25,buyPrice:60},
            lingcao:{id:'lingcao',name:'灵草',type:'material',description:'炼制回元丹的基础材料',stackable:true,maxStack:99,sellPrice:5,buyPrice:15},
            ninglu:{id:'ninglu',name:'凝露',type:'material',description:'炼制回灵丹的基础材料',stackable:true,maxStack:99,sellPrice:8,buyPrice:20},
            guixiang_pai:{id:'guixiang_pai',name:'归乡牌',type:'quest',description:'刻有"青岚村"的牌子',stackable:false},
            hundeng:{id:'hundeng',name:'魂灯',type:'quest',description:'引渡司用来装载魂魄的灯',stackable:false},
            yisha:{id:'yisha',name:'忆砂',type:'quest',description:'从魂魄中炼化出的记忆结晶',stackable:false},
        };
        this.recipes = {
            huiyuan_dan:{result:'huiyuan_dan',materials:[{itemId:'lingcao',count:2}],minigame:'konghuo_liandan'},
            huiling_dan:{result:'huiling_dan',materials:[{itemId:'lingcao',count:1},{itemId:'ninglu',count:1}],minigame:'konghuo_liandan'},
        };
        // ========== 战斗通用规则（全境界一致，与职业无关） ==========
        this.combat = {
            // 灵息（魔法值）自然恢复：每 interval 秒恢复 amount 点，上限自然封顶
            // 说明：气血只有丹药 / 剧情回复，不做自然恢复；灵息恢复不看是否移动 / 普攻 / 闪避
            // 按境界分档（byRealm）：练气 每 1 秒 2 点 → 筑基 每 1 秒 4 点 → 结丹及以后 每 1 秒 10 点
            // 顶层 interval / amount 是兜底值（未知境界 / 旧存档缺档时使用，取练气档）
            manaRegen: {
                interval: 1, amount: 2,
                byRealm: {
                    lianqi: { interval: 1, amount: 2 },
                    zhuji: { interval: 1, amount: 4 },
                    jiedan: { interval: 1, amount: 10 },
                    yuanying: { interval: 1, amount: 10 },
                    huashen: { interval: 1, amount: 10 },
                },
            },
            // 回合制战斗节奏（秒）——全项目唯一来源，BattleSystem 从这里取。
            // 说明：敌人行动后的停顿由主循环 update(deltaTime) 计时，不再用 setTimeout，
            // 从而与游戏暂停 / 帧率保持一致（改这里一处即全局生效）。
            turnBased: {
                turnDuration: 30,      // 玩家单回合操作时限（秒），超时自动结束该回合
                enemyTurnDelay: 0.5,   // 敌人行动后停顿多久再推进到下一回合（秒）
            },
        };
        this.respecCost = { zhuji:600, jiedan:1200, yuanying:2400 };
        // 注：原 `repeatableQuestRewards` 已删除（第十四次改动）—— 全项目无任何消费者，
        //     可重复任务系统尚未实现。将来落地时可重复任务时，请连同系统一起重新定义。

        // ========== 唯一常量源（改一处即全局生效）==========
        // 境界推进顺序：全项目唯一，禁止在 Player / ProfessionSystem / Main 里再写一份数组。
        // 取值请走 getRealmOrder() / getRealmIndex() / getNextRealm()。
        this.realmOrder = ['lianqi', 'zhuji', 'jiedan', 'yuanying', 'huashen'];
        // 默认境界（建号 / 缺档兜底）
        this.defaultRealmId = 'lianqi';
        // 玩家建号默认值：坐标与初始资源。Main.createPlayer 只传这些，不再硬编码血量 / 灵息。
        // 气血 / 灵息上限一律由 realms[realm] 派生（见 getRealm），避免出现「配置 150、开局 100」的冲突。
        this.playerDefaults = {
            realm: 'lianqi',
            stage: '初期',
            lingShi: 0,
            spawn: { x: 448, y: 1376 },
        };
        // 玩家战斗基准值（与职业无关的兜底），ProfessionSystem / Player 统一从这里取
        this.playerCombatBase = {
            attackDamage: 10,     // 普通攻击基础伤害
            attackRange: 50,      // 普通攻击基础范围
            attackCooldown: 0.5,  // 普通攻击基础冷却（秒）
            moveSpeed: 200,       // 移动速度兜底（境界配置缺失时使用）
            invincibleOnRevive: 2,   // 复活无敌时长（秒）
        };
        // 注：原 dodgeCooldown / dodgeDuration / dodgeSpeedMultiplier 已删除（第十四次改动）——
        //     闪避完全由 PlayerCombatSystem.config.dodge 负责（冷却 / 时长 / 距离 / 加成），
        //     这三个字段只剩已删除的 Player.performDodge 在用，属死配置。
        // 怪物 / Boss 缺配置时的最后兜底值（唯一来源）。
        // 正常数值一律来自章节配置（Chapter1Config / Chapter2Config → GameConfig.registerMonster）；
        // 类内不再写死 50 / 300 / 400 这类与配置冲突的魔数。
        this.monsterDefaults = {
            health: 50, damage: 10, defense: 0, expReward: 10, lingShiReward: 5,
        };
        // 剧情演出时长（秒）—— 全项目唯一来源，禁止在 NPC / Main 里写死毫秒数
        this.storyTiming = {
            npcHealSwitchDelay: 1.0,   // 阿禾治疗动画播完后，阿砚切站立 idle 的等待时长
        };

        // ========== 小游戏默认参数（启动时由主游戏按此表注入）==========
        // 每个小游戏「只吃纯数据」，不再自己到处找全局变量；Main.getMiniGameParams() 会
        // 以本表为底，叠加当前剧情 / 玩家状态后传给 MiniGameManager.startMiniGame(gameId, params)。
        this.miniGames = {
            herb_collect:    { timeLimit: 0, maxScore: 100, requiredHerbs: 8 },
            breath_control:  { timeLimit: 30, maxScore: 100, totalAttempts: 10 },
            boat_navigation: { timeLimit: 0, maxScore: 100, totalObstacles: 60 },
            memory_sort:     { timeLimit: 90, maxScore: 100 },
            lantern_identify:{ timeLimit: 0, maxScore: 100, maxAttempts: 3 },
        };

        this.maps = {
            // 世界地图（九州总图）：地图已删减为前两章，只保留青岚浮野 / 云渡泽两个传送按钮。
            // 打开方式只有剧情节点（第一章码头登船 / 章末登船）—— 原 M 键调试入口已按需求移除
            // （第十三次改动，见 js/Main.js handleKeyDown）；关闭走 ESC。
            // unlocked 只用于存档 / 数据自检；调试期两个按钮都常开（点击即传送）。
            worldMap:{ id:'worldMap',name:'九州总图',type:'worldMap',
                buttons:[
                    {id:'btn_qinglan',x:150,y:180,width:80,height:80,targetMap:'qinglan_fuye',unlocked:true},
                    {id:'btn_yunduze',x:380,y:150,width:80,height:80,targetMap:'yunduze',unlocked:true},
                ],
            },
        };
        this.registeredNPCConfigs = {};
        this.registeredQuests = {};
        this.registeredMonsters = {};
        this.registeredMaps = {};
        this.registeredItems = {};

        // ========== 性能：查询缓存 ==========
        // getRealm / getProfession 每帧会被 Player / HUD / PlayerData 调用，缓存「入参 → 结果」
        // 避免重复的 String().toUpperCase() 与属性查找。配置在本对象生命周期内不变，
        // 故缓存永不失效（注册新配置时走 registerMonster 等入口，不经过这里）。
        this._realmCache = new Map();
        this._professionCache = new Map();
        // 灵息恢复兜底档（供未知境界使用，避免每次查询都新建对象）
        this._manaRegenFallback = { interval: 1, amount: 2 };
        // 归一化各境界恢复档，使 getManaRegen 可以直接返回共享对象（零分配）
        const regenCfg = this.combat && this.combat.manaRegen;
        if (regenCfg && regenCfg.byRealm) {
            for (const k in regenCfg.byRealm) {
                const e = regenCfg.byRealm[k];
                if (!(e.interval > 0)) e.interval = 1;
                if (!(e.amount > 0)) e.amount = 2;
            }
        }
    }
    get(path) { const keys=path.split('.'); let c=this; for(const k of keys){if(c[k]===undefined)return null;c=c[k];} return c; }
    getRealm(r){
        const key = String(r).toUpperCase();
        let hit = this._realmCache.get(key);
        if (hit === undefined) { hit = this.realms[key] || null; this._realmCache.set(key, hit); }
        return hit;
    }
    getProfession(p){
        const key = String(p).toUpperCase();
        let hit = this._professionCache.get(key);
        if (hit === undefined) { hit = this.professions[key] || null; this._professionCache.set(key, hit); }
        return hit;
    }
    getSkill(id){for(const c in this.skills)for(const p in this.skills[c])if(this.skills[c][p].id===id)return this.skills[c][p];return null;}
    getItem(id){return this.items[id]||this.registeredItems[id]||null;}
    getQuest(id){for(const c in this.registeredQuests)for(const q in this.registeredQuests[c])if(this.registeredQuests[c][q].id===id)return this.registeredQuests[c][q];return null;}
    getMap(id){return this.registeredMaps[id]||this.maps[id]||null;}
    getMonster(id){return this.registeredMonsters[id]||null;}
    getNPCConfig(npcId){return this.registeredNPCConfigs[npcId]||null;}

    // ==================== 唯一常量取值方法（全项目统一入口）====================

    /** 境界推进顺序（返回副本，避免外部误改唯一常量源） */
    getRealmOrder(){ return this.realmOrder.slice(); }

    /** 境界在推进顺序中的下标（未知境界返回 -1） */
    getRealmIndex(realmId){ return this.realmOrder.indexOf(realmId); }

    /** 下一境界配置（已是最高境界 / 未知境界时返回 null） */
    getNextRealm(realmId){
        const idx = this.getRealmIndex(realmId);
        if (idx < 0 || idx >= this.realmOrder.length - 1) return null;
        return this.getRealm(this.realmOrder[idx + 1]);
    }

    /** 默认境界 ID */
    getDefaultRealmId(){ return this.defaultRealmId; }

    /** 玩家建号默认值（深拷贝，调用方改动不会污染唯一常量源） */
    getPlayerDefaults(){
        return { realm:this.playerDefaults.realm, stage:this.playerDefaults.stage,
                 lingShi:this.playerDefaults.lingShi,
                 spawn:{ x:this.playerDefaults.spawn.x, y:this.playerDefaults.spawn.y } };
    }

    /** 玩家战斗基准值（返回副本） */
    getPlayerCombatBase(){ return Object.assign({}, this.playerCombatBase); }

    /** 怪物 / Boss 缺配置时的兜底数值（返回副本） */
    getMonsterDefaults(){ return Object.assign({}, this.monsterDefaults); }

    /**
     * 剧情演出时长（秒），返回副本。全项目唯一来源，禁止在 NPC / Main 里写死毫秒数。
     * · npcHealSwitchDelay —— 阿禾治疗动画播完后，阿砚切站立 idle 的等待时长
     */
    getStoryTiming(){
        const t = this.storyTiming || {};
        return {
            npcHealSwitchDelay: t.npcHealSwitchDelay >= 0 ? t.npcHealSwitchDelay : 1.0,
        };
    }

    /**
     * 某境界的灵息自然恢复档（{interval, amount}），缺档回落到顶层兜底值。
     * 全项目唯一来源，Player.updateManaRegen 与 HUD 都走这里。
     * 性能：返回的是配置里的共享对象（已在构造时归一化），每帧调用零分配。
     * @returns {{interval:number, amount:number}} 只读，请勿修改
     */
    getManaRegen(realmId){
        const regen = this.combat && this.combat.manaRegen;
        if (!regen) return this._manaRegenFallback;
        return (regen.byRealm && regen.byRealm[realmId]) || regen;
    }

    /**
     * 回合制战斗节奏（返回副本）：{turnDuration, enemyTurnDelay}，单位秒。
     * 全项目唯一来源，BattleSystem 构造时读取；改这里一处即全局生效。
     */
    getBattleTiming(){
        const t = (this.combat && this.combat.turnBased) || {};
        return {
            turnDuration: t.turnDuration > 0 ? t.turnDuration : 30,
            enemyTurnDelay: t.enemyTurnDelay >= 0 ? t.enemyTurnDelay : 0.5,
        };
    }

    /**
     * 小游戏默认参数（返回副本）。启动小游戏时以它为底，叠加剧情 / 玩家状态。
     * @param {string} gameId
     */
    getMiniGameConfig(gameId){ return Object.assign({}, this.miniGames[gameId] || {}); }

    /**
     * 统一的伤害结算公式（全项目唯一，禁止各处再写 max(1, dmg - def)）。
     * 规则：先减去防御，最少造成 minimum 点（默认 1，避免出现 0 伤害）。
     * @param {number} baseDamage 攻击方基础伤害
     * @param {number} defense 防御方防御力
     * @param {Object} [options] { round:boolean, minimum:number }
     * @returns {number}
     */
    calculateDamage(baseDamage, defense, options){
        const opt = options || {};
        const minimum = typeof opt.minimum === 'number' ? opt.minimum : 1;
        const raw = (Number(baseDamage) || 0) - (Number(defense) || 0);
        const value = opt.round === false ? raw : Math.round(raw);
        return Math.max(minimum, value);
    }

    serialize(){return JSON.parse(JSON.stringify({realms:this.realms,professions:this.professions,skills:this.skills,passives:this.passives,items:this.items,quests:this.registeredQuests,monsters:this.registeredMonsters,maps:{...this.maps,...this.registeredMaps},recipes:this.recipes,respecCost:this.respecCost,storyTiming:this.storyTiming}));}
    deserialize(data){if(!data)return;if(data.realms)this.realms=data.realms;if(data.professions)this.professions=data.professions;if(data.skills)this.skills=data.skills;if(data.passives)this.passives=data.passives;if(data.items)this.items=data.items;if(data.quests)this.registeredQuests=data.quests;if(data.monsters)this.registeredMonsters=data.monsters;if(data.maps){for(const k in data.maps)if(k!=='worldMap')this.registeredMaps[k]=data.maps[k];}if(data.recipes)this.recipes=data.recipes;if(data.respecCost)this.respecCost=data.respecCost;if(data.storyTiming)this.storyTiming=data.storyTiming;}
}
