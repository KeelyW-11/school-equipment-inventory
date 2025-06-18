// 設備盤點系統主要功能 - iPhone 簡化版
class EquipmentInventory {
  constructor() {
    this.data = [];
    this.classrooms = [];
    this.currentClassroom = null;
    this.currentFilter = 'all';
    this.selectedItems = new Set();
    this.isReady = false;
    
    // 立即設定為全域變數
    window.inventory = this;
    
    this.init();
  }

  async init() {
    console.log('初始化設備盤點系統...');
    
    this.loadData();
    this.setupEventListeners();
    this.render();
    
    // 標記為就緒
    this.isReady = true;
    
    console.log('設備盤點系統初始化完成，資料筆數:', this.data.length);
  }

  loadData() {
    // 直接使用內嵌資料，避免 CSV 載入問題
    this.data = [
      { 編號: '314010102-300933', 名稱: 'ASUS WS690T 工作站主機', 教室: '大同樓1樓科任辦公室D108', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010102-301601', 名稱: 'ASUS WS750T', 教室: '大同樓2樓電腦教室D216', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010102-301602', 名稱: 'ASUS WS750T', 教室: '大同樓3樓電腦教室D317', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300207', 名稱: 'Acer Veritpon M480', 教室: '勤學樓3樓資訊設備室A303', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300685', 名稱: '華碩BP1AE桌上型電腦(薄型主機)', 教室: '大同樓2樓D204', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300710', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '勤學樓3樓資訊設備室A303', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300713', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '大同樓3樓志工辦公室D316', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300714', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '大同樓1樓科任辦公室D108', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300715', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '大同樓1樓科任辦公室D108', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300717', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '大同樓1樓英文教室三D126', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300718', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '大同樓1樓科任辦公室D108', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300719', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '勤學樓3樓資訊設備室A303', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300721', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '大同樓4樓美勞教室二 D416', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300724', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '關懷樓4樓自然教室三B405', 狀態: '未盤點', 最後更新: '' },
      { 編號: '314010103-300725', 名稱: 'ASUS MD570 i3教學主機(電腦教室)', 教室: '大同樓3樓教師研究室D335', 狀態: '未盤點', 最後更新: '' }
    ];
    
    // 從 localStorage 恢復狀態
    this.restoreStatus();
    this.generateClassrooms();
    
    console.log('資料載入完成，共', this.data.length, '筆設備');
  }

  generateClassrooms() {
    this.classrooms = [...new Set(this.data.map(item => item.教室))].filter(Boolean).sort();
    console.log('教室清單:', this.classrooms.length, '個教室');
  }

  setupEventListeners() {
    // 搜尋功能
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderTable());
    }

    // QR 掃描按鈕
    const qrScanBtn = document.getElementById('qr-scan-btn');
    if (qrScanBtn) {
      qrScanBtn.addEventListener('click', () => this.showQRScanner());
    }

