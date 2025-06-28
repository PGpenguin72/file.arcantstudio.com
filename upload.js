// --- ⚙️ 全域設定 ---
// 請替換為您的 Google Client ID
const GOOGLE_CLIENT_ID = '98570753690-5lkkv0cg3r6d71cc9rs2p8uijmo8b8rv.apps.googleusercontent.com'; // 請與 index (3).html 中的 client_id 保持一致
// 請替換為您的檔案管理 Worker URL
const WORKER_UPLOAD_URL = 'https://upload-arcantstudio.tu28291797.workers.dev/'; 
const PUBLIC_FOLDER_URL = 'https://file.arcantstudio.com/public/'; 

let googleIdToken = null; // 用於儲存 Google ID Token

// 檔案大小限制（以位元組為單位）
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB，考慮到 Base64 編碼會增加約 33% 大小

// 在 DOMContentLoaded 之後才會初始化這些元素和事件監聽器
let input;
let uploadButton; 
let fileList;
let loginContainer;
let mainContent;
let userEmailSpan;
let logoutButton; 
let refreshButton; // 新增刷新按鈕的變數

// --- Google 登入相關函式 ---
async function handleCredentialResponse(response) {
  if (response.credential) {
    googleIdToken = response.credential;
    console.log('Google ID Token received:', googleIdToken);
    await verifyUser(googleIdToken);
  }
}

async function verifyUser(idToken) {
  try {
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}` 
      },
      body: JSON.stringify({ action: 'verify_user' }) 
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log('User verified successfully:', data.email);
      userEmailSpan.textContent = data.email; 
      loginContainer.style.display = 'none';
      mainContent.style.display = 'block';
      await loadFiles(); 
    } else {
      console.error('User verification failed:', data.message || 'Unknown error');
      alert(`登入失敗：${data.message || '無效的使用者或權限不足'}`);
      googleIdToken = null; 
      showLoginUI(); 
    }
  } catch (error) {
    console.error('Error during user verification:', error);
    alert('網路錯誤，無法驗證使用者身份。');
    googleIdToken = null; 
    showLoginUI(); 
  }
}

function showLoginUI() {
    loginContainer.style.display = 'block';
    mainContent.style.display = 'none';
    userEmailSpan.textContent = '';
}

function logout() {
    google.accounts.id.disableAutoSelect(); 
    googleIdToken = null; 
    showLoginUI(); 
    console.log('User logged out.');
}

// --- 檔案操作相關函式 ---

async function loadFiles() {
  if (!googleIdToken) {
    fileList.innerHTML = '<p class="info-message">請先登入以載入檔案列表。</p>';
    showLoginUI();
    return;
  }
  fileList.innerHTML = '<p class="info-message">載入中...</p>';
  try {
    // GitHub API 會返回未編碼的檔案名稱，這是正確的
    const res = await fetch('https://api.github.com/repos/PGpenguin72/file.arcantstudio.com/contents/public');
    
    if (!res.ok) {
      if (res.status === 404) {
        fileList.innerHTML = '<p class="info-message">目錄不存在或為空。請確認 GitHub 儲存庫中存在 `public` 資料夾。</p>';
        console.log('public 目錄可能還不存在，這是正常的，或者尚未有檔案');
        return;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const files = await res.json();
    console.log('GitHub API 回應：', files);
    
    if (!Array.isArray(files)) {
      if (files.message) {
        fileList.innerHTML = `<p class="error-message">GitHub API 錯誤：${files.message}</p>`;
        console.error('GitHub API 錯誤：', files);
        return;
      }
      fileList.innerHTML = '<p class="error-message">無法載入檔案列表：非預期的回應格式。</p>';
      return;
    }

    const fileItems = files.filter(item => item.type === 'file');

    if (fileItems.length === 0) {
      fileList.innerHTML = '<p class="info-message">目前沒有檔案。</p>';
      return;
    }
    
    fileList.innerHTML = ''; // 清空列表
    fileItems.forEach(file => {
      const fileCard = document.createElement('div');
      fileCard.className = 'file-card'; 

      // 檔案名稱和連結
      const fileLink = document.createElement('a');
      fileLink.href = PUBLIC_FOLDER_URL + encodeURIComponent(file.name); 
      fileLink.target = '_blank';
      fileLink.className = 'file-link';
      
      const fileIcon = document.createElement('span');
      fileIcon.className = 'file-icon';
      fileIcon.textContent = '📄'; // 您可以在這裡根據檔案類型判斷顯示不同的圖標

      const fileNameText = document.createElement('span');
      fileNameText.className = 'file-name-text';
      fileNameText.textContent = file.name; // 顯示原始名稱

      const fileSize = document.createElement('span');
      fileSize.className = 'file-size';
      fileSize.textContent = ` (${formatFileSize(file.size)})`;

      fileLink.appendChild(fileIcon);
      fileLink.appendChild(fileNameText);
      fileLink.appendChild(fileSize);

      // 操作按鈕容器
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'file-actions';

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '刪除';
      deleteBtn.className = 'btn btn-danger btn-sm'; 
      deleteBtn.onclick = () => deleteFile(file.name, file.sha);

      const renameBtn = document.createElement('button');
      renameBtn.textContent = '改名';
      renameBtn.className = 'btn btn-secondary btn-sm'; 
      renameBtn.onclick = () => renameFile(file.name, file.sha);

      actionsDiv.appendChild(deleteBtn);
      actionsDiv.appendChild(renameBtn); 

      fileCard.appendChild(fileLink);
      fileCard.appendChild(actionsDiv);
      fileList.appendChild(fileCard);
    });
  } catch (error) {
    console.error('載入檔案列表失敗：', error);
    fileList.innerHTML = `<p class="error-message">載入檔案列表失敗：${error.message || '未知錯誤'}</p>`;
  }
}

async function uploadFile() {
  if (!googleIdToken) {
    alert('請先登入才能上傳檔案！');
    showLoginUI();
    return;
  }

  uploadButton.disabled = true;
  uploadButton.textContent = '上傳中...';
  
  try {
    const file = input.files[0];
    if (!file) {
      alert('請選擇檔案！');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert(`檔案太大！最大允許 ${formatFileSize(MAX_FILE_SIZE)}，您的檔案為 ${formatFileSize(file.size)}`);
      return;
    }

    console.log(`準備上傳檔案：${file.name}，大小：${formatFileSize(file.size)}`);
    
    const content = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(content);
    
    console.log(`Base64 編碼後大小：${formatFileSize(base64.length)}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log('請求超時，已取消');
    }, 30000); 
    
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${googleIdToken}` 
      },
      body: JSON.stringify({ 
        action: 'upload', 
        filename: file.name, // 這裡傳送原始檔名，讓 Worker 處理編碼
        content: base64 
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    console.log(`伺服器回應狀態：${res.status} ${res.statusText}`);
    
    if (!res.ok) {
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
    
    input.value = '';
    
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
    uploadButton.disabled = false;
    uploadButton.textContent = '上傳';
  }
}

async function deleteFile(filename, sha) {
  if (!googleIdToken) {
    alert('請先登入！');
    showLoginUI();
    return;
  }
  if (!confirm(`確定要刪除檔案 "${filename}" 嗎？此操作無法復原！`)) {
    return;
  }

  try {
    console.log(`準備刪除檔案：${filename}，SHA: ${sha}`);
    
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${googleIdToken}` 
      },
      body: JSON.stringify({ 
        action: 'delete', 
        filename: filename, // 這裡傳送原始檔名，讓 Worker 處理編碼
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
    
    await loadFiles();
    
  } catch (error) {
    console.error('刪除過程中發生錯誤：', error);
    alert(`刪除失敗：${error.message}`);
  }
}

