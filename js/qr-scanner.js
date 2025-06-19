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
          <p style="color: #007bff; margin-bottom: 20px; font-size: 18px; font-weight: bold;">📱 QR 掃描器</p>
          
          <button onclick="window.githubQRScanner.manualInput()" 
                  style="display: block; width: 90%; max-width: 300px; margin: 15px auto; 
                         padding: 20px 15px; background: linear-gradient(45deg, #007bff, #0056b3); 
                         color: white; border: none; border-radius: 12px; 
                         font-size: 18px; font-weight: bold; cursor: pointer; 
                         box-shadow: 0 4px 12px rgba(0,123,255,0.3);
                         transition: all 0.3s ease;">
            ✏️ 手動輸入設備編號
          </button>
          
          <button onclick="window.githubQRScanner.attemptCameraStart()" 
                  style="display: block; width: 90%; max-width: 300px; margin: 15px auto; 
                         padding: 18px 15px; background: linear-gradient(45deg, #28a745, #1e7e34); 
                         color: white; border: none; border-radius: 12px; 
                         font-size: 16px; font-weight: bold; cursor: pointer;
                         box-shadow: 0 4px 12px rgba(40,167,69,0.3);
                         transition: all 0.3s ease;">
            📹 自動相機掃描
          </button>
          
          <button onclick="window.githubQRScanner.hide()" 
                  style="display: block; width: 90%; max-width: 300px; margin: 15px auto; 
                         padding: 15px; background: linear-gradient(45deg, #6c757d, #545b62); 
                         color: white; border: none; border-radius: 10px; 
                         font-size: 14px; cursor: pointer;
                         box-shadow: 0 3px 8px rgba(108,117,125,0.3);
                         transition: all 0.3s ease;">
            ❌ 關閉掃描器
          </button>
          
          <div id="camera-status" style="margin-top: 20px; padding: 15px; 
                                         background: rgba(0,123,255,0.1); border-radius: 8px;
                                         font-size: 14px; color: #495057; line-height: 1.5;">
            <span style="color: #007bff;">💡 提示：</span>可以直接輸入設備編號，或嘗試相機掃描
          </div>
        </div>
        
        <style>
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.15) !important;
          }
          
          button:active {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          }
          
          @media (max-width: 480px) {
            button {
              font-size: 16px !important;
              padding: 18px 12px !important;
              margin: 12px auto !important;
            }
          }
        </style>
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
    // 創建自定義的輸入對話框，更適合手機使用
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      padding: 20px; box-sizing: border-box;
    `;
    
    overlay.innerHTML = `
      <div style="background: white; border-radius: 15px; padding: 30px; 
                  width: 100%; max-width: 400px; text-align: center;
                  box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <h3 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">
          📝 輸入設備編號
        </h3>
        
        <input type="text" id="equipment-input" 
               placeholder="例如：314010102-300933"
               style="width: 100%; padding: 18px; font-size: 16px; border: 2px solid #ddd;
                      border-radius: 10px; box-sizing: border-box; margin-bottom: 20px;
                      text-align: center; outline: none;">
        
        <div style="display: flex; gap: 15px; justify-content: center;">
          <button onclick="window.githubQRScanner.submitManualInput()" 
                  style="flex: 1; padding: 18px; background: linear-gradient(45deg, #28a745, #1e7e34); 
                         color: white; border: none; border-radius: 10px; 
                         font-size: 16px; font-weight: bold; cursor: pointer;
                         transition: all 0.3s ease;">
            ✅ 確認
          </button>
          
          <button onclick="window.githubQRScanner.closeManualInput()" 
                  style="flex: 1; padding: 18px; background: linear-gradient(45deg, #6c757d, #545b62); 
                         color: white; border: none; border-radius: 10px; 
                         font-size: 16px; font-weight: bold; cursor: pointer;
                         transition: all 0.3s ease;">
            ❌ 取消
          </button>
        </div>
        
        <div style="margin-top: 15px; font-size: 12px; color: #666; line-height: 1.4;">
          💡 提示：請輸入完整的設備編號，包含所有數字和符號
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // 聚焦輸入框
    setTimeout(() => {
      const input = document.getElementById('equipment-input');
      if (input) {
        input.focus();
        // 支援 Enter 鍵確認
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.submitManualInput();
          }
        });
      }
    }, 100);
    
    this.manualInputOverlay = overlay;
  }

  submitManualInput() {
    const input = document.getElementById('equipment-input');
    if (input && input.value.trim()) {
      const equipmentId = input.value.trim();
      this.closeManualInput();
      this.processQRData(equipmentId);
    } else {
      // 震動提示（如果支援）
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      // 高亮輸入框
      if (input) {
        input.style.borderColor = '#dc3545';
        input.style.backgroundColor = '#fff5f5';
        input.placeholder = '請輸入設備編號！';
        
        setTimeout(() => {
          input.style.borderColor = '#ddd';
          input.style.backgroundColor = 'white';
          input.placeholder = '例如：314010102-300933';
        }, 2000);
      }
    }
  }

  closeManualInput() {
    if (this.manualInputOverlay) {
      document.body.removeChild(this.manualInputOverlay);
      this.manualInputOverlay = null;
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