    // 其他按鈕
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetStatus());
    }

    // 篩選按鈕
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
    });

    console.log('事件監聽器設定完成');
  }

  showQRScanner() {
    console.log('啟動 QR 掃描器');
    if (window.qrScanner) {
      window.qrScanner.show();
    } else {
      this.showToast('QR 掃描器尚未載入', 'error');
    }
  }

  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    this.renderTable();
  }

  render() {
    this.renderClassroomList();
    this.renderTable();
    this.updateStats();
    this.updateProgressRing();
  }

  renderClassroomList() {
    const list = document.getElementById('classroom-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    // 全部選項
    const allItem = document.createElement('li');
    allItem.textContent = '📚 全部教室';
    allItem.className = !this.currentClassroom ? 'selected' : '';
    allItem.onclick = () => this.selectClassroom(null);
    list.appendChild(allItem);
    
    // 各教室選項
    this.classrooms.forEach(classroom => {
      const li = document.createElement('li');
      li.textContent = `🏫 ${classroom}`;
      li.className = this.currentClassroom === classroom ? 'selected' : '';
      li.onclick = () => this.selectClassroom(classroom);
      list.appendChild(li);
    });
  }

  selectClassroom(classroom) {
    this.currentClassroom = classroom;
    this.render();
  }

  renderTable() {
    const keyword = document.getElementById('search-input')?.value.toLowerCase() || '';
    const tbody = document.querySelector('#equipment-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let filteredData = this.getFilteredData(keyword);
    
    filteredData.forEach(item => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-equipment-id', item.編號);
      
      tr.innerHTML = `
        <td><input type="checkbox"></td>
        <td><strong>${item.編號}</strong></td>
        <td>${item.名稱}</td>
        <td>${item.教室}</td>
        <td>
          <span class="status-cell ${this.getStatusClass(item.狀態)}" 
                onclick="window.inventory.toggleStatus('${item.編號}')">
            ${item.狀態}
          </span>
        </td>
        <td>${item.最後更新 || '-'}</td>
        <td>
          <button onclick="window.inventory.toggleStatus('${item.編號}')" 
                  class="btn ${item.狀態 === '未盤點' ? 'btn-success' : 'btn-secondary'}"
                  style="padding: 5px 10px; font-size: 0.8rem;">
            ${item.狀態 === '未盤點' ? '✅ 盤點' : '❌ 取消'}
          </button>
        </td>
      `;
      
      tbody.appendChild(tr);
    });
    
    this.updateStats();
  }

  getFilteredData(keyword) {
    return this.data.filter(item => {
      // 教室篩選
      if (this.currentClassroom && item.教室 !== this.currentClassroom) {
        return false;
      }
      
      // 關鍵字篩選
      if (keyword && !this.matchesKeyword(item, keyword)) {
        return false;
      }
      
      // 狀態篩選
      if (this.currentFilter === 'checked' && item.狀態 !== '已盤點') {
        return false;
      }
      if (this.currentFilter === 'unchecked' && item.狀態 !== '未盤點') {
        return false;
      }
      
      return true;
    });
  }

  matchesKeyword(item, keyword) {
    return item.編號.toLowerCase().includes(keyword) ||
           item.名稱.toLowerCase().includes(keyword) ||
           item.教室.toLowerCase().includes(keyword);
  }

  getStatusClass(status) {
    return status === '已盤點' ? 'status-checked' : 'status-unchecked';
  }

  // 核心功能：切換設備狀態
  toggleStatus(equipmentId) {
    console.log('切換設備狀態:', equipmentId);
    
    const item = this.data.find(d => d.編號 === equipmentId);
    if (!item) {
      console.error('找不到設備:', equipmentId);
      this.showToast(`找不到設備：${equipmentId}`, 'error');
      return null;
    }

    const oldStatus = item.狀態;
    const newStatus = item.狀態 === '未盤點' ? '已盤點' : '未盤點';
    const timestamp = new Date().toLocaleString('zh-TW');
    
    // 更新設備狀態
    item.狀態 = newStatus;
    item.最後更新 = timestamp;
    
    console.log(`設備 ${equipmentId} 狀態變更: ${oldStatus} -> ${newStatus}`);
    
    // 保存狀態並重新渲染
    this.saveStatus();
    this.render();
    
    // 顯示成功訊息
    const action = newStatus === '已盤點' ? '盤點完成' : '取消盤點';
    this.showToast(`${item.編號} - ${item.名稱} ${action}`, 'success');
    
    return item;
  }

  // QR 掃描處理（供 QR 掃描器調用）
  handleQRScan(scannedData) {
    console.log('處理 QR 掃描結果:', scannedData);
    
    if (!scannedData || !scannedData.trim()) {
      this.showToast('掃描結果為空', 'error');
      return false;
    }
    
    const cleanData = scannedData.toString().trim();
    
    // 尋找對應的設備
    const item = this.data.find(d => d.編號 === cleanData);
    
    if (!item) {
      this.showToast(`找不到設備編號：${cleanData}`, 'error');
      return false;
    }
    
    // 直接切換狀態
    this.toggleStatus(cleanData);
    return true;
  }

  updateStats() {
    const filteredData = this.currentClassroom ? 
      this.data.filter(d => d.教室 === this.currentClassroom) : this.data;
    
    const total = filteredData.length;
    const checked = filteredData.filter(d => d.狀態 === '已盤點').length;
    const unchecked = total - checked;
    
    const totalElement = document.getElementById('total-count');
    const checkedElement = document.getElementById('checked-count');
    const uncheckedElement = document.getElementById('unchecked-count');
    
    if (totalElement) totalElement.textContent = total;
    if (checkedElement) checkedElement.textContent = checked;
    if (uncheckedElement) uncheckedElement.textContent = unchecked;
  }

  updateProgressRing() {
    const total = this.data.length;
    const checked = this.data.filter(d => d.狀態 === '已盤點').length;
    const progress = total > 0 ? (checked / total) * 100 : 0;
    
    const progressElement = document.getElementById('progress-percent');
    if (progressElement) {
      progressElement.textContent = `${Math.round(progress)}%`;
    }
  }

  saveStatus() {
    try {
      const statusData = this.data.map(d => ({
        編號: d.編號,
        狀態: d.狀態,
        最後更新: d.最後更新
      }));
      localStorage.setItem('equipment-status', JSON.stringify(statusData));
      console.log('狀態已保存');
    } catch (error) {
      console.error('儲存狀態失敗:', error);
    }
  }

  restoreStatus() {
    try {
      const saved = localStorage.getItem('equipment-status');
      if (saved) {
        const statusData = JSON.parse(saved);
        let restoredCount = 0;
        
        statusData.forEach(saved => {
          const item = this.data.find(d => d.編號 === saved.編號);
          if (item) {
            item.狀態 = saved.狀態;
            item.最後更新 = saved.最後更新;
            restoredCount++;
          }
        });
        
        console.log(`恢復 ${restoredCount} 個設備狀態`);
      }
    } catch (error) {
      console.log('恢復狀態失敗:', error);
    }
  }

  resetStatus() {
    if (confirm('確定要重置所有設備盤點狀態嗎？')) {
      this.data.forEach(item => {
        item.狀態 = '未盤點';
        item.最後更新 = '';
      });
      
      localStorage.removeItem('equipment-status');
      this.render();
      this.showToast('已重置所有設備盤點狀態', 'success');
    }
  }

  exportData() {
    const csvContent = this.generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `設備盤點報表_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('報表匯出成功', 'success');
    }
  }

  generateCSV() {
    const headers = ['編號', '名稱', '教室', '狀態', '最後更新'];
    const rows = this.data.map(item => [
      item.編號,
      item.名稱,
      item.教室,
      item.狀態,
      item.最後更新 || ''
    ]);
    
    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
      // 備用顯示方式 - 使用 alert
      alert(message);
      return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // 自動移除
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 4000);
  }
}

// 全域函數（供 HTML 調用）
function closeUpload() {
  const overlay = document.getElementById('upload-overlay');
  if (overlay) {
    overlay.classList.remove('show');
  }
}

function closeQRScanner() {
  if (window.qrScanner) {
    window.qrScanner.hide();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 載入完成，開始初始化');
  
  // 立即創建系統實例
  const inventory = new EquipmentInventory();
  
  console.log('設備盤點系統已初始化');
});
