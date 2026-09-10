/**
 * 碰撞检测工具类
 * 提供静态方法用于各种碰撞检测
 */
class CollisionDetector {
    /**
     * AABB碰撞检测（矩形与矩形）
     * @param {Object} rect1 - 矩形1 {x, y, width, height}
     * @param {Object} rect2 - 矩形2 {x, y, width, height}
     * @returns {boolean} 是否发生碰撞
     */
    static aabb(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    /**
     * 点与矩形碰撞检测
     * @param {number} px - 点的x坐标
     * @param {number} py - 点的y坐标
     * @param {Object} rect - 矩形 {x, y, width, height}
     * @returns {boolean} 点是否在矩形内
     */
    static pointInRect(px, py, rect) {
        return px >= rect.x &&
               px <= rect.x + rect.width &&
               py >= rect.y &&
               py <= rect.y + rect.height;
    }

    /**
     * 圆形与矩形碰撞检测
     * @param {Object} circle - 圆形 {x, y, radius}
     * @param {Object} rect - 矩形 {x, y, width, height}
     * @returns {boolean} 是否发生碰撞
     */
    static circleRect(circle, rect) {
        // 找到矩形上距离圆心最近的点
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
        
        // 计算距离
        const distanceX = circle.x - closestX;
        const distanceY = circle.y - closestY;
        
        // 判断距离是否小于半径
        return (distanceX * distanceX + distanceY * distanceY) < (circle.radius * circle.radius);
    }

    /**
     * 矩形碰撞后的分离向量计算（用于推离碰撞）
     * @param {Object} movingRect - 移动的矩形 {x, y, width, height}
     * @param {Object} staticRect - 静止的矩形 {x, y, width, height}
     * @returns {Object|null} 分离向量 {x, y} 或 null（无碰撞）
     */
    static getSeparationVector(movingRect, staticRect) {
        if (!this.aabb(movingRect, staticRect)) {
            return null;
        }

        // 计算重叠量
        const overlapX = Math.min(
            movingRect.x + movingRect.width - staticRect.x,
            staticRect.x + staticRect.width - movingRect.x
        );
        const overlapY = Math.min(
            movingRect.y + movingRect.height - staticRect.y,
            staticRect.y + staticRect.height - movingRect.y
        );

        // 返回最小的分离向量
        if (overlapX < overlapY) {
            return {
                x: movingRect.x < staticRect.x ? -overlapX : overlapX,
                y: 0
            };
        } else {
            return {
                x: 0,
                y: movingRect.y < staticRect.y ? -overlapY : overlapY
            };
        }
    }

    /**
     * 射线与矩形碰撞检测（用于视线检测等）
     * @param {Object} rayOrigin - 射线起点 {x, y}
     * @param {Object} rayDirection - 射线方向 {x, y}（归一化向量）
     * @param {Object} rect - 矩形 {x, y, width, height}
     * @returns {number|null} 碰撞距离或null
     */
    static rayRect(rayOrigin, rayDirection, rect) {
        let tmin = -Infinity;
        let tmax = Infinity;

        // X轴检测
        if (Math.abs(rayDirection.x) < 1e-8) {
            if (rayOrigin.x < rect.x || rayOrigin.x > rect.x + rect.width) {
                return null;
            }
        } else {
            let t1 = (rect.x - rayOrigin.x) / rayDirection.x;
            let t2 = (rect.x + rect.width - rayOrigin.x) / rayDirection.x;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        }

        // Y轴检测
        if (Math.abs(rayDirection.y) < 1e-8) {
            if (rayOrigin.y < rect.y || rayOrigin.y > rect.y + rect.height) {
                return null;
            }
        } else {
            let t1 = (rect.y - rayOrigin.y) / rayDirection.y;
            let t2 = (rect.y + rect.height - rayOrigin.y) / rayDirection.y;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        }

        if (tmin > tmax || tmax < 0) {
            return null;
        }

        return tmin >= 0 ? tmin : tmax;
    }
}