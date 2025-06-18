// QR Code 掃描器功能 - 改進版
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

  // 處理掃描結果 - 改進版
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

    // 嘗試多種方式傳遞結果
    this.processQRResult(scannedData);

    // 短暫延遲後隱藏掃描器
    setTimeout(() => {
      this.hide();
    }, 1500);
  }

  // 處理 QR 掃描結果 - 針對設備盤點系統優化
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
          
          // 嘗試其他方法
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
    
    // 嘗試直接操作 DOM
    const success = this.tryDirectDOMUpdate(scannedData);
    
    if (success) {
      this.showToast(`設備 ${scannedData} 盤點完成`, 'success');
    } else {
      // 存儲到 localStorage 供主系統稍後處理
      const pendingScans = JSON.parse(localStorage.getItem('pendingQRScans') || '[]');
      pendingScans.push({
        data: scannedData,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('pendingQRScans', JSON.stringify(pendingScans));
      
      this.showError(`找不到設備 ${scannedData}，已暫存待處理`);
    }
  }

  // 嘗試直接更新 DOM
  tryDirectDOMUpdate(equipmentId) {
    try {
      // 查找包含設備編號的表格行
      const table = document.querySelector('#equipment-table tbody');
      if (!table) return false;
      
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const idCell = row.querySelector('td:nth-child(2) strong');
        if (idCell && idCell.textContent.trim() === equipmentId) {
          console.log('找到匹配的設備行:', equipmentId);
          
          // 找到盤點按鈕並點擊
          const button = row.querySelector('button[onclick*="toggleStatus"]');
          if (button && button.textContent.includes('盤點')) {
            button.click();
            return true;
          }
          
          // 或者直接更新狀態顯示
          const statusCell = row.querySelector('.status-cell');
          if (statusCell && statusCell.textContent.trim() === '未盤點') {
            statusCell.textContent = '已盤點';
            statusCell.className = 'status-cell status-checked';
            
            // 更新最後更新時間
            const timeCell = row.querySelector('td:nth-child(6)');
            if (timeCell) {
              timeCell.textContent = new Date().toLocaleString('zh-TW');
            }
            
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('直接 DOM 更新失敗:', error);
      return false;
    }
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

  // 顯示 Toast 訊息 (備用方法)
  showToast(message, type = 'info') {
    // 如果主系統的 showToast 可用就使用
    if (window.inventory && typeof window.inventory.showToast === 'function') {
      window.inventory.showToast(message, type);
      return;
    }
    
    // 否則使用簡單的 alert
    if (type === 'error') {
      alert('錯誤: ' + message);
    } else {
      console.log('Toast:', message);
    }
  }

  // 嘗試直接更新設備狀態
  tryDirectUpdate(scannedData) {
    try {
      // 嘗試查找包含設備ID的元素
      const deviceElements = document.querySelectorAll('[data-device-id]');
      
      for (const element of deviceElements) {
        const deviceId = element.getAttribute('data-device-id');
        
        // 比較設備ID（可能需要根據實際的QR碼格式調整）
        if (this.matchDeviceId(scannedData, deviceId)) {
          console.log('找到匹配的設備元素:', deviceId);
          
          // 更新設備狀態
          this.updateDeviceStatus(element, 'checked');
          
          // 觸發變更事件
          const changeEvent = new Event('change', { bubbles: true });
          element.dispatchEvent(changeEvent);
          
          return true;
        }
      }
      
      // 如果沒有找到匹配的設備，嘗試其他方式
      console.log('未找到匹配的設備元素，嘗試其他方式');
      return false;
      
    } catch (error) {
      console.error('直接更新設備狀態失敗:', error);
      return false;
    }
  }

  // 比較設備ID
  matchDeviceId(scannedData, deviceId) {
    // 精確匹配
    if (scannedData === deviceId) return true;
    
    // 包含匹配
    if (scannedData.includes(deviceId) || deviceId.includes(scannedData)) return true;
    
    // JSON格式的QR碼
    try {
      const qrData = JSON.parse(scannedData);
      if (qrData.id === deviceId || qrData.deviceId === deviceId) return true;
    } catch (e) {
      // 不是JSON格式，繼續其他比較
    }
    
    // URL格式的QR碼
    try {
      const url = new URL(scannedData);
      const params = new URLSearchParams(url.search);
      if (params.get('id') === deviceId || params.get('deviceId') === deviceId) return true;
    } catch (e) {
      // 不是URL格式，繼續其他比較
    }
    
    return false;
  }

  // 更新設備狀態
  updateDeviceStatus(element, status) {
    // 更新checkbox狀態
    const checkbox = element.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = (status === 'checked');
    }
    
    // 更新視覺狀態
    element.classList.toggle('checked', status === 'checked');
    element.classList.toggle('inventory-checked', status === 'checked');
    
    // 更新狀態文字
    const statusText = element.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = status === 'checked' ? '已盤點' : '未盤點';
    }
    
    // 更新時間戳
    const timestamp = element.querySelector('.timestamp');
    if (timestamp) {
      timestamp.textContent = new Date().toLocaleString();
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
    if (window.showToast) {
      window.showToast(message, 'error');
    }
    
    console.error('QR Scanner Error:', message);
  }

  // 調試方法：列出所有可能的處理器
  debugHandlers() {
    console.log('=== QR 掃描器調試信息 ===');
    console.log('window.inventory:', window.inventory);
    console.log('window.handleQRScanResult:', window.handleQRScanResult);
    console.log('設備元素數量:', document.querySelectorAll('[data-device-id]').length);
    console.log('掃描歷史:', JSON.parse(localStorage.getItem('qrScanHistory') || '[]'));
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
  
  // 這裡可以加入您的自定義處理邏輯
  // 例如：更新設備狀態、發送到服務器等
  
  if (window.showToast) {
    window.showToast(`QR 掃描成功：${data}`, 'success');
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
  
  // 添加調試按鈕（開發環境）
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const debugBtn = document.createElement('button');
    debugBtn.textContent = 'QR 調試';
    debugBtn.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
      background: #007bff;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    debugBtn.onclick = () => {
      window.qrScanner.debugHandlers();
      // 測試掃描功能
      const testId = prompt('輸入測試設備編號:');
      if (testId && window.inventory) {
        window.inventory.handleQRScan(testId);
      }
    };
    document.body.appendChild(debugBtn);
  }
});

// 匯出類別供其他模組使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QRScannerManager;
}
