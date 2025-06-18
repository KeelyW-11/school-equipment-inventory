// QR Code 掃描器功能 - 優化版本
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
    
    this.init();
  }

  // 初始化掃描器
  async init() {
    console.log('初始化 QR 掃描器...');
    this.scannerElement = document.getElementById('qr-scanner');
    this.video = document.getElementById('qr-video');
    
    // 設定事件監聽器
    this.setupEventListeners();
    
    // 檢查相機權限
    await this.checkCameraPermission();
    
    console.log('QR 掃描器初始化完成');
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

    // 監聽自定義 QR 掃描事件
    document.addEventListener('qrScanResult', (event) => {
      this.handleScanResult(event.detail.data);
    });
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
        
        console.log(`找到 ${this.cameras.length} 個相機設備`);
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
    console.log('顯示 QR 掃描器');
    
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
    console.log('隱藏 QR 掃描器');
    
    if (this.scannerElement) {
      this.scannerElement.classList.remove('show');
      document.body.style.overflow = '';
    }
    
    this.stopScanning();
  }

  // 開始掃描
  async startScanning() {
    if (this.isScanning) {
      console.log('掃描器已在運行中');
      return;
    }

    try {
      this.updateScanStatus('正在啟動相機...');
      console.log('開始啟動 QR 掃描');
      
      // 停止現有的掃描
      if (this.scanner) {
        await this.scanner.stop();
        this.scanner.destroy();
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
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
          setTimeout(reject, 5000); // 5秒超時
        });

        await this.video.play();
        console.log('視頻流啟動成功');
      }

      // 初始化 QR 掃描器
      if (typeof QrScanner !== 'undefined' && this.video) {
        console.log('使用 QrScanner 庫初始化掃描器');
        
        this.scanner = new QrScanner(
          this.video,
          (result) => {
            console.log('QrScanner 掃描到結果:', result);
            this.handleScanResult(result);
          },
          {
            onDecodeError: (error) => {
              // 靜默處理解碼錯誤，避免控制台spam
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment',
            maxScansPerSecond: 2 // 限制掃描頻率
          }
        );

        await this.scanner.start();
        this.isScanning = true;
        this.updateScanStatus('請將 QR Code 對準掃描框');
        console.log('QR 掃描器啟動成功');
        
      } else {
        console.log('QrScanner 庫未載入，使用備用方案');
        this.startManualScanning();
      }

    } catch (error) {
      console.error('啟動相機失敗:', error);
      this.showError('啟動相機失敗：' + error.message);
    }
  }

  // 備用掃描方案
  startManualScanning() {
    console.log('啟動手動掃描模式');
    this.isScanning = true;
    this.updateScanStatus('正在掃描中...');
    
    // 提示用戶手動輸入
    setTimeout(() => {
      if (this.isScanning) {
        const manualInput = prompt('QR 掃描失敗，請手動輸入設備編號：');
        if (manualInput && manualInput.trim()) {
          this.handleScanResult(manualInput.trim());
        }
      }
    }, 3000);
  }

  // 停止掃描
  stopScanning() {
    console.log('停止 QR 掃描');
    this.isScanning = false;
    
    if (this.scanner) {
      this.scanner.stop();
      this.scanner.destroy();
      this.scanner = null;
    }

    // 停止視頻流
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }

  // 切換相機
  async switchCamera() {
    if (this.cameras.length <= 1) {
      this.showError('只有一個相機可用');
      return;
    }

    console.log('切換相機');
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
      console.log('掃描冷卻中，忽略重複掃描');
      return;
    }
    
    this.lastScanTime = currentTime;
    
    const scannedData = typeof result === 'string' ? result : result.data;
    
    if (!scannedData || !scannedData.trim()) {
      console.warn('掃描結果為空');
      this.updateScanStatus('掃描結果為空，請重新掃描');
      return;
    }
    
    const cleanData = scannedData.trim();
    console.log('處理 QR 掃描結果:', cleanData);
    
    // 震動反饋
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    // 播放提示音
    this.playBeep();

    // 顯示掃描成功訊息
    this.updateScanStatus(`掃描成功：${cleanData}`);

    // 立即處理掃描結果
    this.processQRResult(cleanData);
  }

  // 處理 QR 掃描結果 - 核心邏輯優化
  processQRResult(scannedData) {
    console.log('開始處理 QR 掃描結果:', scannedData);
    
    // 方法1: 直接調用 inventory 對象
    if (this.tryDirectInventoryCall(scannedData)) {
      this.scheduleHide();
      return;
    }

    // 方法2: 等待 inventory 載入
    this.waitForInventoryAndProcess(scannedData);
  }

  // 直接調用 inventory 方法
  tryDirectInventoryCall(scannedData) {
    if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
      try {
        console.log('直接調用 window.inventory.handleQRScan');
        window.inventory.handleQRScan(scannedData);
        return true;
      } catch (error) {
        console.error('直接調用失敗:', error);
        return false;
      }
    }
    return false;
  }

  // 等待 inventory 載入並處理
  waitForInventoryAndProcess(scannedData) {
    console.log('等待 inventory 對象載入...');
    
    let retryCount = 0;
    const maxRetries = 20; // 增加重試次數
    const retryInterval = 200; // 減少重試間隔
    
    const checkInventory = setInterval(() => {
      retryCount++;
      
      if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
        try {
          console.log(`重試成功 (第${retryCount}次): 調用 window.inventory.handleQRScan`);
          window.inventory.handleQRScan(scannedData);
          clearInterval(checkInventory);
          this.scheduleHide();
        } catch (error) {
          console.error('重試調用失敗:', error);
          clearInterval(checkInventory);
          this.fallbackProcessing(scannedData);
        }
      } else if (retryCount >= maxRetries) {
        console.warn('等待 inventory 對象載入超時');
        clearInterval(checkInventory);
        this.fallbackProcessing(scannedData);
      }
    }, retryInterval);
  }

  // 備用處理方法
  fallbackProcessing(scannedData) {
    console.log('使用備用處理方法:', scannedData);
    
    // 觸發自定義事件
    try {
      const event = new CustomEvent('qrScanned', {
        detail: { 
          data: scannedData,
          timestamp: new Date().toISOString()
        }
      });
      document.dispatchEvent(event);
      console.log('已觸發 qrScanned 事件');
    } catch (error) {
      console.error('觸發自定義事件失敗:', error);
    }
    
    // 存儲到 localStorage
    this.savePendingScan(scannedData);
    
    // 顯示錯誤訊息
    this.showError(`設備 ${scannedData} 已記錄，請檢查系統狀態`);
    
    this.scheduleHide();
  }

  // 存儲待處理的掃描
  savePendingScan(scannedData) {
    try {
      const pendingScans = JSON.parse(localStorage.getItem('pendingQRScans') || '[]');
      pendingScans.push({
        data: scannedData,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('pendingQRScans', JSON.stringify(pendingScans));
      console.log('已保存待處理掃描:', scannedData);
    } catch (error) {
      console.error('保存待處理掃描失敗:', error);
    }
  }

  // 排程隱藏掃描器
  scheduleHide() {
    setTimeout(() => {
      this.hide();
    }, 1500);
  }

  // 儲存掃描歷史
  saveScanHistory(data, processed) {
    try {
      const scanHistory = JSON.parse(localStorage.getItem('qrScanHistory') || '[]');
      scanHistory.push({
        data: data,
        timestamp: new Date().toISOString(),
        processed: processed
      });
      localStorage.setItem('qrScanHistory', JSON.stringify(scanHistory.slice(-50))); // 保留最近50筆
    } catch (error) {
      console.error('無法保存掃描歷史:', error);
    }
  }

  // 更新掃描狀態
  updateScanStatus(message) {
    const statusElement = document.getElementById('scan-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
    console.log('掃描狀態:', message);
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
      console.warn('無法播放提示音:', error);
    }
  }

  // 顯示錯誤訊息
  showError(message) {
    this.updateScanStatus(message);
    
    if (window.inventory && typeof window.inventory.showToast === 'function') {
      window.inventory.showToast(message, 'error');
    } else {
      console.error('QR Scanner Error:', message);
      alert(message); // 備用顯示方式
    }
  }

  // 清理方法
  destroy() {
    console.log('銷毀 QR 掃描器');
    this.stopScanning();
    
    // 移除事件監聽器
    document.removeEventListener('qrScanResult', this.handleScanResult);
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
  console.log('全域處理器收到 QR 掃描結果:', data);
  
  if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
    window.inventory.handleQRScan(data);
  } else {
    console.warn('inventory 對象未就緒，觸發備用事件');
    const event = new CustomEvent('qrScanned', { detail: { data } });
    document.dispatchEvent(event);
  }
}

// 初始化和事件監聽
document.addEventListener('DOMContentLoaded', () => {
  console.log('初始化 QR 掃描器管理器');
  
  // 初始化 QR 掃描器
  window.qrScanner = new QRScannerManager();
  
  // 監聽自定義 QR 掃描事件
  document.addEventListener('qrScanned', (event) => {
    console.log('收到 qrScanned 事件:', event.detail.data);
    
    const scannedData = event.detail.data;
    
    // 嘗試處理掃描結果
    const processResult = () => {
      if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
        console.log('透過事件監聽器處理掃描結果');
        window.inventory.handleQRScan(scannedData);
        return true;
      }
      return false;
    };
    
    // 立即嘗試處理
    if (!processResult()) {
      // 如果失敗，等待 inventory 載入
      const waitForInventory = setInterval(() => {
        if (processResult()) {
          clearInterval(waitForInventory);
        }
      }, 100);
      
      // 10秒後停止等待
      setTimeout(() => {
        clearInterval(waitForInventory);
        console.warn('等待 inventory 對象載入超時');
      }, 10000);
    }
  });
  
  // 處理待處理的掃描結果
  setTimeout(() => {
    const pendingScans = JSON.parse(localStorage.getItem('pendingQRScans') || '[]');
    if (pendingScans.length > 0) {
      console.log('處理', pendingScans.length, '個待處理的掃描結果');
      
      pendingScans.forEach(scan => {
        if (window.inventory && window.inventory.handleQRScan) {
          console.log('處理待處理掃描:', scan.data);
          window.inventory.handleQRScan(scan.data);
        }
      });
      
      // 清除已處理的掃描結果
      localStorage.removeItem('pendingQRScans');
    }
  }, 2000); // 等待主系統完全載入
});

// 頁面卸載時清理資源
window.addEventListener('beforeunload', () => {
  if (window.qrScanner) {
    window.qrScanner.destroy();
  }
});

// 匯出類別
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QRScannerManager;
}
