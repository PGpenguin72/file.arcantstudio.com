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
    const files = await res.json();
    if (!Array.isArray(files)) {
      fileList.innerHTML = '讀取失敗：GitHub 回傳錯誤';
      console.error('GitHub API 錯誤：', files);
      return;
    }
    fileList.innerHTML = files.map(file =>
      `<a href="${PUBLIC_FOLDER_URL}${file.name}" target="_blank">${file.name}</a>`
    ).join('<br>');
  } catch (err) {
    fileList.innerHTML = '載入錯誤';
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
    
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        filename: file.name, 
        content: base64 
      }),
    });
    
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
      } catch (parseError) {
        console.error('無法解析錯誤回應：', parseError);
        const textResponse = await res.text();
        console.error('原始錯誤回應：', textResponse);
      }
      
      alert(`上傳失敗：${errorMessage}`);
      return;
    }
    
    const data = await res.json();
    console.log('上傳成功回應：', data);
    alert('上傳成功！');
    
    // 重置檔案輸入框
    input.value = '';
    
    // 重新載入檔案列表
    await loadFiles();
    
  } catch (error) {
    console.error('上傳過程中發生錯誤：', error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
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
