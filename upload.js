const input = document.getElementById('file-input');
const button = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');
const WORKER_UPLOAD_URL = 'https://upload-arcantstudio.tu28291797.workers.dev/';
const PUBLIC_FOLDER_URL = 'https://file.arcantstudio.com/public/';

// 檔案大小限制（以位元組為單位）
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB，考慮到 Base64 編碼會增加約 33% 大小

async function loadFiles() {
  fileList.innerHTML = '載入中...';
  try {
    const res = await fetch('https://api.github.com/repos/PGpenguin72/file.arcantstudio.com/contents/public');
    
    if (!res.ok) {
      if (res.status === 404) {
        fileList.innerHTML = '目錄不存在或為空';
        console.log('public 目錄可能還不存在，這是正常的');
        return;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const files = await res.json();
    console.log('GitHub API 回應：', files);
    
    // 檢查回應格式
    if (!Array.isArray(files)) {
      if (files.message) {
        fileList.innerHTML = `GitHub API 錯誤：${files.message}`;
        console.error('GitHub API 錯誤：', files);
        return;
      }
      fileList.innerHTML = '回應格式不正確';
      console.error('預期收到陣列，實際收到：', files);
      return;
    }
    
    if (files.length === 0) {
      fileList.innerHTML = '目前沒有檔案';
      return;
    }
    
    // 過濾出檔案（排除目錄）
    const fileItems = files.filter(item => item.type === 'file');
    
    if (fileItems.length === 0) {
      fileList.innerHTML = '目錄中沒有檔案';
      return;
    }
    
    fileList.innerHTML = fileItems.map(file =>
      `<div style="margin: 8px 0; padding: 10px; border: 1px solid #e0e0e0; border-radius: 5px; background: #f9f9f9; display: flex; align-items: center; justify-content: space-between;">
        <div style="flex-grow: 1;">
          <a href="${PUBLIC_FOLDER_URL}${file.name}" target="_blank" style="text-decoration: none; color: #007bff; font-weight: 500;">
            📄 ${file.name}
          </a>
          <span style="color: #666; font-size: 0.9em; margin-left: 10px;">
            (${formatFileSize(file.size)})
          </span>
        </div>
        <button onclick="deleteFile('${file.name}', '${file.sha}')" 
                style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 0.9em;"
                onmouseover="this.style.background='#c82333'"
                onmouseout="this.style.background='#dc3545'">
          🗑️ 刪除
        </button>
      </div>`
    ).join('');
    
  } catch (err) {
    fileList.innerHTML = '載入錯誤，請檢查網路連線';
    console.error('載入檔案列表時發生錯誤：', err);
  }
}

// 將 ArrayBuffer 轉換為 Base64，適用於大檔案
function arrayBufferToBase64(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const chunkSize = 8192; // 以 8KB 為單位處理，避免堆疊溢位
  let binaryString = '';
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, chunk);
  }
  
  return btoa(binaryString);
}

// 格式化檔案大小顯示
function formatFileSize(bytes) {
  if (bytes === 0) return '0 位元組';
  const k = 1024;
  const sizes = ['位元組', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 刪除檔案功能
async function deleteFile(filename, sha) {
  if (!confirm(`確定要刪除檔案 "${filename}" 嗎？此操作無法復原！`)) {
    return;
  }

  try {
    console.log(`準備刪除檔案：${filename}，SHA: ${sha}`);
    
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        filename: filename,
        sha: sha
      }),
    });
    
    console.log(`刪除請求回應狀態：${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        console.error('刪除失敗詳情：', errorData);
        if (errorData.error) {
          errorMessage += `\n錯誤詳情：${errorData.error}`;
        }
      } catch (parseError) {
        console.error('無法解析錯誤回應：', parseError);
      }
      
      alert(`刪除失敗：${errorMessage}`);
      return;
    }
    
    const data = await res.json();
    console.log('刪除成功回應：', data);
    alert(`檔案 "${filename}" 已成功刪除！`);
    
    // 重新載入檔案列表
    await loadFiles();
    
  } catch (error) {
    console.error('刪除過程中發生錯誤：', error);
    alert(`刪除失敗：${error.message}`);
  }
}

loadFiles();

button.onclick = async () => {
  button.disabled = true;
  button.textContent = '上傳中...';
  
  try {
    const file = input.files[0];
    if (!file) {
      alert('請選擇檔案！');
      return;
    }

    // 檢查檔案大小
    if (file.size > MAX_FILE_SIZE) {
      alert(`檔案太大！最大允許 ${formatFileSize(MAX_FILE_SIZE)}，您的檔案為 ${formatFileSize(file.size)}`);
      return;
    }

    console.log(`準備上傳檔案：${file.name}，大小：${formatFileSize(file.size)}`);
    
    const content = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(content);
    
    console.log(`Base64 編碼後大小：${formatFileSize(base64.length)}`);
    
    // 增加請求超時控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log('請求超時，已取消');
    }, 30000); // 30秒超時
    
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        filename: file.name, 
        content: base64 
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`伺服器回應狀態：${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      // 嘗試讀取錯誤訊息
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        console.error('伺服器錯誤詳情：', errorData);
        if (errorData.error) {
          errorMessage += `\n錯誤詳情：${errorData.error}`;
        }
        if (errorData.details) {
          errorMessage += `\n詳細資訊：${JSON.stringify(errorData.details)}`;
        }
      } catch (parseError) {
        console.error('無法解析錯誤回應：', parseError);
        try {
          const textResponse = await res.text();
          console.error('原始錯誤回應：', textResponse);
          errorMessage += `\n原始回應：${textResponse}`;
        } catch {
          errorMessage += '\n無法讀取錯誤回應';
        }
      }
      
      alert(`上傳失敗：${errorMessage}`);
      return;
    }
    
    const data = await res.json();
    console.log('上傳成功回應：', data);
    alert(`上傳成功！檔案已儲存為：${file.name}`);
    
    // 重置檔案輸入框
    input.value = '';
    
    // 延遲一秒後重新載入檔案列表，讓 GitHub 有時間更新
    setTimeout(async () => {
      await loadFiles();
    }, 1000);
    
  } catch (error) {
    console.error('上傳過程中發生錯誤：', error);
    
    if (error.name === 'AbortError') {
      alert('上傳超時，請檢查網路連線或稍後重試');
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      alert('網路連線錯誤，請檢查網路連線後重試');
    } else if (error.name === 'RangeError') {
      alert('檔案太大，無法處理');
    } else {
      alert(`發生未知錯誤：${error.message}`);
    }
  } finally {
    button.disabled = false;
    button.textContent = '上傳檔案';
  }
};
