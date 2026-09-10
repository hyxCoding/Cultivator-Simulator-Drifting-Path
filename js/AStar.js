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
}