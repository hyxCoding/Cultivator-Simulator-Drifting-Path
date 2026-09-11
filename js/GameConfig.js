class GameConfig {
    static getInstance() { if (!GameConfig.instance) { GameConfig.instance = new GameConfig(); } return GameConfig.instance; }
    constructor() { if (GameConfig.instance) { return GameConfig.instance; } GameConfig.instance = this; this.initConfig(); }
    initConfig() {
        this.realms = {
            // 初始（练气）：气血上限 100 / 灵息上限 50，建号时即为满值
            LIANQI: { id:'lianqi',name:'练气',stages:['初期','中期','后期','圆满'],maxExp:100,moveSpeed:200,maxHealth:100,maxMana:50 },
            // 筑基：第一章章末「筑基调息」完成后进入 —— 气血上限 200 / 灵息上限 100，并即时回满
            ZHUJI: { id:'zhuji',name:'筑基',stages:['初期','中期','后期','圆满'],maxExp:200,moveSpeed:220,maxHealth:200,maxMana:100 },
            JIEDAN: { id:'jiedan',name:'结丹',stages:['初期','中期','后期','圆满'],maxExp:400,moveSpeed:240,maxHealth:220,maxMana:100 },
            YUANYING: { id:'yuanying',name:'元婴',stages:['初期','中期','后期','圆满'],maxExp:800,moveSpeed:260,maxHealth:300,maxMana:150 },
            HUASHEN: { id:'huashen',name:'化神',stages:['初期'],maxExp:0,moveSpeed:300,maxHealth:500,maxMana:250 },
        };
        this.professions = {
            SANXIU: { id:'sanxiu',name:'散修',description:'尚未选择职业',attackType:'basic',unlocked:true },
            JIANXIU: { id:'jianxiu',name:'剑修',description:'灵力凝剑，近中距离机动连击',attackType:'melee',moveSpeedBonus:30,skills:['tangfeng','guiyi','jianying','wanjian'],passive:'jianyi',unlockedAt:'zhuji',respecCost:{zhuji:600,jiedan:1200,yuanying:2400},schools:['zhufeng','liuying'] },
            FAXIU: { id:'faxiu',name:'法修',description:'灵力法器，中远距离术法爆发',attackType:'ranged',rangeBonus:100,skills:['yanling','hanchao','tianlei','sanxiang'],passive:'lingfa',unlockedAt:'zhuji',respecCost:{zhuji:600,jiedan:1200,yuanying:2400},schools:['jizhou','ningfa'] },
            TIXIU: { id:'tixiu',name:'体修',description:'拳影，近距离防护反击',attackType:'melee',defenseBonus:20,skills:['bengshan','jingang','zhenyue','faxiang'],passive:'xujin',unlockedAt:'zhuji',respecCost:{zhuji:600,jiedan:1200,yuanying:2400},schools:['budong','pojun'] },
            FUXIU: { id:'fuxiu',name:'符修',description:'符箓，中距离布置与引爆',attackType:'ranged',skills:['zhuihun','fuling','baofu','qianfu'],passive:'yumo',unlockedAt:'zhuji',respecCost:{zhuji:600,jiedan:1200,yuanying:2400},schools:['xumo','zhusha'] },
        };
        this.skills = {
            basic: {
                lingxidan:{id:'lingxidan',name:'灵息弹',type:'basic',description:'发射单体灵力攻击',manaCost:10,cooldown:2,damage:15,range:300,projectileSpeed:400,maxLevel:3,upgradeCost:[1,2]},
                hutishu:{id:'hutishu',name:'护体术',type:'basic',description:'获得短时护盾',manaCost:15,cooldown:8,duration:3,shieldPercent:30,maxLevel:3,upgradeCost:[1,2]},
                huixishu:{id:'huixishu',name:'回息术',type:'basic',description:'短暂原地调息，恢复部分灵息',manaCost:0,cooldown:12,manaRestorePercent:30,channelTime:1.5,maxLevel:3,upgradeCost:[1,2]},
            },
            jianxiu: {
                tangfeng:{id:'tangfeng',name:'踏风斩',type:'active',profession:'jianxiu',unlockStage:'zhuji',description:'朝指定方向短距突进并斩击',manaCost:20,cooldown:5,damage:25,dashDistance:150,maxLevel:3,upgradeCost:[1,2]},
                guiyi:{id:'guiyi',name:'归刃',type:'active',profession:'jianxiu',unlockStage:'zhuji',description:'掷出灵剑再回收',manaCost:25,cooldown:6,damage:30,range:250,maxLevel:3,upgradeCost:[1,2]},
                jianying:{id:'jianying',name:'剑影连斩',type:'active',profession:'jianxiu',unlockStage:'jiedan',description:'对前方连续斩击',manaCost:40,cooldown:10,damage:60,range:120,maxLevel:3,upgradeCost:[1,2]},
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
            manaRegen: { interval: 2, amount: 1 },
        };
        this.respecCost = { zhuji:600, jiedan:1200, yuanying:2400 };
        this.repeatableQuestRewards = { lianqi:50, zhuji:200, jiedan:400, yuanying:800 };
        this.maps = {
            worldMap:{ id:'worldMap',name:'九州总图',type:'worldMap',
                buttons:[
                    {id:'btn_qinglan',x:150,y:180,width:80,height:80,targetMap:'qinglan_fuye',unlocked:true},
                    {id:'btn_yunduze',x:380,y:150,width:80,height:80,targetMap:'yunduze',unlocked:false},
                    {id:'btn_zhaochen',x:600,y:220,width:80,height:80,targetMap:'zhaochen_xiancheng',unlocked:false},
                    {id:'btn_wuxiang',x:450,y:350,width:80,height:80,targetMap:'wuxiang_tianque',unlocked:false},
                ],
            },
        };
        this.registeredNPCConfigs = {};
        this.registeredQuests = {};
        this.registeredMonsters = {};
        this.registeredMaps = {};
        this.registeredItems = {};
    }
    get(path) { const keys=path.split('.'); let c=this; for(const k of keys){if(c[k]===undefined)return null;c=c[k];} return c; }
    getRealm(r){return this.realms[r.toUpperCase()]||null;}
    getProfession(p){return this.professions[p.toUpperCase()]||null;}
    getSkill(id){for(const c in this.skills)for(const p in this.skills[c])if(this.skills[c][p].id===id)return this.skills[c][p];return null;}
    getItem(id){return this.items[id]||this.registeredItems[id]||null;}
    getQuest(id){for(const c in this.registeredQuests)for(const q in this.registeredQuests[c])if(this.registeredQuests[c][q].id===id)return this.registeredQuests[c][q];return null;}
    getMap(id){return this.registeredMaps[id]||this.maps[id]||null;}
    getMonster(id){return this.registeredMonsters[id]||null;}
    getNPCConfig(npcId){return this.registeredNPCConfigs[npcId]||null;}
    serialize(){return JSON.parse(JSON.stringify({realms:this.realms,professions:this.professions,skills:this.skills,passives:this.passives,items:this.items,quests:this.registeredQuests,monsters:this.registeredMonsters,maps:{...this.maps,...this.registeredMaps},recipes:this.recipes,respecCost:this.respecCost,repeatableQuestRewards:this.repeatableQuestRewards}));}
    deserialize(data){if(!data)return;if(data.realms)this.realms=data.realms;if(data.professions)this.professions=data.professions;if(data.skills)this.skills=data.skills;if(data.passives)this.passives=data.passives;if(data.items)this.items=data.items;if(data.quests)this.registeredQuests=data.quests;if(data.monsters)this.registeredMonsters=data.monsters;if(data.maps){for(const k in data.maps)if(k!=='worldMap')this.registeredMaps[k]=data.maps[k];}if(data.recipes)this.recipes=data.recipes;if(data.respecCost)this.respecCost=data.respecCost;if(data.repeatableQuestRewards)this.repeatableQuestRewards=data.repeatableQuestRewards;}
}
