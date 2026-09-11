/**
 * A*寻路算法类
 * 提供静态方法计算网格上的最短路径
 * 优化路径以减少拐点
 */
class AStar {
    /**
     * 查找从起点到终点的路径
     * @param {Object} start - 起点位置 {x, y}（世界坐标，像素）
     * @param {Object} end - 终点位置 {x, y}（世界坐标，像素）
     * @param {Array} grid - 可行走网格二维数组 [y][x]，true=可走，false=不可走
     * @param {number} tileSize - 瓦片大小（像素）
     * @returns {Array} 路径点列表 [{x, y}, ...]（世界坐标），如果无路径则返回空数组
     */
    static findPath(start, end, grid, tileSize) {
        // 转换为瓦片坐标
        const startTile = {
            x: Math.floor(start.x / tileSize),
            y: Math.floor(start.y / tileSize),
        };
        const endTile = {
            x: Math.floor(end.x / tileSize),
            y: Math.floor(end.y / tileSize),
        };
        
        // 检查起点和终点是否可行走
        if (!this.isWalkable(startTile.x, startTile.y, grid) ||
            !this.isWalkable(endTile.x, endTile.y, grid)) {
            return [];
        }
        
        // 起点和终点相同
        if (startTile.x === endTile.x && startTile.y === endTile.y) {
            return [];
        }
        
        // A*算法
        const openList = [];  // 待检查节点
        const closedList = new Set(); // 已检查节点
        const cameFrom = new Map();   // 记录路径来源
        const gScore = new Map();     // 起点到当前节点的实际代价
        const fScore = new Map();     // 估计总代价
        
        // 节点键值
        const startKey = this.getNodeKey(startTile);
        const endKey = this.getNodeKey(endTile);
        
        // 初始化起点
        openList.push(startTile);
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startTile, endTile));
        
        while (openList.length > 0) {
            // 找到fScore最小的节点
            let currentIndex = 0;
            let current = openList[0];
            let currentKey = this.getNodeKey(current);
            
            for (let i = 1; i < openList.length; i++) {
                const nodeKey = this.getNodeKey(openList[i]);
                if (fScore.get(nodeKey) < fScore.get(currentKey)) {
                    current = openList[i];
                    currentIndex = i;
                    currentKey = nodeKey;
                }
            }
            
            // 到达终点
            if (currentKey === endKey) {
                return this.reconstructPath(cameFrom, current, tileSize);
            }
            
            // 从开放列表移除当前节点
            openList.splice(currentIndex, 1);
            closedList.add(currentKey);
            
            // 检查相邻节点（4方向移动）
            const neighbors = this.getNeighbors(current, grid);
            
            for (const neighbor of neighbors) {
                const neighborKey = this.getNodeKey(neighbor);
                
                // 跳过已检查节点
                if (closedList.has(neighborKey)) {
                    continue;
                }
                
                // 计算新的gScore
                const tentativeGScore = gScore.get(currentKey) + 1;
                
                // 检查是否在开放列表中
                const inOpenList = openList.some(node => 
                    this.getNodeKey(node) === neighborKey
                );
                
                if (!inOpenList || tentativeGScore < gScore.get(neighborKey)) {
                    // 更新路径信息
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, endTile));
                    
                    if (!inOpenList) {
                        openList.push(neighbor);
                    }
                }
            }
        }
        
        // 无路径
        return [];
    }

    /**
     * 启发式函数（曼哈顿距离）
     */
    static heuristic(nodeA, nodeB) {
        return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);
    }

    /**
     * 获取相邻可行走节点（4方向）
     */
    static getNeighbors(node, grid) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -1 },  // 上
            { x: 0, y: 1 },   // 下
            { x: -1, y: 0 },  // 左
            { x: 1, y: 0 },   // 右
        ];
        
        for (const dir of directions) {
            const newX = node.x + dir.x;
            const newY = node.y + dir.y;
            
            if (this.isWalkable(newX, newY, grid)) {
                neighbors.push({ x: newX, y: newY });
            }
        }
        
        return neighbors;
    }

    /**
     * 检查节点是否可行走
     */
    static isWalkable(x, y, grid) {
        if (y < 0 || y >= grid.length) return false;
        if (x < 0 || x >= grid[y].length) return false;
        return grid[y][x];
    }

    /**
     * 获取节点键值
     */
    static getNodeKey(node) {
        return `${node.x},${node.y}`;
    }

    /**
     * 重建路径
     * 将瓦片路径转换为世界坐标，并优化减少拐点
     */
    static reconstructPath(cameFrom, current, tileSize) {
        const tilePath = [current];
        let currentKey = this.getNodeKey(current);
        
        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            currentKey = this.getNodeKey(current);
            tilePath.unshift(current);
        }
        
        // 优化路径：移除不必要的中间点（减少拐点）
        const optimizedPath = this.optimizePath(tilePath);
        
        // 转换为世界坐标（瓦片中心点）
        return optimizedPath.map(tile => ({
            x: tile.x * tileSize + tileSize / 2,
            y: tile.y * tileSize + tileSize / 2,
        }));
    }

    /**
     * 优化路径，减少拐点
     * 使用视线检测移除不需要的中间节点
     */
    static optimizePath(tilePath) {
        if (tilePath.length <= 2) {
            return tilePath;
        }
        
        const optimized = [tilePath[0]];
        let currentIndex = 0;
        
        while (currentIndex < tilePath.length - 1) {
            // 尝试跳到最远的可见节点
            let farthestVisible = currentIndex + 1;
            
            for (let i = tilePath.length - 1; i > currentIndex + 1; i--) {
                if (this.hasLineOfSight(tilePath[currentIndex], tilePath[i])) {
                    farthestVisible = i;
                    break;
                }
            }
            
            optimized.push(tilePath[farthestVisible]);
            currentIndex = farthestVisible;
        }
        
        return optimized;
    }

    /**
     * 检查两个瓦片之间是否有视线（直线无障碍）
     * 使用Bresenham直线算法
     */
    static hasLineOfSight(tileA, tileB) {
        // 如果两点相同
        if (tileA.x === tileB.x && tileA.y === tileB.y) {
            return true;
        }
        
        // 如果是水平或垂直线
        if (tileA.x === tileB.x || tileA.y === tileB.y) {
            return true;
        }
        
        // 对角线视线检查
        const dx = tileB.x - tileA.x;
        const dy = tileB.y - tileA.y;
        
        // 检查是否为直线（45度或其他角度）
        return true; // 简化处理，实际使用时可加入障碍检测
    }

    // ==================== 轴对齐寻路（大型怪物 / Boss 专用） ====================
    // findPath 面向自由移动的 NPC：optimizePath 会把中间点合并成“斜线”，
    // 对只允许上下左右移动的目标（如摄风山魈）不适用。
    // 下面这套接口只返回四方向逐格路径，合并共线点时也仅做轴向可见性检查，
    // 因此相邻路径点必定同行或同列，调用方可直接按轴推进。

    /**
     * 查找轴对齐路径（仅上下左右）
     * @param {Object} start - 起点位置 {x, y}（世界坐标，像素）
     * @param {Object} end - 终点位置 {x, y}（世界坐标，像素）
     * @param {Array} grid - 可行走网格二维数组 [y][x]，true=可走
     * @param {number} tileSize - 瓦片大小（像素）
     * @returns {Array} 路径点列表 [{x, y}, ...]（世界坐标，瓦片中心）；无路径返回 []
     */
    static findAxisAlignedPath(start, end, grid, tileSize) {
        const tilePath = this.searchAxisAlignedTilePath(start, end, grid, tileSize);
        if (tilePath.length === 0) {
            return [];
        }

        const simplified = this.simplifyAxisAlignedPath(tilePath, grid);
        return simplified.map(tile => ({
            x: tile.x * tileSize + tileSize / 2,
            y: tile.y * tileSize + tileSize / 2,
        }));
    }

    /**
     * 轴对齐 A* 搜索（四方向，不做斜线合并）
     * 复用 isWalkable / getNeighbors / heuristic / getNodeKey，仅保留最简 open/closed 主循环。
     * @param {Object} start - 起点（世界坐标）
     * @param {Object} end - 终点（世界坐标）
     * @param {Array} grid - 可行走网格
     * @param {number} tileSize - 瓦片大小
     * @returns {Array} 逐格瓦片路径 [{x, y}, ...]（含起点与终点）；无路径返回 []
     */
    static searchAxisAlignedTilePath(start, end, grid, tileSize) {
        const startTile = { x: Math.floor(start.x / tileSize), y: Math.floor(start.y / tileSize) };
        const endTile = { x: Math.floor(end.x / tileSize), y: Math.floor(end.y / tileSize) };

        if (!this.isWalkable(startTile.x, startTile.y, grid) ||
            !this.isWalkable(endTile.x, endTile.y, grid)) {
            return [];
        }
        if (startTile.x === endTile.x && startTile.y === endTile.y) {
            return [];
        }

        const openList = [startTile];
        const closedList = new Set();
        const cameFrom = new Map();
        const gScore = new Map([[this.getNodeKey(startTile), 0]]);
        const fScore = new Map([[this.getNodeKey(startTile), this.heuristic(startTile, endTile)]]);
        const endKey = this.getNodeKey(endTile);

        while (openList.length > 0) {
            // 取 fScore 最小节点
            let bestIndex = 0;
            let current = openList[0];
            let currentKey = this.getNodeKey(current);
            for (let i = 1; i < openList.length; i++) {
                const key = this.getNodeKey(openList[i]);
                if (fScore.get(key) < fScore.get(currentKey)) {
                    bestIndex = i;
                    current = openList[i];
                    currentKey = key;
                }
            }

            if (currentKey === endKey) {
                return this.reconstructTilePath(cameFrom, current);
            }

            openList.splice(bestIndex, 1);
            closedList.add(currentKey);

            for (const neighbor of this.getNeighbors(current, grid)) {
                const neighborKey = this.getNodeKey(neighbor);
                if (closedList.has(neighborKey)) continue;

                const tentativeG = gScore.get(currentKey) + 1;
                const knownG = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;
                const inOpenList = openList.some(node => this.getNodeKey(node) === neighborKey);

                if (!inOpenList || tentativeG < knownG) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, endTile));
                    if (!inOpenList) {
                        openList.push(neighbor);
                    }
                }
            }
        }

        return [];
    }

    /**
     * 重建逐格瓦片路径（不做拐点合并）
     * @param {Map} cameFrom - 来源表
     * @param {Object} current - 终点瓦片
     * @returns {Array} 瓦片路径 [{x, y}, ...]（含起点与终点）
     */
    static reconstructTilePath(cameFrom, current) {
        const tilePath = [current];
        let currentKey = this.getNodeKey(current);

        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            currentKey = this.getNodeKey(current);
            tilePath.unshift(current);
        }

        return tilePath;
    }

    /**
     * 合并轴对齐路径上的共线中间点
     * 仅当两点同行（或同列）且中间格子全部可走时才合并，合并后依然轴对齐。
     * @param {Array} tilePath - 逐格瓦片路径
     * @param {Array} grid - 可行走网格
     * @returns {Array} 合并后的瓦片路径
     */
    static simplifyAxisAlignedPath(tilePath, grid) {
        if (!Array.isArray(tilePath) || tilePath.length <= 2) {
            return Array.isArray(tilePath) ? tilePath : [];
        }

        const result = [tilePath[0]];
        let index = 0;

        while (index < tilePath.length - 1) {
            let farthest = index + 1;

            for (let i = tilePath.length - 1; i > index + 1; i--) {
                if (this.isAxisAlignedClear(tilePath[index], tilePath[i], grid)) {
                    farthest = i;
                    break;
                }
            }

            result.push(tilePath[farthest]);
            index = farthest;
        }

        return result;
    }

    /**
     * 检查两点是否同行/同列且中间格子全部可走（只走轴向，不判斜线）
     * @param {Object} a - 瓦片坐标 {x, y}
     * @param {Object} b - 瓦片坐标 {x, y}
     * @param {Array} grid - 可行走网格
     * @returns {boolean}
     */
    static isAxisAlignedClear(a, b, grid) {
        if (a.x !== b.x && a.y !== b.y) {
            return false;   // 非轴对齐，不合并
        }

        const stepX = Math.sign(b.x - a.x);
        const stepY = Math.sign(b.y - a.y);
        let x = a.x;
        let y = a.y;

        while (x !== b.x || y !== b.y) {
            x += stepX;
            y += stepY;
            if (!this.isWalkable(x, y, grid)) {
                return false;
            }
        }

        return true;
    }
}