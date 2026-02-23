// main.js - Version đã xóa bảng giá
// WebSocket Configuration
const SOCKET_CONFIG = {
  TIMEOUT: 20000,
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  PAYMENT_TIMEOUT: 300000
};

/**
 * Socket Manager Class - Quản lý WebSocket connection
 */
class SocketManager {
  constructor() {
    this.socket = null;
    this.currentOrder = null;
    this.eventHandlers = new Map();
    this.isConnected = false;
  }

  /**
   * Khởi tạo WebSocket connection
   */
  init() {
    try {
      this.socket = io(`https://api.deargift.online`, {
        transports: ['websocket', 'polling'],
        timeout: SOCKET_CONFIG.TIMEOUT,
        reconnection: true,
        reconnectionDelay: SOCKET_CONFIG.RECONNECTION_DELAY,
        reconnectionAttempts: SOCKET_CONFIG.RECONNECTION_ATTEMPTS
      });

      this._setupEventListeners();
      return this.socket;
    } catch (error) {
      console.error('Lỗi khởi tạo WebSocket:', error);
      return null;
    }
  }

  /**
   * Thiết lập event listeners
   */
  _setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      this.isConnected = false;
    });
  }

  /**
   * Join vào room theo dõi order
   */
  joinOrder(orderCode) {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket chưa kết nối');
      return false;
    }

    if (this.currentOrder && this.currentOrder !== orderCode) {
      this.leaveOrder(this.currentOrder);
    }

    this.socket.emit('join-order', orderCode);
    this.currentOrder = orderCode;
    return true;
  }

  /**
   * Leave khỏi room
   */
  leaveOrder(orderCode) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('leave-order', orderCode);
    if (this.currentOrder === orderCode) {
      this.currentOrder = null;
    }
  }

  /**
   * Đăng ký event handler với cleanup
   */
  on(event, handler) {
    if (!this.socket) return;

    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);

    this.socket.on(event, handler);
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
    if (!this.socket) return;

    this.socket.off(event, handler);
    
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Cleanup tất cả event handlers
   */
  cleanup() {
    if (!this.socket) return;

    for (const [event, handlers] of this.eventHandlers) {
      handlers.forEach(handler => {
        this.socket.off(event, handler);
      });
    }
    this.eventHandlers.clear();

    if (this.currentOrder) {
      this.leaveOrder(this.currentOrder);
    }

    this.socket.disconnect();
    this.socket = null;
    this.currentOrder = null;
    this.isConnected = false;
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  isSocketConnected() {
    return this.socket && this.isConnected;
  }
}

// Tạo instance global
const socketManager = new SocketManager();

/**
 * Khởi tạo WebSocket connection
 */
function initWebSocket() {
  const socket = socketManager.init();
  window.socket = socketManager.socket;
  return socket;
}

// Khai báo global
if (typeof window !== 'undefined') {
  window.socketManager = socketManager;
  window.initWebSocket = initWebSocket;
}

// Khởi tạo WebSocket khi DOM ready
document.addEventListener('DOMContentLoaded', function() {
  if (window.initWebSocket) {
    window.initWebSocket();
  }
});


function initializePricingCalculator() {
    if (!pricingCalculator) {
        pricingCalculator = new PricingCalculator();
        window.pricingCalculator = pricingCalculator;
    }
}

// Export cho việc sử dụng global
window.initializePricingCalculator = initializePricingCalculator;

// Ẩn settings hint sau 3 giây
document.addEventListener('DOMContentLoaded', function() {
    const settingsHint = document.getElementById('settingsHint');
    if (settingsHint) {
        setTimeout(() => {
            settingsHint.style.display = 'none';
        }, 3000);
    }
    
    // Khởi tạo WebSocket connection
    if (window.initWebSocket) {
        window.initWebSocket();
        
        // Kiểm tra và tự động join lại order room nếu có payment đang pending
        const currentOrderCode = localStorage.getItem('current_order_code');
        const isPaymentInProgress = localStorage.getItem('payment_in_progress') === 'true';
        
        if (currentOrderCode && isPaymentInProgress && window.socketManager) {
            
            // Đợi WebSocket kết nối xong rồi mới join
            setTimeout(() => {
                if (window.socketManager.isSocketConnected()) {
                    window.socketManager.joinOrder(currentOrderCode);
                    
                    // Đăng ký listener cho payment status update
                    window.socketManager.on('payment_status_update', (data) => {
                        
                        if (data.status === 'PAID' && data.orderCode === currentOrderCode) {
                            
                            // Cleanup payment state
                            window.cleanupPaymentState(currentOrderCode);
                            
                            // Hiển thị kết quả thành công
                            if (window.pricingCalculator) {
                                window.pricingCalculator.showSuccessResult(data.websiteId || 'unknown', data.amount || 0);
                            }
                        }
                    });
                } else {
                    setTimeout(() => {
                        if (window.socketManager.isSocketConnected()) {
                            window.socketManager.joinOrder(currentOrderCode);
                        }
                    }, 2000);
                }
            }, 1000);
        }
    }
});
