// GitHub Pages QR 掃描修正版
// 將此代碼替換原本的 qr-scanner.js

class GitHubPagesQRScanner {
  constructor() {
    this.isScanning = false;
    this.video = null;
    this.stream = null;
    this.canvas = null;
    this.ctx = null;
    this.scanInterval = null;
    
    console.log('GitHub Pages QR Scanner 初始化');
    this.init();
  }

  init() {
    // 等待 DOM 載入
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupElements());
    } else {
      this.setupElements();
    }
  }

  setupElements() {
    this.video = document.getElementById('qr-video');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // 添加事件監聽器
    const switchBtn = document.getElementById('switch-camera');
    if (switchBtn) {
      switchBtn.onclick = () => this.switchCamera();
    }
    
    console.log('QR Scanner 元素設置完成');
  }

  async show() {
    console.log('顯示 QR 掃描器');
    const scanner = document.getElementById('qr-scanner');
    if (scanner) {
      scanner.classList.add('show');
    }
    
    // 立即顯示手動輸入選項，同時嘗試啟動相機
    this.showManualOption();
    
    // 嘗試啟動相機
    setTimeout(() => this.attemptCameraStart(), 500);
  }

  hide() {
    console.log('隱藏 QR 掃描器');
    const scanner = document.getElementById('qr-scanner');
    if (scanner) {
      scanner.classList.remove('show');
    }
    this.stopScanning();
  }

  showManualOption() {
    const status = document.getElementById('scan-status');
    if (status) {
      status.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p style="color: #007bff; margin-bottom: 15px;">📱 QR 掃描器</p>
          
          <button onclick="window.githubQRScanner.manualInput()" 
                  style="display: block; width: 200px; margin: 10px auto; 
                         padding: 15px; background: #007bff; color: white; 
                         border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
            ✏️ 手動輸入設備編號
          </button>
          
          <button onclick="window.githubQRScanner.attemptCameraStart()" 
                  style="display: block; width: 200px; margin: 10px auto; 
                         padding: 10px; background: #28a745; color: white; 
                         border: none; border-radius: 5px; font-size: 14px; cursor: pointer;">
            📹 嘗試啟動相機掃描
          </button>
          
          <div id="camera-status" style="margin-top: 15px; font-size: 14px; color: #666;">
            正在檢測相機...
          </div>
        </div>
      `;
    }
  }

  async attemptCameraStart() {
    const statusDiv = document.getElementById('camera-status');
    
    try {
      if (statusDiv) statusDiv.textContent = '正在啟動相機...';
      
      // 停止現有串流
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

      // 請求相機權限
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 }
        }
      });

      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
        
        if (statusDiv) statusDiv.textContent = '相機啟動成功！正在掃描...';
        
        this.isScanning = true;
        this.startScanLoop();
      }

    } catch (error) {
      console.error('相機啟動失敗:', error);
      if (statusDiv) {
        statusDiv.innerHTML = `
          <span style="color: #dc3545;">相機無法啟動: ${error.message}</span><br>
          <small>請使用手動輸入功能</small>
        `;
      }
    }
  }

  startScanLoop() {
    // 嘗試使用 QrScanner 庫
    if (typeof QrScanner !== 'undefined') {
      this.useQrScannerLib();
    } 
    // 嘗試使用 jsQR
    else if (typeof jsQR !== 'undefined') {
      this.useJsQR();
    } 
    // 使用基本檢測
    else {
      this.useBasicDetection();
    }
  }

  useQrScannerLib() {
    try {
      if (this.scanner) {
        this.scanner.destroy();
      }
      
      this.scanner = new QrScanner(this.video, (result) => {
        this.handleScanSuccess(result);
      }, {
        returnDetailedScanResult: true,
        maxScansPerSecond: 1
      });
      
      this.scanner.start();
      console.log('使用 QrScanner 庫');
      
    } catch (error) {
      console.error('QrScanner 失敗:', error);
      this.useJsQR();
    }
  }

  useJsQR() {
    console.log('使用 jsQR 庫');
    
    const scan = () => {
      if (!this.isScanning) return;
      
      try {
        this.canvas.width = this.video.videoWidth || 640;
        this.canvas.height = this.video.videoHeight || 480;
        
        if (this.canvas.width > 0 && this.video.readyState === 4) {
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
          
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            this.handleScanSuccess(code.data);
            return;
          }
        }
      } catch (error) {
        console.error('jsQR 掃描錯誤:', error);
      }
      
      this.scanInterval = setTimeout(scan, 800);
    };
    
    scan();
  }

  useBasicDetection() {
    console.log('使用基本檢測');
    const statusDiv = document.getElementById('camera-status');
    if (statusDiv) {
      statusDiv.innerHTML = '相機已啟動，但自動掃描不可用<br>請使用手動輸入';
    }
  }

  handleScanSuccess(result) {
    const data = typeof result === 'string' ? result : (result.data || result);
    
    console.log('掃描成功:', data);
    
    // 停止掃描
    this.stopScanning();
    
    // 處理結果
    this.processQRData(data);
  }

  processQRData(data) {
    console.log('處理 QR 資料:', data);
    
    // 更新狀態顯示
    const statusDiv = document.getElementById('camera-status');
    if (statusDiv) {
      statusDiv.innerHTML = `<span style="color: #28a745;">掃描成功！設備: ${data}</span>`;
    }
    
    // 等待 inventory 系統就緒
    this.waitForInventorySystem(data);
  }

  waitForInventorySystem(data, attempts = 0) {
    if (window.inventory && window.inventory.isReady) {
      console.log('Inventory 系統就緒，處理掃描結果');
      const success = window.inventory.handleQRScan(data);
      
      if (success) {
        // 震動反饋
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        
        // 2秒後關閉掃描器
        setTimeout(() => this.hide(), 2000);
      }
      
    } else if (attempts < 20) {
      // 繼續等待
      setTimeout(() => this.waitForInventorySystem(data, attempts + 1), 500);
    } else {
      console.error('Inventory 系統未就緒');
      alert(`掃描到設備編號：${data}\n請手動更新設備狀態`);
      this.hide();
    }
  }

  manualInput() {
    const input = prompt('請輸入設備編號：\n\n範例：314010102-300933');
    if (input && input.trim()) {
      this.processQRData(input.trim());
    }
  }

  switchCamera() {
    if (this.isScanning) {
      this.stopScanning();
      setTimeout(() => this.attemptCameraStart(), 1000);
    }
  }

  stopScanning() {
    this.isScanning = false;
    
    if (this.scanInterval) {
      clearTimeout(this.scanInterval);
      this.scanInterval = null;
    }
    
    if (this.scanner) {
      try {
        this.scanner.stop();
        this.scanner.destroy();
      } catch (error) {
        console.error('停止掃描器錯誤:', error);
      }
      this.scanner = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }
}

// 全域函數
function closeQRScanner() {
  if (window.githubQRScanner) {
    window.githubQRScanner.hide();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('初始化 GitHub Pages QR Scanner');
  window.githubQRScanner = new GitHubPagesQRScanner();
  
  // 兼容原有的 qrScanner 變數
  window.qrScanner = window.githubQRScanner;
});

console.log('GitHub Pages QR Scanner 腳本載入完成');
