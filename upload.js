// --- ⚙️ 全域設定 ---
// 請替換為您的 Google Client ID
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // 請與 index (3).html 中的 client_id 保持一致
// 請替換為您的檔案管理 Worker URL
const WORKER_UPLOAD_URL = 'https://upload-arcantstudio.tu28291797.workers.dev/'; 
const PUBLIC_FOLDER_URL = 'https://file.arcantstudio.com/public/'; 

let googleIdToken = null; // 用於儲存 Google ID Token

// 檔案大小限制（以位元組為單位）
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB，考慮到 Base64 編碼會增加約 33% 大小

// 在 DOMContentLoaded 之後才會初始化這些元素和事件監聽器
// 這些變數現在是 `let`，且在 DOMContentLoaded 事件中才獲取其值
let input;
let uploadButton; // 改名以避免與外部 button.onclick 混淆
let fileList;
let loginContainer;
let mainContent;
let userEmailSpan;
let logoutButton; // 登出按鈕

// --- Google 登入相關函式 ---
// Google 登入成功後的回調函式
async function handleCredentialResponse(response) {
  if (response.credential) {
    googleIdToken = response.credential;
    console.log('Google ID Token received:', googleIdToken);
    await verifyUser(googleIdToken);
  }
}

// 驗證使用者身份 (與 Worker 溝通)
async function verifyUser(idToken) {
  try {
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}` // 傳遞 ID Token
      },
      body: JSON.stringify({ action: 'verify_user' }) // 特殊的 action
    });

    const data = await res.json();

    if (res.ok && data.success) {
      console.log('User verified successfully:', data.email);
      userEmailSpan.textContent = data.email; // 顯示用戶郵箱
      loginContainer.style.display = 'none';
      mainContent.style.display = 'block';
      await loadFiles(); // 驗證成功後載入檔案列表
    } else {
      console.error('User verification failed:', data.message || 'Unknown error');
      alert(`登入失敗：${data.message || '無效的使用者或權限不足'}`);
      googleIdToken = null; // 清除無效 Token
      showLoginUI(); // 顯示登入介面
    }
  } catch (error) {
    console.error('Error during user verification:', error);
    alert('網路錯誤，無法驗證使用者身份。');
    googleIdToken = null; // 清除 Token
    showLoginUI(); // 顯示登入介面
  }
}

// 顯示登入介面
function showLoginUI() {
    loginContainer.style.display = 'block';
    mainContent.style.display = 'none';
    userEmailSpan.textContent = '';
}

// 處理登出
function logout() {
    google.accounts.id.disableAutoSelect(); // 禁用自動選擇
    googleIdToken = null; // 清除 Token
    showLoginUI(); // 顯示登入介面
    console.log('User logged out.');
}

// --- 檔案操作相關函式 ---

async function loadFiles() {
  if (!googleIdToken) {
    fileList.innerHTML = '<p>請先登入以載入檔案列表。</p>';
    showLoginUI();
    return;
  }
  fileList.innerHTML = '載入中...';
  try {
    const res = await fetch('https://api.github.com/repos/PGpenguin72/file.arcantstudio.com/contents/public');
    
    if (!res.ok) {
      if (res.status === 404) {
        fileList.innerHTML = '目錄不存在或為空。請確認 GitHub 儲存庫中存在 `public` 資料夾。';
        console.log('public 目錄可能還不存在，這是正常的，或者尚未有檔案');
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
      fileList.innerHTML = '無法載入檔案列表：非預期的回應格式。';
      return;
    }

    const fileItems = files.filter(item => item.type === 'file');

    if (fileItems.length === 0) {
      fileList.innerHTML = '目前沒有檔案。';
      return;
    }
    
    fileList.innerHTML = ''; // 清空列表
    fileItems.forEach(file => {
      const div = document.createElement('div');
      div.className = 'file-item'; // 添加一個 class 以便 CSS 樣式化

      const link = document.createElement('a');
      link.href = PUBLIC_FOLDER_URL + file.name;
      link.target = '_blank';
      link.textContent = `📄 ${file.name} (${formatFileSize(file.size)})`;

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑️ 刪除';
      deleteBtn.className = 'action-btn delete-btn'; // 添加 class
      deleteBtn.onclick = () => deleteFile(file.name, file.sha);

      const renameBtn = document.createElement('button');
      renameBtn.textContent = '✏️ 更改名稱';
      renameBtn.className = 'action-btn rename-btn'; // 添加 class
      renameBtn.onclick = () => renameFile(file.name, file.sha);

      div.appendChild(link);
      div.appendChild(deleteBtn);
      div.appendChild(renameBtn); // *** 這行會把更改名稱按鈕加進去 ***
      fileList.appendChild(div);
    });
  } catch (error) {
    console.error('載入檔案列表失敗：', error);
    fileList.innerHTML = `載入檔案列表失敗：${error.message || '未知錯誤'}`;
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
    }, 30000); // 30秒超時
    
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${googleIdToken}` // 加入 Authorization header
      },
      body: JSON.stringify({ 
        action: 'upload', // 告知 Worker 這是上傳操作
        filename: file.name, 
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
        'Authorization': `Bearer ${googleIdToken}` // 加入 Authorization header
      },
      body: JSON.stringify({ 
        action: 'delete', // 告知 Worker 這是刪除操作
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
    
    await loadFiles();
    
  } catch (error) {
    console.error('刪除過程中發生錯誤：', error);
    alert(`刪除失敗：${error.message}`);
  }
}

// 重新命名檔案函式
async function renameFile(oldFilename, sha) {
  if (!googleIdToken) {
    alert('請先登入才能更改名稱！');
    showLoginUI();
    return;
  }
  const newFilename = prompt(`請輸入 ${oldFilename} 的新名稱：`);
  if (!newFilename) {
    // 用戶取消或輸入空名稱
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
        action: 'rename', // 告知 Worker 這是重新命名操作
        oldFilename: oldFilename,
        newFilename: newFilename,
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
// DOMContentLoaded 事件監聽器：確保 HTML 完全載入後再執行腳本
document.addEventListener('DOMContentLoaded', () => {
    // 初始化 DOM 元素變數
    // 現在這些變數會正確地在 DOM 準備好後才獲取其值
    input = document.getElementById('file-input');
    uploadButton = document.getElementById('upload-btn'); 
    fileList = document.getElementById('file-list');
    loginContainer = document.getElementById('login-container');
    mainContent = document.getElementById('main-content');
    userEmailSpan = document.getElementById('user-email');
    logoutButton = document.getElementById('logout-btn'); 

    // 綁定事件監聽器
    // 這裡加上了 null 檢查，以防萬一元素在非常規情況下不存在
    if (uploadButton) { 
        uploadButton.addEventListener('click', uploadFile);
    }
    if (logoutButton) { 
        logoutButton.addEventListener('click', logout);
    }

    // 啟動登入流程：檢查是否有儲存的 token，否則顯示登入介面
    // 注意：Google Identity Services 通常會處理 token 的持久化
    // 因此這裡可以直接檢查，然後嘗試驗證
    if (googleIdToken) { // 如果頁面載入時已經有 token (例如從 session storage 恢復)
        verifyUser(googleIdToken); 
    } else {
        showLoginUI(); 
    }
});

// 將函式暴露給 HTML 中的 onclick 和 Google Sign-In 函式庫
// 這是因為一些舊的 HTML onclick 屬性或外部函式庫需要直接存取這些函式
window.handleCredentialResponse = handleCredentialResponse;
window.deleteFile = deleteFile;
window.renameFile = renameFile;
window.logout = logout; // 暴露 logout 函式
