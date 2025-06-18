// 設備盤點系統主要功能 - 優化版本
class EquipmentInventory {
  constructor() {
    this.data = [];
    this.classrooms = [];
    this.currentClassroom = null;
    this.theme = 'default';
    this.currentFilter = 'all';
    this.selectedItems = new Set();
    
    this.init();
  }

  // 初始化系統
  async init() {
    console.log('初始化設備盤點系統...');
    await this.loadData();
    this.setupEventListeners();
    this.applyTheme();
    this.render();
    
    // 註冊全域可訪問
    window.inventory = this;
    
    console.log('設備盤點系統初始化完成，資料筆數:', this.data.length);
  }

  // 載入資料
  async loadData() {
    try {
      // 嘗試從 CSV 檔案載入
      const response = await fetch('data/equipment.csv');
      if (response.ok) {
        const csvText = await response.text();
        this.parseCSV(csvText);
        console.log('從 CSV 檔案載入資料成功，共', this.data.length, '筆');
      } else {
        // 使用預設資料
        this.loadDefaultData();
        console.log('使用預設資料');
      }
    } catch (error) {
      console.log('載入 CSV 失敗，使用預設資料');
      this.loadDefaultData();
    }
    
    // 從 localStorage 恢復狀態
    this.restoreStatus();
    this.generateClassrooms();
  }

  // 載入預設資料
  loadDefaultData() {
    this.data = [
      { 編號: 'EQ001', 名稱: '投影機', 教室: '101教室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ002', 名稱: '電腦', 教室: '101教室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ003', 名稱: '音響', 教室: '102教室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ004', 名稱: '白板', 教室: '102教室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ005', 名稱: '掃描器', 教室: '103教室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ006', 名稱: '印表機', 教室: '103教室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ007', 名稱: '攝影機', 教室: '音樂教室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ008', 名稱: '鋼琴', 教室: '音樂教室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ009', 名稱: '籃球', 教室: '體育器材室', 狀態: '未盤點', 最後更新: '' },
      { 編號: 'EQ010', 名稱: '排球', 教室: '體育器材室', 狀態: '未盤點', 最後更新: '' }
    ];
    console.log('載入預設資料:', this.data.length, '筆');
  }

