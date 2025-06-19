// QR Code 掃描器功能 - 修正版
class QRScannerManager {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.video = null;
    this.stream = null;
    this.lastScanTime = 0;
    this.scanCooldown = 2000; // 2秒冷卻時間
    this.facingMode = 'environment'; // 預設後置鏡頭
    
    console.log('QRScannerManager 建構中...');
    this.init();
  }

  init() {
    console.log('QR 掃描器初始化中...');
    
    // 等待 DOM 元素載入
    setTimeout(() => {
      this.video = document.getElementById('qr-video');
      this.setupEventListeners();
      console.log('QR 掃描器初始化完成');
    }, 500);
  }

  setupEventListeners() {
    // 切換鏡頭按鈕
    const switchCameraBtn = document.getElementById('switch-camera');
    if (switchCameraBtn) {
      switchCameraBtn.addEventListener('click', () => this.switchCamera());
    }

    // 關閉按鈕們
    document.querySelectorAll('.close-scanner, [onclick*="closeQRScanner"]').forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    console.log('QR 掃描器事件監聽器設定完成');
  }

  async show() {
    console.log('顯示 QR 掃描器');
    
    const scannerElement = document.getElementById('qr-scanner');
    if (scannerElement) {
      scannerElement.classList.add('show');
    }
    
    await this.startScanning();
  }

  hide() {
    console.log('隱藏 QR 掃描器');
    
    const scannerElement = document.getElementById('qr-scanner');
    if (scannerElement) {
      scannerElement.classList.remove('show');
    }
    
    this.stopScanning();
  }

  async startScanning() {
    if (this.isScanning) {
      console.log('已在掃描中，跳過');
      return;
    }

    try {
      this.updateStatus('正在啟動相機...');
      
      // 停止現有視頻流
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

      // 請求相機權限
      const constraints = {
        video: { 
          facingMode: this.facingMode,
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      };

      console.log('請求相機權限，約束條件:', constraints);
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.video) {
        this.video.srcObject = this.stream;
        
        // 等待視頻載入
        await new Promise((resolve) => {
          this.video.addEventListener('loadedmetadata', resolve, { once: true });
        });
        
        await this.video.play();
        
        this.updateStatus('請將 QR Code 對準掃描框');
        this.isScanning = true;
        
        // 開始掃描循環
        this.startScanLoop();
        
        console.log('相機啟動成功');
      }

    } catch (error) {
      console.error('啟動相機失敗:', error);
      this.handleCameraError(error);
    }
  }

  handleCameraError(error) {
    let message = '相機啟動失敗';
    
    if (error.name === 'NotAllowedError') {
      message = '請允許相機權限後重試';
    } else if (error.name === 'NotFoundError') {
      message = '找不到相機設備';
    } else if (error.name === 'NotReadableError') {
      message = '相機正被其他應用程式使用';
    }
    
    this.updateStatus(message);
    this.showManualInput();
  }

  startScanLoop() {
    if (!this.isScanning) return;

    // 檢查 QrScanner 是否可用
    if (typeof QrScanner !== 'undefined') {
      try {
        console.log('使用 QrScanner 庫');
        
        this.scanner = new QrScanner(
          this.video,
          (result) => this.handleScanResult(result),
          {
            returnDetailedScanResult: true,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 1,
            calculateScanRegion: () => ({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 })
          }
        );
        
        this.scanner.start().then(() => {
          console.log('QrScanner 啟動成功');
          this.updateStatus('請將 QR Code 對準掃描框中央');
        }).catch(error => {
          console.error('QrScanner 啟動失敗:', error);
          this.fallbackScanMethod();
        });
        
      } catch (error) {
        console.error('QrScanner 初始化失敗:', error);
        this.fallbackScanMethod();
      }
    } else {
      console.log('QrScanner 庫未載入，使用 Canvas 掃描');
      this.canvasScanMethod();
    }
  }

  // 新增 Canvas 掃描方法
  canvasScanMethod() {
    console.log('開始 Canvas 掃描方法');
    this.updateStatus('正在掃描，請將 QR Code 對準畫面中央');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const scanLoop = () => {
      if (!this.isScanning) return;
      
      try {
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        
        if (canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
          
          // 嘗試使用 jsQR（如果可用）
          if (typeof jsQR !== 'undefined') {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
              this.handleScanResult(code.data);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Canvas 掃描錯誤:', error);
      }
      
      // 每500ms掃描一次
      setTimeout(scanLoop, 500);
    };
    
    scanLoop();
  }

  fallbackScanMethod() {
    // 備用掃描方法 - 立即顯示手動輸入，並嘗試簡單的圖像檢測
    console.log('使用備用掃描方法');
    this.updateStatus('自動掃描有問題，請使用手動輸入');
    this.showManualInput();
    
    // 同時嘗試簡單的定時檢測
    this.simpleDetection();
  }

  simpleDetection() {
    console.log('開始簡單檢測');
    let lastImageData = null;
    
    const detect = () => {
      if (!this.isScanning) return;
      
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = this.video.videoWidth || 640;
        canvas.height = this.video.videoHeight || 480;
        
        if (this.video.readyState === 4) { // HAVE_ENOUGH_DATA
          ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // 檢查畫面是否有變化（粗略檢測是否有QR碼）
          if (lastImageData) {
            let diff = 0;
            for (let i = 0; i < imageData.data.length; i += 40) {
              diff += Math.abs(imageData.data[i] - lastImageData.data[i]);
            }
            
            // 如果變化很大，可能是新的QR碼
            if (diff > 50000) {
              console.log('檢測到畫面變化，可能是QR碼');
              this.updateStatus('檢測到變化，請點擊手動輸入按鈕');
            }
          }
          
          lastImageData = imageData;
        }
      } catch (error) {
        console.error('簡單檢測錯誤:', error);
      }
      
      setTimeout(detect, 1000);
    };
    
    detect();
  }

  showManualInput() {
    const statusElement = document.getElementById('scan-status');
    if (statusElement) {
      statusElement.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p style="margin-bottom: 15px; color: #ffc107;">自動掃描可能有問題</p>
          <button onclick="window.qrScanner.manualInput()" 
                  style="padding: 15px 30px; margin: 10px;
                         background: #007bff; color: white; 
                         border: none; border-radius: 8px; 
                         font-size: 16px; cursor: pointer;">
            📝 手動輸入設備編號
          </button>
          <br>
          <button onclick="window.qrScanner.testScan()" 
                  style="padding: 10px 20px; margin: 5px;
                         background: #28a745; color: white; 
                         border: none; border-radius: 5px; 
                         font-size: 14px; cursor: pointer;">
            🧪 測試掃描功能
          </button>
          <br>
          <small style="color: #6c757d; margin-top: 10px; display: block;">
            如果有QR碼在畫面中，請嘗試手動輸入編號
          </small>
        </div>
      `;
    }
  }

  manualInput() {
    const input = prompt('請輸入設備編號：\n\n範例: 314010102-300933');
    if (input && input.trim()) {
      console.log('手動輸入:', input.trim());
      this.handleScanResult(input.trim());
    }
  }

  testScan() {
    // 測試掃描功能
    console.log('測試掃描功能');
    this.updateStatus('測試中...');
    
    // 模擬掃描一個測試編號
    const testCode = '314010102-300933';
    
    setTimeout(() => {
      console.log('執行測試掃描:', testCode);
      this.handleScanResult(testCode);
    }, 1000);
  }

  handleScanResult(result) {
    const now = Date.now();
    if (now - this.lastScanTime < this.scanCooldown) {
      console.log('掃描冷卻中，忽略結果');
      return;
    }
    this.lastScanTime = now;

    // 提取掃描資料
    const scannedData = typeof result === 'string' ? result : 
                       (result.data || result.result || result);
    
    if (!scannedData || !scannedData.trim()) {
      this.updateStatus('掃描結果為空，請重試');
      return;
    }

    const cleanData = scannedData.toString().trim();
    console.log('QR 掃描結果:', cleanData);

    this.processResult(cleanData);
  }

  processResult(scannedData) {
    console.log('處理掃描結果:', scannedData);
    
    this.updateStatus('處理中...');

    // 等待 inventory 就緒
    this.waitForInventory(scannedData, 0);
  }

  waitForInventory(scannedData, attempts) {
    const maxAttempts = 50; // 25秒等待時間
    
    if (window.inventory && window.inventory.isReady && window.inventory.data.length > 0) {
      console.log('inventory 就緒，處理掃描結果');
      this.callInventoryHandler(scannedData);
      return;
    }
    
    if (attempts >= maxAttempts) {
      console.log('等待 inventory 超時');
      this.updateStatus('系統未就緒，請稍後重試');
      this.fallbackHandler(scannedData);
      return;
    }
    
    // 繼續等待
    setTimeout(() => {
      this.waitForInventory(scannedData, attempts + 1);
    }, 500);
  }

  callInventoryHandler(scannedData) {
    try {
      // 使用 inventory 的 handleQRScan 方法
      const success = window.inventory.handleQRScan(scannedData);
      
      if (success) {
        this.updateStatus('盤點成功！');
        
        // 震動反饋（如果支援）
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        
        // 2秒後關閉掃描器
        setTimeout(() => this.hide(), 2000);
        
      } else {
        this.updateStatus('處理失敗，請重試');
      }

    } catch (error) {
      console.error('調用 inventory 處理函數失敗:', error);
      this.fallbackHandler(scannedData);
    }
  }

  fallbackHandler(scannedData) {
    console.log('使用備用處理方案');
    
    // 儲存到 localStorage 供後續處理
    try {
      const pending = JSON.parse(localStorage.getItem('pendingScans') || '[]');
      pending.push({
        data: scannedData,
        time: new Date().toISOString()
      });
      localStorage.setItem('pendingScans', JSON.stringify(pending));
      
      this.updateStatus(`已記錄設備：${scannedData}`);
      this.showToast(`設備編號已記錄：${scannedData}，請手動更新狀態`);
      
    } catch (error) {
      console.error('備用處理失敗:', error);
      this.updateStatus('處理失敗');
    }
  }

  stopScanning() {
    this.isScanning = false;
    
    if (this.scanner) {
      try {
        this.scanner.stop();
        this.scanner.destroy();
      } catch (error) {
        console.error('停止 QrScanner 失敗:', error);
      }
      this.scanner = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (error) {
          console.error('停止視頻軌失敗:', error);
        }
      });
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
    
    console.log('掃描已停止');
  }

  async switchCamera() {
    console.log('切換相機');
    
    if (!this.isScanning) return;
    
    // 切換前後鏡頭
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    
    this.stopScanning();
    
    // 稍等一下再重新啟動
    setTimeout(() => {
      if (document.getElementById('qr-scanner').classList.contains('show')) {
        this.startScanning();
      }
    }, 1000);
  }

  updateStatus(message) {
    const statusElement = document.getElementById('scan-status');
    if (statusElement) {
      // 如果不是 HTML 內容，就設定純文字
      if (!message.includes('<')) {
        statusElement.textContent = message;
      } else {
        statusElement.innerHTML = message;
      }
    }
    console.log('掃描狀態:', message);
  }

  showToast(message) {
    if (window.inventory && window.inventory.showToast) {
      window.inventory.showToast(message, 'info');
    } else {
      console.log('Toast:', message);
      // 備用提示方式
      const statusElement = document.getElementById('scan-status');
      if (statusElement) {
        statusElement.textContent = message;
      }
    }
  }
}

// 全域函數
function closeQRScanner() {
  if (window.qrScanner) {
    window.qrScanner.hide();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 載入完成，初始化 QR 掃描器...');
  
  // 延遲初始化，確保其他腳本載入完成
  setTimeout(() => {
    window.qrScanner = new QRScannerManager();
    console.log('QR 掃描器管理器已建立');
  }, 1000);
});

// 處理待處理的掃描（頁面載入時檢查）
window.addEventListener('load', () => {
  setTimeout(() => {
    try {
      const pending = JSON.parse(localStorage.getItem('pendingScans') || '[]');
      if (pending.length > 0 && window.inventory) {
        console.log(`發現 ${pending.length} 個待處理的掃描`);
        
        pending.forEach(item => {
          if (window.inventory.handleQRScan) {
            window.inventory.handleQRScan(item.data);
          }
        });
        
        // 清除待處理列表
        localStorage.removeItem('pendingScans');
        
        if (window.inventory.showToast) {
          window.inventory.showToast(`已處理 ${pending.length} 個離線掃描記錄`, 'success');
        }
      }
    } catch (error) {
      console.error('處理待處理掃描失敗:', error);
    }
  }, 2000);
});
