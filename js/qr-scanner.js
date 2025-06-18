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

    this.scannerElement.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    await this.startScanning();
  }

  // 隱藏掃描器
  hide() {
    this.scannerElement.classList.remove('show');
    document.body.style.overflow = '';
    
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
      this.video.srcObject = this.stream;
      
      // 等待視頻載入
      await new Promise((resolve) => {
        this.video.onloadedmetadata = resolve;
      });

      await this.video.play();

      // 初始化 QR 掃描器
      if (typeof QrScanner !== 'undefined') {
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
    
    if (!scannedData) return;
    
    // 震動反饋（如果支援）
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    // 播放提示音
    this.playBeep();

    // 顯示掃描成功訊息
    this.updateScanStatus(`掃描成功：${scannedData}`);

    // 傳遞結果給主系統
    if (window.inventory) {
      window.inventory.handleQRScan(scannedData);
    }

    // 短暫延遲後隱藏掃描器
    setTimeout(() => {
      this.hide();
    }, 1500);
  }

  // 更新掃描狀態
  updateScanStatus(message) {
    const statusElement = document.getElementById('scan-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
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
    if (window.showToast) {
      window.showToast(message, 'error');
    }
    
    console.error('QR Scanner Error:', message);
  }
}

// 全域函數
function closeQRScanner() {
  if (window.qrScanner) {
    window.qrScanner.hide();
  }
}

// 初始化 QR 掃描器
document.addEventListener('DOMContentLoaded', () => {
  window.qrScanner = new QRScannerManager();
});

// 匯出類別供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QRScannerManager;
}
