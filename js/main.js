// 設備盤點系統主要功能 - 修正版
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
    
    await this.loadData();
    this.setupEventListeners();
    this.render();
    
    // 標記為就緒
    this.isReady = true;
    
    console.log('設備盤點系統初始化完成，資料筆數:', this.data.length);
  }

  async loadData() {
    try {
      // 從 CSV 檔案載入資料
      const response = await fetch('data/equipment.csv');
      const csvText = await response.text();
      
      // 使用 Papa Parse 解析 CSV
      if (typeof Papa !== 'undefined') {
        const result = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8'
        });
        
        this.data = result.data.map(item => ({
          編號: item.編號,
          名稱: item.名稱,
          教室: item.教室,
          狀態: '未盤點',
          最後更新: ''
        })).filter(item => item.編號 && item.名稱); // 過濾空行
        
      } else {
        // 備用解析方式
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        this.data = lines.slice(1).map(line => {
          const values = line.split(',');
          if (values.length >= 3 && values[0].trim()) {
            return {
              編號: values[0].trim(),
              名稱: values[1].trim(),
              教室: values[2].trim(),
              狀態: '未盤點',
              最後更新: ''
            };
          }
          return null;
        }).filter(Boolean);
      }
      
      console.log('從 CSV 載入資料:', this.data.length, '筆');
      
    } catch (error) {
      console.error('載入 CSV 失敗:', error);
      this.showToast('載入設備清單失敗，請檢查 data/equipment.csv 檔案', 'error');
      
      // 使用備用資料
      this.data = [
        { 編號: '314010102-300933', 名稱: 'ASUS WS690T 工作站主機', 教室: '大同樓1樓科任辦公室D108', 狀態: '未盤點', 最後更新: '' },
        { 編號: '314010102-301601', 名稱: 'ASUS WS750T', 教室: '大同樓2樓電腦教室D216', 狀態: '未盤點', 最後更新: '' }
      ];
    }
    
    // 從 localStorage 恢復狀態
    this.restoreStatus();
    this.generateClassrooms();
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

    // 清除搜尋按鈕
    const clearBtn = document.getElementById('clear-search');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.renderTable();
      });
    }

    // QR 掃描按鈕
    const qrScanBtn = document.getElementById('qr-scan-btn');
    if (qrScanBtn) {
      qrScanBtn.addEventListener('click', () => this.showQRScanner());
    }

    // 上傳按鈕
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => this.showUpload());
    }

    // 主題切換
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // 匯出按鈕
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // 重置按鈕
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetStatus());
    }

    // 批量盤點按鈕
    const bulkCheckBtn = document.getElementById('bulk-check');
    if (bulkCheckBtn) {
      bulkCheckBtn.addEventListener('click', () => this.bulkCheck());
    }

    // 篩選按鈕
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
    });

    // 教室搜尋
    const classroomSearch = document.getElementById('classroom-search');
    if (classroomSearch) {
      classroomSearch.addEventListener('input', (e) => this.filterClassrooms(e.target.value));
    }

    // 全選checkbox
    const selectAll = document.getElementById('select-all');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
    }

    console.log('事件監聽器設定完成');
  }

  showUpload() {
    const overlay = document.getElementById('upload-overlay');
    if (overlay) {
      overlay.classList.add('show');
    }
  }

  showQRScanner() {
    console.log('啟動 QR 掃描器');
    if (window.qrScanner) {
      window.qrScanner.show();
    } else {
      this.showToast('QR 掃描器尚未載入', 'error');
    }
  }

  toggleTheme() {
    document.body.classList.toggle('theme-high-contrast');
    this.showToast('主題已切換', 'info');
  }

  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    this.renderTable();
  }

  filterClassrooms(keyword) {
    const filteredClassrooms = keyword ? 
      this.classrooms.filter(c => c.includes(keyword)) : 
      this.classrooms;
    
    this.renderClassroomList(filteredClassrooms);
  }

  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('#equipment-table tbody input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = checked);
    
    if (checked) {
      this.selectedItems = new Set(this.getFilteredData('').map(item => item.編號));
    } else {
      this.selectedItems.clear();
    }
  }

  bulkCheck() {
    if (this.selectedItems.size === 0) {
      this.showToast('請先選擇要盤點的設備', 'warning');
      return;
    }

    if (confirm(`確定要批量盤點 ${this.selectedItems.size} 個設備嗎？`)) {
      let count = 0;
      this.selectedItems.forEach(id => {
        const item = this.data.find(d => d.編號 === id);
        if (item && item.狀態 === '未盤點') {
          item.狀態 = '已盤點';
          item.最後更新 = new Date().toLocaleString('zh-TW');
          count++;
        }
      });

      this.saveStatus();
      this.render();
      this.selectedItems.clear();
      
      this.showToast(`批量盤點完成：${count} 個設備`, 'success');
    }
  }

  render() {
    this.renderClassroomList();
    this.renderTable();
    this.updateStats();
    this.updateProgressRing();
  }

  renderClassroomList(filteredClassrooms = null) {
    const list = document.getElementById('classroom-list');
    if (!list) return;
    
    const classroomsToShow = filteredClassrooms || this.classrooms;
    list.innerHTML = '';
    
    // 全部選項
    const allItem = document.createElement('li');
    allItem.textContent = '📚 全部教室';
    allItem.className = !this.currentClassroom ? 'selected' : '';
    allItem.onclick = () => this.selectClassroom(null);
    list.appendChild(allItem);
    
    // 各教室選項
    classroomsToShow.forEach(classroom => {
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
    
    if (filteredData.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">沒有找到符合條件的設備</td>`;
      tbody.appendChild(tr);
      return;
    }
    
    filteredData.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-equipment-id', item.編號);
      
      tr.innerHTML = `
        <td><input type="checkbox" onchange="window.inventory.toggleSelection('${item.編號}', this.checked)"></td>
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

  toggleSelection(equipmentId, checked) {
    if (checked) {
      this.selectedItems.add(equipmentId);
    } else {
      this.selectedItems.delete(equipmentId);
    }

    // 更新全選狀態
    const selectAll = document.getElementById('select-all');
    const allCheckboxes = document.querySelectorAll('#equipment-table tbody input[type="checkbox"]');
    const checkedBoxes = document.querySelectorAll('#equipment-table tbody input[type="checkbox"]:checked');
    
    if (selectAll) {
      selectAll.checked = allCheckboxes.length === checkedBoxes.length && allCheckboxes.length > 0;
      selectAll.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allCheckboxes.length;
    }
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
    const result = this.toggleStatus(cleanData);
    
    // 高亮顯示該設備
    setTimeout(() => this.highlightEquipment(cleanData), 100);
    
    return result !== null;
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
    const progressRing = document.querySelector('.progress-ring-fill');
    
    if (progressElement) {
      progressElement.textContent = `${Math.round(progress)}%`;
    }
    
    if (progressRing) {
      const circumference = 2 * Math.PI * 50;
      const offset = circumference - (progress / 100) * circumference;
      progressRing.style.strokeDashoffset = offset;
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
      console.log('狀態已保存至 localStorage');
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
        
        console.log(`從 localStorage 恢復 ${restoredCount} 個設備狀態`);
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
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
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
      // 備用顯示方式
      console.log(`Toast (${type}): ${message}`);
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
  new EquipmentInventory();
  
  console.log('設備盤點系統已初始化');
});
