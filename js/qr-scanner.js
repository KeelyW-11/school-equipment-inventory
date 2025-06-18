// QR Code 掃描器功能 - 修復版本
class QRScannerManager {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.video = null;
    this.cameras = [];
    this.currentCameraIndex = 0;
    this.scannerElement = null;
    this.stream = null;
    this.lastScanTime = 0;
    this.scanCooldown = 2000; // 2秒冷卻時間，避免重複掃描
    this.initializationRetry = 0;
    this.maxInitRetries = 3;
    
    this.init();
  }

  // 初始化掃描器
  async init() {
    console.log('🔧 初始化 QR 掃描器...');
    this.scannerElement = document.getElementById('qr-scanner');
    this.video = document.getElementById('qr-video');
    
    if (!this.scannerElement || !this.video) {
      console.error('❌ QR 掃描器 DOM 元素未找到');
      return;
    }
    
    // 設定事件監聽器
    this.setupEventListeners();
    
    // 檢查相機權限
    await this.checkCameraPermission();
    
    console.log('✅ QR 掃描器初始化完成');
  }

  // 設定事件監聽器
  setupEventListeners() {
    // 切換相機按鈕
    const switchCameraBtn = document.getElementById('switch-camera');
    if (switchCameraBtn) {
      switchCameraBtn.addEventListener('click', () => this.switchCamera());
    }

    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isScanning) {
        this.hide();
      }
    });

    // 關閉按鈕事件
    const closeBtn = document.querySelector('.close-scanner');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  // 檢查相機權限
  async checkCameraPermission() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // 獲取相機列表
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.cameras = devices.filter(device => device.kind === 'videoinput');
        
        if (this.cameras.length === 0) {
          this.showError('未找到可用的相機設備');
          return false;
        }
        
        console.log(`📷 找到 ${this.cameras.length} 個相機設備`);
        return true;
      } else {
        this.showError('您的瀏覽器不支援相機功能');
        return false;
      }
    } catch (error) {
      this.showError('無法訪問相機：' + error.message);
      return false;
    }
  }

  // 顯示掃描器
  async show() {
    console.log('📱 顯示 QR 掃描器');
    
    if (!await this.checkCameraPermission()) {
      return;
    }

    if (this.scannerElement) {
      this.scannerElement.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    
    await this.startScanning();
  }

  // 隱藏掃描器
  hide() {
    console.log('❌ 隱藏 QR 掃描器');
    
    if (this.scannerElement) {
      this.scannerElement.classList.remove('show');
      document.body.style.overflow = '';
    }
    
    this.stopScanning();
  }

  // 開始掃描
  async startScanning() {
    if (this.isScanning) {
      console.log('⚠️ 掃描器已在運行中');
      return;
    }

    try {
      this.updateScanStatus('🔄 正在啟動相機...');
      console.log('🚀 開始啟動 QR 掃描');
      
      // 停止現有的掃描
      if (this.scanner) {
        try {
          await this.scanner.stop();
          this.scanner.destroy();
        } catch (e) {
          console.warn('⚠️ 停止舊掃描器時發生錯誤:', e);
        }
        this.scanner = null;
      }

      // 停止現有的視頻流
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

      // 設定相機約束
      const constraints = {
        video: {
          facingMode: this.currentCameraIndex === 0 ? 'environment' : 'user',
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      };

      // 如果有特定的相機設備
      if (this.cameras[this.currentCameraIndex]) {
        constraints.video.deviceId = { exact: this.cameras[this.currentCameraIndex].deviceId };
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.video) {
        this.video.srcObject = this.stream;
        
        // 等待視頻載入
        await new Promise((resolve, reject) => {
          this.video.onloadedmetadata = resolve;
          this.video.onerror = reject;
          setTimeout(() => reject(new Error('視頻載入超時')), 10000); // 10秒超時
        });

        await this.video.play();
        console.log('📹 視頻流啟動成功');
      }

      // 初始化 QR 掃描器
      await this.initializeQRScanner();

    } catch (error) {
      console.error('❌ 啟動相機失敗:', error);
      this.handleScannerError(error);
    }
  }

  // 初始化 QR 掃描器
  async initializeQRScanner() {
    try {
      if (typeof QrScanner !== 'undefined' && this.video) {
        console.log('🔍 使用 QrScanner 庫初始化掃描器');
        
        this.scanner = new QrScanner(
          this.video,
          (result) => {
            console.log('📊 QrScanner 掃描到結果:', result);
            this.handleScanResult(result);
          },
          {
            onDecodeError: (error) => {
              // 靜默處理解碼錯誤，避免控制台spam
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment',
            maxScansPerSecond: 1, // 降低掃描頻率
            returnDetailedScanResult: true
          }
        );

        await this.scanner.start();
        this.isScanning = true;
        this.updateScanStatus('📱 請將 QR Code 對準掃描框');
        console.log('✅ QR 掃描器啟動成功');
        
      } else {
        console.log('⚠️ QrScanner 庫未載入，使用備用方案');
        await this.startFallbackScanning();
      }
    } catch (error) {
      console.error('❌ 初始化 QR 掃描器失敗:', error);
      await this.startFallbackScanning();
    }
  }

  // 備用掃描方案
  async startFallbackScanning() {
    console.log('🔧 啟動備用掃描模式');
    this.isScanning = true;
    this.updateScanStatus('🔍 備用掃描模式 - 點擊手動輸入');
    
    // 添加點擊事件進行手動輸入
    if (this.video) {
      this.video.onclick = () => this.manualInput();
    }
    
    // 3秒後提示手動輸入
    setTimeout(() => {
      if (this.isScanning) {
        this.updateScanStatus('📝 自動掃描失敗，點擊螢幕手動輸入設備編號');
      }
    }, 3000);
  }

  // 手動輸入
  manualInput() {
    const manualInput = prompt('請手動輸入設備編號：');
    if (manualInput && manualInput.trim()) {
      this.handleScanResult(manualInput.trim());
    }
  }

  // 停止掃描
  stopScanning() {
    console.log('🛑 停止 QR 掃描');
    this.isScanning = false;
    
    if (this.scanner) {
      try {
        this.scanner.stop();
        this.scanner.destroy();
      } catch (e) {
        console.warn('⚠️ 停止掃描器時發生錯誤:', e);
      }
      this.scanner = null;
    }

    // 停止視頻流
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video.onclick = null;
    }
  }

  // 切換相機
  async switchCamera() {
    if (this.cameras.length <= 1) {
      this.showError('只有一個相機可用');
      return;
    }

    console.log('🔄 切換相機');
    this.currentCameraIndex = (this.currentCameraIndex + 1) % this.cameras.length;
    
    if (this.isScanning) {
      this.stopScanning();
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.startScanning();
    }
  }

  // 處理掃描結果 - 主要優化點
  handleScanResult(result) {
    const currentTime = Date.now();
    
    // 防止重複掃描
    if (currentTime - this.lastScanTime < this.scanCooldown) {
      console.log('⏳ 掃描冷卻中，忽略重複掃描');
      return;
    }
    
    this.lastScanTime = currentTime;
    
    const scannedData = typeof result === 'string' ? result : 
                       (result.data || result.text || result);
    
    if (!scannedData || !scannedData.toString().trim()) {
      console.warn('⚠️ 掃描結果為空');
      this.updateScanStatus('❌ 掃描結果為空，請重新掃描');
      return;
    }
    
    const cleanData = scannedData.toString().trim();
    console.log('🎯 處理 QR 掃描結果:', cleanData);
    
    // 震動反饋
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    // 播放提示音
    this.playBeep();

    // 顯示掃描成功訊息
    this.updateScanStatus(`✅ 掃描成功：${cleanData}`);

    // 立即處理掃描結果
    this.processQRResult(cleanData);
  }

  // 處理 QR 掃描結果 - 核心邏輯優化
  processQRResult(scannedData) {
    console.log('🔄 開始處理 QR 掃描結果:', scannedData);
    
    // 確保 inventory 系統已載入並就緒
    if (this.isInventoryReady()) {
      console.log('✅ inventory 系統就緒，直接處理');
      this.handleWithInventory(scannedData);
      this.scheduleHide();
      return;
    }

    // 等待 inventory 系統載入
    console.log('⏳ 等待 inventory 系統載入...');
    this.waitForInventoryAndProcess(scannedData);
  }

  // 檢查 inventory 是否就緒
  isInventoryReady() {
    return window.inventory && 
           window.inventory.isReady && 
           typeof window.inventory.handleQRScan === 'function' &&
           Array.isArray(window.inventory.data) &&
           window.inventory.data.length > 0;
  }

  // 使用 inventory 處理掃描結果
  handleWithInventory(scannedData) {
    try {
      console.log('📞 調用 window.inventory.handleQRScan');
      const result = window.inventory.handleQRScan(scannedData);
      
      if (result) {
        console.log('✅ QR 掃描處理成功');
      } else {
        console.log('⚠️ QR 掃描處理返回 false');
      }
      
      return result;
    } catch (error) {
      console.error('❌ 調用 inventory.handleQRScan 失敗:', error);
      this.fallbackProcessing(scannedData);
      return false;
    }
  }

  // 等待 inventory 載入並處理
  waitForInventoryAndProcess(scannedData) {
    let retryCount = 0;
    const maxRetries = 50; // 增加重試次數到 50 次
    const retryInterval = 100; // 減少重試間隔到 100ms
    
    const checkInventory = setInterval(() => {
      retryCount++;
      
      if (this.isInventoryReady()) {
        console.log(`✅ 重試成功 (第${retryCount}次): inventory 系統已載入`);
        clearInterval(checkInventory);
        this.handleWithInventory(scannedData);
        this.scheduleHide();
      } else if (retryCount >= maxRetries) {
        console.warn('⚠️ 等待 inventory 系統載入超時');
        clearInterval(checkInventory);
        this.fallbackProcessing(scannedData);
        this.scheduleHide();
      } else if (retryCount % 10 === 0) {
        // 每 10 次重試輸出一次狀態
        console.log(`⏳ 等待中... (${retryCount}/${maxRetries})`);
        if (window.inventory) {
          console.log('inventory 狀態:', {
            exists: !!window.inventory,
            isReady: window.inventory.isReady,
            hasHandleQRScan: typeof window.inventory.handleQRScan === 'function',
            dataLength: window.inventory.data ? window.inventory.data.length : 0
          });
        }
      }
    }, retryInterval);
  }

  // 備用處理方法
  fallbackProcessing(scannedData) {
    console.log('🔧 使用備用處理方法:', scannedData);
    
    // 方法1: 觸發自定義事件
    this.triggerQREvent(scannedData);
    
    // 方法2: 存儲到 localStorage
    this.savePendingScan(scannedData);
    
    // 方法3: 嘗試直接訪問 DOM 更新
    this.tryDirectDOMUpdate(scannedData);
    
    // 顯示訊息
    this.showError(`📝 設備 ${scannedData} 已記錄，請檢查系統狀態`);
  }

  // 觸發自定義事件
  triggerQREvent(scannedData) {
    try {
      const event = new CustomEvent('qrScanned', {
        detail: { 
          data: scannedData,
          timestamp: new Date().toISOString(),
          source: 'qr-scanner'
        },
        bubbles: true,
        cancelable: true
      });
      
      document.dispatchEvent(event);
      window.dispatchEvent(event);
      
      console.log('📡 已觸發 qrScanned 事件');
    } catch (error) {
      console.error('❌ 觸發自定義事件失敗:', error);
    }
  }

  // 存儲待處理的掃描
  savePendingScan(scannedData) {
    try {
      const pendingScans = JSON.parse(localStorage.getItem('pendingQRScans') || '[]');
      
      // 避免重複記錄
      const isDuplicate = pendingScans.some(scan => 
        scan.data === scannedData && 
        (Date.now() - new Date(scan.timestamp).getTime()) < 30000 // 30秒內的重複
      );
      
      if (!isDuplicate) {
        pendingScans.push({
          data: scannedData,
          timestamp: new Date().toISOString()
        });
        
        // 只保留最近的 10 筆記錄
        if (pendingScans.length > 10) {
          pendingScans.splice(0, pendingScans.length - 10);
        }
        
        localStorage.setItem('pendingQRScans', JSON.stringify(pendingScans));
        console.log('💾 已保存待處理掃描:', scannedData);
      } else {
        console.log('⚠️ 跳過重複的掃描記錄:', scannedData);
      }
    } catch (error) {
      console.error('❌ 保存待處理掃描失敗:', error);
    }
  }

  // 嘗試直接 DOM 更新
  tryDirectDOMUpdate(scannedData) {
    try {
      // 查找對應的設備行並高亮
      const table = document.querySelector('#equipment-table tbody');
      if (table) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const idCell = row.querySelector('td:nth-child(2) strong');
          if (idCell && idCell.textContent.trim() === scannedData) {
            // 高亮顯示
            row.style.backgroundColor = '#fff3cd';
            row.style.border = '2px solid #ffc107';
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 3秒後移除高亮
            setTimeout(() => {
              row.style.backgroundColor = '';
              row.style.border = '';
            }, 3000);
            
            console.log('✅ 直接 DOM 高亮成功:', scannedData);
            break;
          }
        }
      }
    } catch (error) {
      console.error('❌ 直接 DOM 更新失敗:', error);
    }
  }

  // 處理掃描器錯誤
  handleScannerError(error) {
    this.initializationRetry++;
    
    if (this.initializationRetry < this.maxInitRetries) {
      console.log(`🔄 重試初始化掃描器 (${this.initializationRetry}/${this.maxInitRetries})`);
      setTimeout(() => {
        this.startScanning();
      }, 2000);
    } else {
      console.error('❌ 掃描器初始化失敗，啟用手動模式');
      this.updateScanStatus('❌ 相機啟動失敗，點擊進行手動輸入');
      
      // 添加手動輸入按鈕
      const statusElement = document.getElementById('scan-status');
      if (statusElement) {
        statusElement.innerHTML = `
          ❌ 相機啟動失敗<br>
          <button onclick="window.qrScanner.manualInput()" 
                  style="margin-top: 10px; padding: 10px 20px; 
                         background: #007bff; color: white; 
                         border: none; border-radius: 5px; cursor: pointer;">
            手動輸入設備編號
          </button>
        `;
      }
    }
  }

  // 排程隱藏掃描器
  scheduleHide() {
    setTimeout(() => {
      this.hide();
    }, 2000); // 增加到 2 秒讓用戶看到結果
  }

  // 更新掃描狀態
  updateScanStatus(message) {
    const statusElement = document.getElementById('scan-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
    console.log('📊 掃描狀態:', message);
  }

  // 播放提示音
  playBeep() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('⚠️ 無法播放提示音:', error);
    }
  }

  // 顯示錯誤訊息
  showError(message) {
    this.updateScanStatus(message);
    
    if (window.inventory && typeof window.inventory.showToast === 'function') {
      window.inventory.showToast(message, 'error');
    } else {
      console.error('QR Scanner Error:', message);
    }
  }

  // 清理方法
  destroy() {
    console.log('🗑️ 銷毀 QR 掃描器');
    this.stopScanning();
  }
}

