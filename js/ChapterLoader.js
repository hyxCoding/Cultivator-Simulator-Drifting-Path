/**
 * 章节剧情加载器
 * 
 * 负责将独立章节配置（如 Chapter1Config）注册到 GameConfig 中，
 * 使游戏引擎可以按章节加载对应的 NPC、任务、地图、怪物等数据。
 * 
 * 设计目标：
 * - 每章一个独立配置文件，互不依赖
 * - 通过注册机制合并到全局 GameConfig
 * - 支持按需加载（当前章节 + 已解锁章节）
 * - 向后兼容现有 GameMap、Shop 等对 gameConfig.npcConfigs 的引用
 */
class ChapterLoader {
    constructor() {
        this.loadedChapters = new Set();  // 已加载的章节ID
    }

    /**
     * 注册一个章节的全部配置到 GameConfig
     * @param {Object} chapterData - 章节数据（来自 ChapterXConfig.getAll()）
     * @returns {boolean} 是否注册成功
     */
    registerChapter(chapterData) {
        if (!chapterData || !chapterData.meta) {
            console.warn('[ChapterLoader] 无效的章节数据');
            return false;
        }

        const chapterId = chapterData.meta.id;
        if (this.loadedChapters.has(chapterId)) {
            Logger.log(`[ChapterLoader] 章节 ${chapterId} 已加载，跳过`);
            return true;
        }

        const gameConfig = GameConfig.getInstance();
        let registeredCount = 0;

        // 1. 注册NPC配置
        if (chapterData.npcs) {
            if (!gameConfig.registeredNPCConfigs) {
                gameConfig.registeredNPCConfigs = {};
            }
            for (const npcId in chapterData.npcs) {
                const existed = gameConfig.registeredNPCConfigs[npcId];
                if (existed) {
                    // 同一 NPC 出现在多章（如阿禾）：深合并，保留前一章的美术 / 商店配置，
                    // 只把本章新增的对白、搬迁点、任务等并入（详见 _mergeConfig）
                    gameConfig.registeredNPCConfigs[npcId] = ChapterLoader._mergeConfig(existed, chapterData.npcs[npcId]);
                    Logger.log(`[ChapterLoader] NPC ${npcId} 跨章合并（保留已有美术/商店配置，并入本章内容）`);
                } else {
                    gameConfig.registeredNPCConfigs[npcId] = chapterData.npcs[npcId];
                }
                registeredCount++;
            }
            Logger.log(`[ChapterLoader] 注册 ${registeredCount} 个NPC配置 (${chapterId})`);
        }

        // 2. 注册任务配置
        if (chapterData.quests) {
            if (!gameConfig.registeredQuests) {
                gameConfig.registeredQuests = {};
            }
            if (!gameConfig.registeredQuests[chapterId]) {
                gameConfig.registeredQuests[chapterId] = {};
            }
            Object.assign(gameConfig.registeredQuests[chapterId], chapterData.quests);
            Logger.log(`[ChapterLoader] 注册 ${Object.keys(chapterData.quests).length} 个任务 (${chapterId})`);
        }

        // 3. 注册怪物配置
        if (chapterData.monsters) {
            if (!gameConfig.registeredMonsters) {
                gameConfig.registeredMonsters = {};
            }
            for (const monsterId in chapterData.monsters) {
                gameConfig.registeredMonsters[monsterId] = chapterData.monsters[monsterId];
            }
            Logger.log(`[ChapterLoader] 注册 ${Object.keys(chapterData.monsters).length} 个怪物 (${chapterId})`);
        }

        // 4. 注册地图配置
        if (chapterData.maps) {
            if (!gameConfig.registeredMaps) {
                gameConfig.registeredMaps = {};
            }
            for (const mapId in chapterData.maps) {
                gameConfig.registeredMaps[mapId] = chapterData.maps[mapId];
            }
            Logger.log(`[ChapterLoader] 注册 ${Object.keys(chapterData.maps).length} 个地图 (${chapterId})`);
        }

        // 5. 注册物品配置
        if (chapterData.items) {
            if (!gameConfig.registeredItems) {
                gameConfig.registeredItems = {};
            }
            Object.assign(gameConfig.registeredItems, chapterData.items);
        }

        this.loadedChapters.add(chapterId);
        Logger.log(`[ChapterLoader] 章节 ${chapterId} 注册完成`);
        return true;
    }

    /**
     * 深合并两份配置（跨章共用同一个 NPC 时使用）
     *
     * 规则：
     * - 纯对象：递归合并（同键以 override 为准，override 未声明的键保留 base）
     * - 数组 / 标量 / null：直接取 override（本章声明的清单视作完整替换）
     *
     * 这样阿禾在第一章的 baseAnimations / shopItems / extraAnimations 会被保留，
     * 第二章只需补写自己的对白、搬迁点、任务列表即可。
     *
     * @param {*} base - 先加载的配置（第一章）
     * @param {*} override - 后加载的配置（第二章）
     * @returns {*} 合并结果
     */
    static _mergeConfig(base, override) {
        if (override === undefined) return base;
        if (base === undefined || base === null) return override;

        const baseIsPlainObject = typeof base === 'object' && !Array.isArray(base);
        const overrideIsPlainObject = typeof override === 'object' && override !== null && !Array.isArray(override);

        if (baseIsPlainObject && overrideIsPlainObject) {
            const merged = {};
            for (const key in base) {
                merged[key] = base[key];
            }
            for (const key in override) {
                merged[key] = ChapterLoader._mergeConfig(base[key], override[key]);
            }
            return merged;
        }

        return override;
    }

    /**
     * 批量注册多个章节
     * @param {Array} chapterDataList - 章节数据数组
     */
    registerChapters(chapterDataList) {
        if (!chapterDataList || chapterDataList.length === 0) return;
        chapterDataList.forEach(data => this.registerChapter(data));
    }

    /**
     * 检查章节是否已加载
     */
    isChapterLoaded(chapterId) {
        return this.loadedChapters.has(chapterId);
    }

    /**
     * 获取已加载的章节ID列表
     */
    getLoadedChapters() {
        return Array.from(this.loadedChapters);
    }
}

// 挂载到全局
if (typeof window !== 'undefined') {
    window.ChapterLoader = ChapterLoader;
    
    // 创建全局实例
    if (!window.chapterLoader) {
        window.chapterLoader = new ChapterLoader();
    }
}