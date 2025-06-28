const input = document.getElementById('file-input');
const button = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');
const loginContainer = document.getElementById('login-container');
const mainContent = document.getElementById('main-content');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

// --- ⚙️ 全域設定 ---
// 請替換為您的 Google Client ID
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // 請與 index (3).html 中的 client_id 保持一致
// 請替換為您的檔案管理 Worker URL
const WORKER_UPLOAD_URL = 'https://upload-arcantstudio.tu28291797.workers.dev/'; // 這是您這個檔案管理Worker的URL
const PUBLIC_FOLDER_URL = 'https://file.arcantstudio.com/public/'; // 這是您GitHub Pages的檔案公開URL

let googleIdToken = null; // 用於儲存 Google ID Token

// 檔案大小限制（以位元組為單位）
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB，考慮到 Base64 編碼會增加約 33% 大小

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

// --- 輔助函式 ---

async function loadFiles() {
  if (!googleIdToken) {
    fileList.innerHTML = '<p>請先登入以載入檔案列表。</p>';
    showLoginUI();
    return;
  }
  fileList.innerHTML = '載入中...';
  try {
    const res = await fetch('https://api.github.com/repos/PGpenguin72/file.arcantstudio.com/contents/public', {
      headers: {
        // 在這裡加入 GitHub token 認證
        // 注意：GitHub API 讀取公開 repo 的 public 目錄不一定需要 token，但為了安全和速率限制，
        // 建議在 Worker 端處理這個列表獲取，然後 Worker 回傳給你。
        // 不過，如果您的 GitHub repo 是公開的，直接這樣讀取也行。
        // 如果您的 repo 是私有的，這裡需要加 token
        // 'Authorization': `Bearer YOUR_GITHUB_READ_TOKEN` // 例如
      }
    });
    
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

// --- 事件監聽器 ---

// 頁面載入完成後，檢查登入狀態
document.addEventListener('DOMContentLoaded', () => {
    // 首次載入時，直接顯示登入介面，因為還沒有 token
    showLoginUI(); 
});

button.onclick = async () => {
  if (!googleIdToken) {
    alert('請先登入才能上傳檔案！');
    showLoginUI();
    return;
  }

  button.disabled = true;
  button.textContent = '上傳中...';
  
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
    button.disabled = false;
    button.textContent = '上傳檔案';
  }
};

logoutBtn.addEventListener('click', logout);

// 將 handleCredentialResponse 暴露給 Google Sign-In 函式庫
window.handleCredentialResponse = handleCredentialResponse;
// 將 deleteFile 暴露給 HTML 中的 onclick
window.deleteFile = deleteFile;
