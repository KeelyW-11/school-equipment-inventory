// QR Code 掃描器功能
class QRScannerManager {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.video = null;
    this.cameras = [];
    this.currentCameraIndex = 0;
    this.scannerElement = null;
    this.stream = null;
    
    this.init();
  }

  // 初始化掃描器
  async init() {
    this.scannerElement = document.getElementById('qr-scanner');
    this.video = document.getElementById('qr-video');
    
    // 設定事件監聽器
    this.setupEventListeners();
    
    // 檢查相機權限
    await this.checkCameraPermission();
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
    if (this.scannerElement) {
      this.scannerElement.classList.remove('show');
      document.body.style.overflow = '';
    }
    
    this.stopScanning();
  }

  // 開始掃描
  async startScanning() {
    if (this.isScanning) return;

    try {
      this.updateScanStatus('正在啟動相機...');
      
      // 停止現有的掃描
      if (this.scanner) {
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
        await new Promise((resolve) => {
          this.video.onloadedmetadata = resolve;
        });

        await this.video.play();
      }

      // 初始化 QR 掃描器
      if (typeof QrScanner !== 'undefined' && this.video) {
        this.scanner = new QrScanner(
          this.video,
          (result) => this.handleScanResult(result),
          {
            onDecodeError: (error) => {
              // 靜默處理解碼錯誤
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: 'environment'
          }
        );

        await this.scanner.start();
        this.isScanning = true;
        this.updateScanStatus('請將 QR Code 對準掃描框');
        
      } else {
        // 如果 QrScanner 庫未載入，使用備用方案
        this.startManualScanning();
      }

    } catch (error) {
      console.error('啟動相機失敗:', error);
      this.showError('啟動相機失敗：' + error.message);
    }
  }

  // 備用掃描方案（使用 Canvas）
  startManualScanning() {
    this.isScanning = true;
    this.updateScanStatus('正在掃描中...');
    
    // 創建 Canvas 進行圖像處理
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    const scanInterval = setInterval(() => {
      if (!this.isScanning) {
        clearInterval(scanInterval);
        return;
      }
      
      try {
        if (this.video && this.video.videoWidth > 0) {
          canvas.width = this.video.videoWidth;
          canvas.height = this.video.videoHeight;
          context.drawImage(this.video, 0, 0);
          
          // 這裡可以加入其他 QR 解碼庫的邏輯
          // 例如使用 jsQR 庫
          if (typeof jsQR !== 'undefined') {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
              this.handleScanResult(code.data);
              clearInterval(scanInterval);
            }
          }
        }
      } catch (error) {
        // 忽略掃描錯誤
      }
    }, 500);
  }

  // 停止掃描
  stopScanning() {
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

    this.currentCameraIndex = (this.currentCameraIndex + 1) % this.cameras.length;
    
    if (this.isScanning) {
      this.stopScanning();
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待停止完成
      await this.startScanning();
    }
  }

  // 處理掃描結果
  handleScanResult(result) {
    const scannedData = typeof result === 'string' ? result : result.data;
    
    if (!scannedData) {
      console.warn('掃描結果為空');
      return;
    }
    
    console.log('QR 掃描結果:', scannedData);
    
    // 震動反饋（如果支援）
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    // 播放提示音
    this.playBeep();

    // 顯示掃描成功訊息
    this.updateScanStatus(`掃描成功：${scannedData}`);

    // 處理掃描結果
    this.processQRResult(scannedData);

    // 短暫延遲後隱藏掃描器
    setTimeout(() => {
      this.hide();
    }, 1500);
  }

  // 處理 QR 掃描結果
  processQRResult(scannedData) {
    let processed = false;
    
    // 清理掃描數據（移除可能的空白字符）
    const cleanData = scannedData.trim();
    console.log('處理 QR 掃描結果:', cleanData);

    // 方法1: 直接調用全域 inventory 對象
    if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
      try {
        console.log('使用 window.inventory.handleQRScan 處理結果');
        window.inventory.handleQRScan(cleanData);
        processed = true;
      } catch (error) {
        console.error('window.inventory.handleQRScan 執行失敗:', error);
      }
    }

    // 方法2: 等待 inventory 對象載入後再處理
    if (!processed && !window.inventory) {
      console.log('inventory 對象尚未載入，等待後重試...');
      let retryCount = 0;
      const maxRetries = 10;
      
      const retryInterval = setInterval(() => {
        retryCount++;
        if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
          try {
            console.log(`重試成功 (第${retryCount}次): 使用 window.inventory.handleQRScan`);
            window.inventory.handleQRScan(cleanData);
            processed = true;
            clearInterval(retryInterval);
          } catch (error) {
            console.error('重試時執行失敗:', error);
            clearInterval(retryInterval);
          }
        } else if (retryCount >= maxRetries) {
          console.warn('重試次數已達上限，inventory 對象仍未載入');
          clearInterval(retryInterval);
          this.fallbackProcessing(cleanData);
        }
      }, 200); // 每200ms重試一次
      
      return; // 退出，等待重試結果
    }

    // 方法3: 觸發自定義事件供主系統監聽
    if (!processed) {
      try {
        console.log('觸發 qrScanned 自定義事件');
        const event = new CustomEvent('qrScanned', {
          detail: { 
            data: cleanData,
            timestamp: new Date().toISOString()
          }
        });
        document.dispatchEvent(event);
        processed = true;
      } catch (error) {
        console.error('觸發自定義事件失敗:', error);
      }
    }

    // 記錄掃描歷史
    this.saveScanHistory(cleanData, processed);

    if (!processed) {
      console.warn('QR 掃描結果未被處理:', cleanData);
      this.showError(`無法處理設備編號：${cleanData}`);
    }
  }

  // 備用處理方法
  fallbackProcessing(scannedData) {
    console.log('使用備用處理方法:', scannedData);
    
    // 存儲到 localStorage 供主系統稍後處理
    const pendingScans = JSON.parse(localStorage.getItem('pendingQRScans') || '[]');
    pendingScans.push({
      data: scannedData,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('pendingQRScans', JSON.stringify(pendingScans));
    
    this.showError(`找不到設備 ${scannedData}，已暫存待處理`);
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
      localStorage.setItem('qrScanHistory', JSON.stringify(scanHistory.slice(-20))); // 保留最近20筆
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
      // 使用 Web Audio API 播放提示音
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
      // 如果無法播放音效就跳過
      console.warn('無法播放提示音:', error);
    }
  }

  // 顯示錯誤訊息
  showError(message) {
    this.updateScanStatus(message);
    
    // 同時顯示 Toast 通知
    if (window.inventory && typeof window.inventory.showToast === 'function') {
      window.inventory.showToast(message, 'error');
    } else {
      console.error('QR Scanner Error:', message);
    }
  }
}