async function renameFile(oldFilename, sha) {
  if (!googleIdToken) {
    alert('請先登入才能更改名稱！');
    showLoginUI();
    return;
  }
  const newFilename = prompt(`請輸入 ${oldFilename} 的新名稱：`);
  if (!newFilename) {
    return;
  }
  if (newFilename === oldFilename) {
    alert('新名稱與舊名稱相同，無需更改。');
    return;
  }

  try {
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': googleIdToken ? `Bearer ${googleIdToken}` : '', 
      },
      body: JSON.stringify({
        action: 'rename', 
        oldFilename: oldFilename, // 這裡傳送原始檔名，讓 Worker 處理編碼
        newFilename: newFilename, // 這裡傳送原始檔名，讓 Worker 處理編碼
        sha: sha 
      })
    });

    if (!res.ok) {
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
      alert(`更改名稱失敗：${errorMessage}`);
      return;
    }

    const data = await res.json();
    console.log('更改名稱成功回應：', data);
    alert(`檔案 ${oldFilename} 已成功更改名稱為 ${newFilename}！`);
    
    setTimeout(async () => {
      await loadFiles();
    }, 1000);

  } catch (error) {
    console.error('更改名稱過程中發生錯誤：', error);
    alert(`更改名稱過程中發生錯誤：${error.message || '未知錯誤'}`);
  }
}

// --- 輔助函式 ---
function arrayBufferToBase64(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const chunkSize = 8192; 
  let binaryString = '';
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, chunk);
  }
  
  return btoa(binaryString);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 位元組';
  const k = 1024;
  const sizes = ['位元組', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- 頁面載入及事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    input = document.getElementById('file-input');
    uploadButton = document.getElementById('upload-btn'); 
    fileList = document.getElementById('file-list');
    loginContainer = document.getElementById('login-container');
    mainContent = document.getElementById('main-content');
    userEmailSpan = document.getElementById('user-email');
    logoutButton = document.getElementById('logout-btn'); 
    refreshButton = document.getElementById('refresh-btn'); // 獲取新按鈕元素

    if (uploadButton) { 
        uploadButton.addEventListener('click', uploadFile);
    }
    if (logoutButton) { 
        logoutButton.addEventListener('click', logout);
    }
    if (refreshButton) { // 為刷新按鈕添加事件監聽器
        refreshButton.addEventListener('click', loadFiles);
    }
    
    // 如果沒有設定 Google Client ID，給出提示
    if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID' || !GOOGLE_CLIENT_ID) {
        alert('請在 upload.js 中設定您的 GOOGLE_CLIENT_ID');
        console.error('錯誤：GOOGLE_CLIENT_ID 未設定。請在 upload.js 檔案頂部設定正確的 Client ID。');
    }

    showLoginUI(); 
});

// 將函式暴露給 HTML 中的 onclick 和 Google Sign-In 函式庫
window.handleCredentialResponse = handleCredentialResponse;
window.deleteFile = deleteFile;
window.renameFile = renameFile;
window.logout = logout;