  // 解析 CSV 資料
  parseCSV(csvText) {
    const results = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim()
    });

    this.data = results.data.map(row => ({
      編號: row.編號 || row.id || '',
      名稱: row.名稱 || row.name || '',
      教室: row.教室 || row.classroom || '',
      狀態: '未盤點',
      最後更新: ''
    }));
  }

  // 生成教室清單
  generateClassrooms() {
    this.classrooms = [...new Set(this.data.map(item => item.教室))].sort();
    console.log('生成教室清單:', this.classrooms.length, '個教室');
  }

  // 設定事件監聽器
  setupEventListeners() {
    // 搜尋功能
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderTable());
    }

    const clearSearchBtn = document.getElementById('clear-search');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        this.renderTable();
      });
    }

    // 教室搜尋
    const classroomSearch = document.getElementById('classroom-search');
    if (classroomSearch) {
      classroomSearch.addEventListener('input', () => this.filterClassrooms());
    }

    // 按鈕事件
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => this.showUpload());
    }

    const qrScanBtn = document.getElementById('qr-scan-btn');
    if (qrScanBtn) {
      qrScanBtn.addEventListener('click', () => this.showQRScanner());
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetStatus());
    }

    const bulkCheckBtn = document.getElementById('bulk-check');
    if (bulkCheckBtn) {
      bulkCheckBtn.addEventListener('click', () => this.bulkCheck());
    }

    // 檔案上傳
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // 篩選按鈕
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setFilter(e.target.dataset.filter));
    });

    // 全選功能
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => this.selectAll(e.target.checked));
    }

    // 拖放功能
    this.setupDragDrop();
  }

  // 設定拖放功能
  setupDragDrop() {
    const body = document.body;
    
    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showUpload();
    });

    const uploadOverlay = document.getElementById('upload-overlay');
    if (uploadOverlay) {
      uploadOverlay.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'text/csv') {
          this.processFile(files[0]);
        } else {
          this.showToast('請上傳 CSV 檔案', 'error');
        }
        
        this.closeUpload();
      });

      uploadOverlay.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }
  }

  // 顯示上傳界面
  showUpload() {
    const overlay = document.getElementById('upload-overlay');
    if (overlay) {
      overlay.classList.add('show');
    }
  }

  // 關閉上傳界面
  closeUpload() {
    const overlay = document.getElementById('upload-overlay');
    if (overlay) {
      overlay.classList.remove('show');
    }
  }

  // 顯示 QR 掃描器
  showQRScanner() {
    console.log('啟動 QR 掃描器');
    if (window.qrScanner) {
      window.qrScanner.show();
    } else {
      this.showToast('QR 掃描器尚未載入，請稍後再試', 'error');
    }
  }

  // 處理檔案上傳
  handleFileUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      this.processFile(file);
    } else {
      this.showToast('請選擇 CSV 檔案', 'error');
    }
    this.closeUpload();
  }

  // 處理 CSV 檔案
  processFile(file) {
    this.showLoading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const oldData = [...this.data];
        
        this.parseCSV(csvText);
        
        // 保留已盤點的狀態
        this.data.forEach(item => {
          const oldItem = oldData.find(old => old.編號 === item.編號);
          if (oldItem) {
            item.狀態 = oldItem.狀態;
            item.最後更新 = oldItem.最後更新;
          }
        });
        
        this.generateClassrooms();
        this.render();
        this.saveStatus();
        
        this.showToast(`成功載入 ${this.data.length} 筆設備資料`, 'success');
      } catch (error) {
        this.showToast('CSV 檔案格式錯誤', 'error');
      } finally {
        this.showLoading(false);
      }
    };
    
    reader.readAsText(file, 'UTF-8');
  }

  // 主題切換
  toggleTheme() {
    const themes = ['default', 'high-contrast', 'colorblind'];
    const currentIndex = themes.indexOf(this.theme);
    this.theme = themes[(currentIndex + 1) % themes.length];
    this.applyTheme();
    this.renderTable();
    this.showToast(`已切換至 ${this.theme} 主題`, 'info');
  }

  // 應用主題
  applyTheme() {
    document.body.classList.remove('theme-high-contrast', 'theme-colorblind');
    if (this.theme === 'high-contrast') {
      document.body.classList.add('theme-high-contrast');
    } else if (this.theme === 'colorblind') {
      document.body.classList.add('theme-colorblind');
    }
  }

  // 設定篩選
  setFilter(filter) {
    this.currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    this.renderTable();
  }

  // 渲染所有內容
  render() {
    this.renderClassroomList();
    this.renderTable();
    this.updateStats();
    this.updateProgressRing();
  }

  // 渲染教室清單
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

  // 選擇教室
  selectClassroom(classroom) {
    this.currentClassroom = classroom;
    this.selectedItems.clear();
    this.render();
  }

  // 過濾教室
  filterClassrooms() {
    const keyword = document.getElementById('classroom-search')?.value.toLowerCase() || '';
    const items = document.querySelectorAll('#classroom-list li');
    
    items.forEach((item, index) => {
      if (index === 0) return; // 跳過"全部"選項
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(keyword) ? '' : 'none';
    });
  }

  // 渲染表格
  renderTable() {
    const keyword = document.getElementById('search-input')?.value.toLowerCase() || '';
    const tbody = document.querySelector('#equipment-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let filteredData = this.getFilteredData(keyword);
    
    filteredData.forEach(item => {
      const tr = document.createElement('tr');
      tr.className = this.selectedItems.has(item.編號) ? 'selected' : '';
      tr.setAttribute('data-equipment-id', item.編號); // 添加設備ID屬性
      
      tr.innerHTML = `
        <td>
          <input type="checkbox" ${this.selectedItems.has(item.編號) ? 'checked' : ''} 
                 onchange="window.inventory.toggleSelect('${item.編號}', this.checked)">
        </td>
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

  // 獲取過濾後的資料
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

  // 關鍵字匹配
  matchesKeyword(item, keyword) {
    return item.編號.toLowerCase().includes(keyword) ||
           item.名稱.toLowerCase().includes(keyword) ||
           item.教室.toLowerCase().includes(keyword);
  }

  // 獲取狀態樣式類別
  getStatusClass(status) {
    return status === '已盤點' ? 'status-checked' : 'status-unchecked';
  }

  // 切換選擇狀態
  toggleSelect(id, checked) {
    if (checked) {
      this.selectedItems.add(id);
    } else {
      this.selectedItems.delete(id);
    }
    this.renderTable();
    this.updateSelectedCount();
  }

  // 全選/取消全選
  selectAll(checked) {
    const filteredData = this.getFilteredData(document.getElementById('search-input')?.value.toLowerCase() || '');
    
    if (checked) {
      filteredData.forEach(item => this.selectedItems.add(item.編號));
    } else {
      filteredData.forEach(item => this.selectedItems.delete(item.編號));
    }
    
    this.renderTable();
    this.updateSelectedCount();
  }

  // 切換設備狀態 - 優化版本
  toggleStatus(equipmentId) {
    console.log('切換設備狀態:', equipmentId);
    
    const item = this.data.find(d => d.編號 === equipmentId);
    if (!item) {
      console.error('找不到設備:', equipmentId);
      this.showToast(`找不到設備：${equipmentId}`, 'error');
      return;
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

  // QR 掃描結果處理 - 核心方法
  handleQRScan(scannedData) {
    console.log('處理 QR 掃描結果:', scannedData);
    
    if (!scannedData || !scannedData.trim()) {
      console.warn('掃描結果為空');
      this.showToast('掃描結果為空', 'error');
      return false;
    }
    
    const cleanData = scannedData.trim();
    
    // 尋找對應的設備
    const item = this.data.find(d => d.編號 === cleanData);
    
    if (!item) {
      console.warn('找不到設備:', cleanData);
      this.showToast(`❌ 找不到設備編號：${cleanData}`, 'error');
      return false;
    }
    
    console.log('找到對應設備:', item);
    
    // 檢查當前狀態並處理
    if (item.狀態 === '未盤點') {
      // 直接盤點
      const updatedItem = this.toggleStatus(cleanData);
      if (updatedItem) {
        this.showToast(`✅ ${item.編號} - ${item.名稱} 盤點完成`, 'success');
        this.highlightEquipment(cleanData);
        return true;
      }
    } else {
      // 已經盤點過了
      this.showToast(`ℹ️ ${item.編號} - ${item.名稱} 已盤點過 (${item.最後更新})`, 'info');
      
      // 詢問是否要取消盤點
      setTimeout(() => {
        if (confirm(`設備 ${item.編號} - ${item.名稱} 已經盤點過了\n盤點時間: ${item.最後更新}\n\n是否要取消盤點？`)) {
          const updatedItem = this.toggleStatus(cleanData);
          if (updatedItem) {
            this.showToast(`❌ ${item.編號} - ${item.名稱} 已取消盤點`, 'warning');
          }
        }
      }, 500);
      
      this.highlightEquipment(cleanData);
      return true;
    }
    
    return false;
  }

  // 高亮顯示設備 - 改進版本
  highlightEquipment(equipmentId) {
    try {
      // 查找表格中的設備行
      const table = document.querySelector('#equipment-table tbody');
      if (!table) {
        console.warn('找不到設備表格');
        return;
      }
      
      // 使用 data 屬性查找更準確
      const targetRow = table.querySelector(`tr[data-equipment-id="${equipmentId}"]`);
      
      if (targetRow) {
        // 高亮顯示
        targetRow.style.backgroundColor = '#fff3cd';
        targetRow.style.transition = 'background-color 0.3s ease';
        
        // 滾動到視圖中
        targetRow.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        
        // 3秒後移除高亮
        setTimeout(() => {
          targetRow.style.backgroundColor = '';
        }, 3000);
        
        console.log('成功高亮設備:', equipmentId);
      } else {
        console.warn('在表格中找不到設備行:', equipmentId);
        
        // 備用方法：遍歷所有行
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const idCell = row.querySelector('td:nth-child(2) strong');
          if (idCell && idCell.textContent.trim() === equipmentId) {
            row.style.backgroundColor = '#fff3cd';
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              row.style.backgroundColor = '';
            }, 3000);
            console.log('使用備用方法成功高亮設備:', equipmentId);
            break;
          }
        }
      }
    } catch (error) {
      console.error('高亮設備失敗:', error);
    }
  }

  // 批量盤點
  bulkCheck() {
    if (this.selectedItems.size === 0) {
      this.showToast('請先選擇要盤點的設備', 'warning');
      return;
    }
    
    const selectedCount = this.selectedItems.size;
    const timestamp = new Date().toLocaleString('zh-TW');
    
    this.selectedItems.forEach(id => {
      const item = this.data.find(d => d.編號 === id);
      if (item && item.狀態 === '未盤點') {
        item.狀態 = '已盤點';
        item.最後更新 = timestamp;
      }
    });
    
    this.selectedItems.clear();
    this.saveStatus();
    this.render();
    
    this.showToast(`批量盤點完成，共 ${selectedCount} 項設備`, 'success');
  }

  // 更新統計資訊
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
    
    this.updateSelectedCount();
  }

  // 更新選擇數量
  updateSelectedCount() {
    const selectedElement = document.getElementById('selected-count');
    if (selectedElement) {
      selectedElement.textContent = this.selectedItems.size;
    }
  }

  // 更新進度環
  updateProgressRing() {
    const total = this.data.length;
    const checked = this.data.filter(d => d.狀態 === '已盤點').length;
    const progress = total > 0 ? (checked / total) * 100 : 0;
    
    const progressElement = document.getElementById('progress-percent');
    const circle = document.querySelector('.progress-ring-fill');
    
    if (progressElement) {
      progressElement.textContent = `${Math.round(progress)}%`;
    }
    
    if (circle) {
      // 更新圓環進度
      const circumference = 2 * Math.PI * 50;
      const offset = circumference - (progress / 100) * circumference;
      circle.style.strokeDashoffset = offset;
      
      // 更新顏色
      if (progress === 100) {
        circle.style.stroke = '#28A745';
        if (progressElement) progressElement.style.color = '#28A745';
      } else if (progress >= 50) {
        circle.style.stroke = '#FFC107';
        if (progressElement) progressElement.style.color = '#FFC107';
      } else {
        circle.style.stroke = '#DC3545';
        if (progressElement) progressElement.style.color = '#DC3545';
      }
    }
  }

  // 儲存狀態
  saveStatus() {
    try {
      const statusData = this.data.map(d => ({
        編號: d.編號,
        狀態: d.狀態,
        最後更新: d.最後更新
      }));
      localStorage.setItem('equipment-status', JSON.stringify(statusData));
      console.log('狀態已保存到 localStorage');
    } catch (error) {
      console.error('儲存狀態失敗:', error);
    }
  }

  // 恢復狀態
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

  // 重置狀態
  resetStatus() {
    if (confirm('確定要重置所有設備盤點狀態嗎？此操作無法復原。')) {
      this.data.forEach(item => {
        item.狀態 = '未盤點';
        item.最後更新 = '';
      });
      
      this.selectedItems.clear();
      localStorage.removeItem('equipment-status');
      this.render();
      this.showToast('已重置所有設備盤點狀態', 'success');
    }
  }

  // 匯出資料
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
    } else {
      this.showToast('瀏覽器不支援檔案下載', 'error');
    }
  }

  // 生成 CSV 內容
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

  // 顯示載入中
  showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.display = show ? 'flex' : 'none';
    }
  }

  // 顯示提示訊息
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
      // 備用顯示方式
      console.log(`Toast [${type}]:`, message);
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
    }, 5000);
  }
}

// 全域函數（供 HTML 調用）
function closeUpload() {
  if (window.inventory) {
    window.inventory.closeUpload();
  }
}

function closeQRScanner() {
  if (window.qrScanner) {
    window.qrScanner.hide();
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 載入完成，開始初始化設備盤點系統');
  
  // 創建系統實例
  const inventory = new EquipmentInventory();
  
  // 確保全域可訪問
  window.inventory = inventory;
  
  console.log('設備盤點系統已初始化並設為全域變數');
});