// 全域函數
function closeQRScanner() {
  if (window.qrScanner) {
    window.qrScanner.hide();
  }
}

// 全域 QR 掃描結果處理函數
function handleQRScanResult(data) {
  console.log('🌐 全域處理器收到 QR 掃描結果:', data);
  
  if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
    window.inventory.handleQRScan(data);
  } else {
    console.warn('⚠️ inventory 對象未就緒，觸發備用事件');
    const event = new CustomEvent('qrScanned', { 
      detail: { 
        data: data,
        timestamp: new Date().toISOString(),
        source: 'global-handler'
      } 
    });
    document.dispatchEvent(event);
  }
}

// 初始化和事件監聽
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 初始化 QR 掃描器管理器');
  
  // 等待一段時間再初始化，確保 DOM 完全載入
  setTimeout(() => {
    try {
      window.qrScanner = new QRScannerManager();
      console.log('✅ QR 掃描器管理器初始化完成');
    } catch (error) {
      console.error('❌ QR 掃描器初始化失敗:', error);
      
      // 備用初始化
      setTimeout(() => {
        try {
          window.qrScanner = new QRScannerManager();
          console.log('🔄 QR 掃描器備用初始化完成');
        } catch (e) {
          console.error('❌ QR 掃描器備用初始化也失敗:', e);
        }
      }, 2000);
    }
  }, 500);
  
  // 監聽自定義 QR 掃描事件
  document.addEventListener('qrScanned', (event) => {
    console.log('📡 收到 qrScanned 事件:', event.detail);
    
    const scannedData = event.detail.data;
    
    // 嘗試處理掃描結果
    const processResult = () => {
      if (window.inventory && 
          window.inventory.isReady && 
          typeof window.inventory.handleQRScan === 'function') {
        console.log('✅ 透過事件監聽器處理掃描結果');
        window.inventory.handleQRScan(scannedData);
        return true;
      }
      return false;
    };
    
    // 立即嘗試處理
    if (!processResult()) {
      // 如果失敗，等待 inventory 載入
      let retryCount = 0;
      const maxRetries = 30;
      
      const waitForInventory = setInterval(() => {
        retryCount++;
        
        if (processResult()) {
          clearInterval(waitForInventory);
          console.log(`✅ 事件監聽器重試成功 (第${retryCount}次)`);
        } else if (retryCount >= maxRetries) {
          clearInterval(waitForInventory);
          console.warn('⚠️ 事件監聽器等待 inventory 對象載入超時');
        }
      }, 200);
    }
  });
});

// 頁面卸載時清理資源
window.addEventListener('beforeunload', () => {
  if (window.qrScanner) {
    window.qrScanner.destroy();
  }
});

// 匯出類別（如果在模組環境中）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QRScannerManager;
}

// 將類別掛載到全域供其他腳本使用
window.QRScannerManager = QRScannerManager;