// 全域函數
function closeQRScanner() {
  if (window.qrScanner) {
    window.qrScanner.hide();
  }
}

// 全域 QR 掃描結果處理函數（備用）
function handleQRScanResult(data) {
  console.log('全域處理器收到 QR 掃描結果:', data);
  
  if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
    window.inventory.handleQRScan(data);
  } else if (window.inventory && typeof window.inventory.showToast === 'function') {
    window.inventory.showToast(`QR 掃描成功：${data}`, 'success');
  }
}

// 監聽自定義事件 - 與設備盤點系統整合
document.addEventListener('qrScanned', (event) => {
  console.log('收到 qrScanned 事件:', event.detail.data);
  
  const scannedData = event.detail.data;
  
  // 如果 inventory 對象已載入，直接處理
  if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
    window.inventory.handleQRScan(scannedData);
  } else {
    // 否則等待載入
    console.log('等待 inventory 對象載入...');
    const checkInventory = setInterval(() => {
      if (window.inventory && typeof window.inventory.handleQRScan === 'function') {
        window.inventory.handleQRScan(scannedData);
        clearInterval(checkInventory);
      }
    }, 100);
    
    // 10秒後停止等待
    setTimeout(() => {
      clearInterval(checkInventory);
      console.warn('等待 inventory 對象載入超時');
    }, 10000);
  }
});

// 處理待處理的掃描結果
document.addEventListener('DOMContentLoaded', () => {
  // 初始化 QR 掃描器
  window.qrScanner = new QRScannerManager();
  
  // 處理之前未處理的掃描結果
  setTimeout(() => {
    const pendingScans = JSON.parse(localStorage.getItem('pendingQRScans') || '[]');
    if (pendingScans.length > 0 && window.inventory) {
      console.log('處理待處理的掃描結果:', pendingScans);
      
      pendingScans.forEach(scan => {
        if (window.inventory.handleQRScan) {
          window.inventory.handleQRScan(scan.data);
        }
      });
      
      // 清除已處理的掃描結果
      localStorage.removeItem('pendingQRScans');
    }
  }, 1000); // 等待主系統載入完成
});

// 匯出類別供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QRScannerManager;
}
