// QR Code 掃描器功能 - iPhone 優化版
class QRScannerManager {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.video = null;
    this.stream = null;
    this.lastScanTime = 0;
    this.scanCooldown = 3000; // 3秒冷卻時間
    
    // 立即初始化
    setTimeout(() => this.init(), 100);
  }

  async init() {
    console.log('QR 掃描器初始化中...');
    this.video = document.getElementById('qr-video');
    
    // 設定事件監聽器
    const switchCameraBtn = document.getElementById('switch-camera');
    if (switchCameraBtn) {
      switchCameraBtn.addEventListener('click', () => this.switchCamera());
    }

    // 關閉按鈕
    const closeBtn = document.querySelector('.close-scanner');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    console.log('QR 掃描器初始化完成');
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
    if (this.isScanning) return;

    try {
      this.updateStatus('正在啟動相機...');
      
      // 停止現有視頻流
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }

      // 請求相機權限
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
        
        this.updateStatus('請將 QR Code 對準畫面');
        this.isScanning = true;
        
        // 開始掃描循環
        this.startScanLoop();
      }

    } catch (error) {
      console.error('啟動相機失敗:', error);
      this.showManualInput();
    }
  }

  startScanLoop() {
    if (!this.isScanning) return;

    // 如果有 QrScanner 庫就使用
    if (typeof QrScanner !== 'undefined') {
      try {
        this.scanner = new QrScanner(
          this.video,
          (result) => this.handleScanResult(result),
          {
            highlightScanRegion: true,
            highlightCodeOutline: true
          }
        );
        this.scanner.start();
        console.log('QrScanner 啟動成功');
      } catch (error) {
        console.error('QrScanner 初始化失敗:', error);
        this.showManualInput();
      }
    } else {
      // 沒有掃描庫，顯示手動輸入
      this.showManualInput();
    }
  }

  showManualInput() {
    this.updateStatus('自動掃描不可用，請點擊手動輸入');
    
    // 添加手動輸入按鈕
    const statusElement = document.getElementById('scan-status');
    if (statusElement) {
      statusElement.innerHTML = `
        <p>自動掃描不可用</p>
        <button onclick="window.qrScanner.manualInput()" 
                style="padding: 15px 30px; margin-top: 15px; 
                       background: #007bff; color: white; 
                       border: none; border-radius: 8px; 
                       font-size: 16px; cursor: pointer;">
          📝 手動輸入設備編號
        </button>
      `;
    }
  }

  manualInput() {
    const input = prompt('請輸入設備編號：');
    if (input && input.trim()) {
      this.handleScanResult(input.trim());
    }
  }

  handleScanResult(result) {
    const now = Date.now();
    if (now - this.lastScanTime < this.scanCooldown) {
      return; // 冷卻中
    }
    this.lastScanTime = now;

    const scannedData = typeof result === 'string' ? result : result.data;
    
    if (!scannedData || !scannedData.trim()) {
      this.updateStatus('掃描結果為空，請重試');
      return;
    }

    const cleanData = scannedData.trim();
    console.log('QR 掃描結果:', cleanData);

    // 立即處理掃描結果
    this.processResult(cleanData);
  }

  processResult(scannedData) {
    console.log('處理掃描結果:', scannedData);
    
    // 檢查 inventory 是否存在
    if (!window.inventory) {
      console.log('inventory 不存在，等待載入...');
      this.waitForInventory(scannedData);
      return;
    }

    // 直接調用處理函數
    this.callInventoryHandler(scannedData);
  }

  waitForInventory(scannedData) {
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkInventory = setInterval(() => {
      attempts++;
      
      if (window.inventory && window.inventory.data && window.inventory.data.length > 0) {
        clearInterval(checkInventory);
        console.log('inventory 載入完成，處理掃描結果');
        this.callInventoryHandler(scannedData);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInventory);
        console.log('等待 inventory 超時，使用備用方案');
        this.fallbackHandler(scannedData);
      }
    }, 500);
  }

  callInventoryHandler(scannedData) {
    try {
      // 尋找設備
      const item = window.inventory.data.find(d => d.編號 === scannedData);
      
      if (!item) {
        this.showToast(`找不到設備：${scannedData}`);
        this.updateStatus('找不到設備，請檢查編號');
        return;
      }

      // 更新設備狀態
      const newStatus = item.狀態 === '未盤點' ? '已盤點' : '未盤點';
      const timestamp = new Date().toLocaleString('zh-TW');
      
      item.狀態 = newStatus;
      item.最後更新 = timestamp;

      // 保存狀態
      window.inventory.saveStatus();
      
      // 重新渲染
      window.inventory.render();

      // 高亮設備
      this.highlightEquipment(scannedData);

      // 顯示成功訊息
      const action = newStatus === '已盤點' ? '盤點完成' : '取消盤點';
      this.showToast(`${item.編號} ${action}！`);
      this.updateStatus(`${action}成功！`);

      // 震動反饋
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }

      // 2秒後關閉掃描器
      setTimeout(() => this.hide(), 2000);

    } catch (error) {
      console.error('處理掃描結果失敗:', error);
      this.fallbackHandler(scannedData);
    }
  }

  fallbackHandler(scannedData) {
    // 備用處理方案
    this.showToast(`已記錄設備：${scannedData}`);
    this.updateStatus('已記錄，請手動更新狀態');
    
    // 存到 localStorage
    const pending = JSON.parse(localStorage.getItem('pendingScans') || '[]');
    pending.push({
      data: scannedData,
      time: new Date().toISOString()
    });
    localStorage.setItem('pendingScans', JSON.stringify(pending));
  }

  highlightEquipment(equipmentId) {
    try {
      // 查找並高亮設備行
      const rows = document.querySelectorAll('#equipment-table tbody tr');
      
      rows.forEach(row => {
        const idCell = row.querySelector('td:nth-child(2) strong');
        if (idCell && idCell.textContent.trim() === equipmentId) {
          row.style.backgroundColor = '#fff3cd';
          row.style.border = '2px solid #ffc107';
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          setTimeout(() => {
            row.style.backgroundColor = '';
            row.style.border = '';
          }, 3000);
        }
      });
    } catch (error) {
      console.error('高亮設備失敗:', error);
    }
  }

  stopScanning() {
    this.isScanning = false;
    
    if (this.scanner) {
      this.scanner.stop();
      this.scanner.destroy();
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

  switchCamera() {
    // 簡化的相機切換
    if (this.isScanning) {
      this.stopScanning();
      setTimeout(() => this.startScanning(), 500);
    }
  }

  updateStatus(message) {
    const statusElement = document.getElementById('scan-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
    console.log('掃描狀態:', message);
  }

  showToast(message) {
    // 簡化的提示訊息
    if (window.inventory && window.inventory.showToast) {
      window.inventory.showToast(message, 'success');
    } else {
      alert(message);
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
  console.log('初始化 QR 掃描器...');
  
  // 延遲初始化確保 DOM 完全載入
  setTimeout(() => {
    window.qrScanner = new QRScannerManager();
    console.log('QR 掃描器初始化完成');
  }, 1000);
});
