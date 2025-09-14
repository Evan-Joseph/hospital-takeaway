import { supabase } from '../lib/supabase';

/**
 * 自动关闭超时订单的定时任务
 */
export class OrderTimeoutManager {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * 启动定时检查超时订单
   * @param intervalMs 检查间隔（毫秒），默认5分钟
   */
  start(intervalMs: number = 5 * 60 * 1000) {
    if (this.isRunning) {
      console.log('OrderTimeoutManager is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting OrderTimeoutManager...');

    // 立即执行一次
    this.checkAndCloseExpiredOrders();

    // 设置定时器
    this.intervalId = setInterval(() => {
      this.checkAndCloseExpiredOrders();
    }, intervalMs);
  }

  /**
   * 停止定时检查
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('OrderTimeoutManager stopped');
  }

  /**
   * 检查并关闭超时订单
   */
  private async checkAndCloseExpiredOrders() {
    try {
      const now = new Date().toISOString();
      
      // 查找所有超时的待支付订单
      const { data: expiredOrders, error: selectError } = await supabase
        .from('orders')
        .select('id, order_number, auto_close_at')
        .eq('status', 'pending')
        .not('auto_close_at', 'is', null)
        .lt('auto_close_at', now);

      if (selectError) {
        console.error('Error fetching expired orders:', selectError);
        return;
      }

      if (!expiredOrders || expiredOrders.length === 0) {
        return;
      }

      console.log(`Found ${expiredOrders.length} expired orders to close`);

      // 批量更新超时订单状态
      const orderIds = expiredOrders.map(order => order.id);
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'timeout_closed',
          updated_at: now
        })
        .in('id', orderIds);

      if (updateError) {
        console.error('Error updating expired orders:', updateError);
        return;
      }

      console.log(`Successfully closed ${expiredOrders.length} expired orders:`, 
        expiredOrders.map(o => o.order_number));

    } catch (error) {
      console.error('Error in checkAndCloseExpiredOrders:', error);
    }
  }

  /**
   * 手动检查并关闭超时订单（用于测试）
   */
  async manualCheck() {
    await this.checkAndCloseExpiredOrders();
  }

  /**
   * 获取运行状态
   */
  get running() {
    return this.isRunning;
  }
}

// 创建全局实例
export const orderTimeoutManager = new OrderTimeoutManager();

// 在应用启动时自动开始检查
if (typeof window !== 'undefined') {
  // 浏览器环境下启动
  orderTimeoutManager.start();
  
  // 页面卸载时停止
  window.addEventListener('beforeunload', (): void => {
    orderTimeoutManager.stop();
  });
}