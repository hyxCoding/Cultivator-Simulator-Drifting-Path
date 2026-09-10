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
            console.log(`[ChapterLoader] 章节 ${chapterId} 已加载，跳过`);
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
                if (gameConfig.registeredNPCConfigs[npcId]) {
                    console.warn(`[ChapterLoader] NPC ${npcId} 已存在，将被覆盖`);
                }
                gameConfig.registeredNPCConfigs[npcId] = chapterData.npcs[npcId];
                registeredCount++;
            }
            console.log(`[ChapterLoader] 注册 ${registeredCount} 个NPC配置 (${chapterId})`);
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
            console.log(`[ChapterLoader] 注册 ${Object.keys(chapterData.quests).length} 个任务 (${chapterId})`);
        }

        // 3. 注册怪物配置
        if (chapterData.monsters) {
            if (!gameConfig.registeredMonsters) {
                gameConfig.registeredMonsters = {};
            }
            for (const monsterId in chapterData.monsters) {
                gameConfig.registeredMonsters[monsterId] = chapterData.monsters[monsterId];
            }
            console.log(`[ChapterLoader] 注册 ${Object.keys(chapterData.monsters).length} 个怪物 (${chapterId})`);
        }

        // 4. 注册地图配置
        if (chapterData.maps) {
            if (!gameConfig.registeredMaps) {
                gameConfig.registeredMaps = {};
            }
            for (const mapId in chapterData.maps) {
                gameConfig.registeredMaps[mapId] = chapterData.maps[mapId];
            }
            console.log(`[ChapterLoader] 注册 ${Object.keys(chapterData.maps).length} 个地图 (${chapterId})`);
        }

        // 5. 注册物品配置
        if (chapterData.items) {
            if (!gameConfig.registeredItems) {
                gameConfig.registeredItems = {};
            }
            Object.assign(gameConfig.registeredItems, chapterData.items);
        }

        this.loadedChapters.add(chapterId);
        console.log(`[ChapterLoader] 章节 ${chapterId} 注册完成`);
        return true;
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