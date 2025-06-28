// upload.js
const input = document.getElementById('file-input');
const button = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');
const WORKER_UPLOAD_URL = 'https://upload-arcantstudio.tu28291797.workers.dev/';
const PUBLIC_FOLDER_URL = 'https://file.arcantstudio.com/public/';

// 檔案大小限制（以位元組為單位）
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB，考慮到 Base64 編碼會增加約 33% 大小

// --- 請取消註解以下所有變數和相關函數 ---
const loginContainer = document.getElementById('login-container');
const mainContent = document.getElementById('main-content');
const userEmailSpan = document.getElementById('user-email');
let googleIdToken = null;

async function loadFiles() {
  fileList.innerHTML = '載入中...';
  try {
    const res = await fetch('https://api.github.com/repos/PGpenguin72/file.arcantstudio.com/contents/public');
    // ... (這部分保持不變)
    
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

    if (files.length === 0) {
      fileList.innerHTML = '目前沒有檔案。';
      return;
    }
    
    fileList.innerHTML = ''; // 清空列表
    files.forEach(file => {
      // 過濾掉不是檔案的項目，例如資料夾
      if (file.type === 'file') {
        const div = document.createElement('div');
        div.className = 'file-item'; // 添加一個 class 以便 CSS 樣式化

        const link = document.createElement('a');
        link.href = PUBLIC_FOLDER_URL + file.name;
        link.target = '_blank';
        link.textContent = file.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '刪除';
        deleteBtn.onclick = () => deleteFile(file.name, file.sha);

        const renameBtn = document.createElement('button');
        renameBtn.textContent = '更改名稱';
        renameBtn.onclick = () => renameFile(file.name, file.sha);

        div.appendChild(link);
        div.appendChild(deleteBtn);
        div.appendChild(renameBtn); // 添加更改名稱按鈕
        fileList.appendChild(div);
      }
    });
  } catch (error) {
    console.error('載入檔案列表失敗：', error);
    fileList.innerHTML = `載入檔案列表失敗：${error.message || '未知錯誤'}`;
  }
}

async function uploadFile() {
  const file = input.files[0];
  // ... (這部分保持不變)
  
  // 讀取檔案內容為 Base64
  const reader = new FileReader();
  reader.readAsDataURL(file); // 讀取為 Data URL
  reader.onload = async () => {
    const base64Content = reader.result.split(',')[1]; // 提取 Base64 部分

    try {
      const res = await fetch(WORKER_UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': googleIdToken ? `Bearer ${googleIdToken}` : '', // <--- 取消註解這行
        },
        body: JSON.stringify({
          action: 'upload', // 告知 Worker 這是上傳操作
          filename: file.name,
          content: base64Content
        })
      });

      // ... (這部分保持不變)
      
    } catch (error) {
      console.error('上傳過程中發生錯誤：', error);
      // ... (這部分保持不變)
    }
  };
}

async function deleteFile(filename, sha) {
  // ... (這部分保持不變)

  try {
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': googleIdToken ? `Bearer ${googleIdToken}` : '', // <--- 取消註解這行
      },
      body: JSON.stringify({
        action: 'delete', // 告知 Worker 這是刪除操作
        filename: filename,
        sha: sha // 刪除需要 SHA
      })
    });

    // ... (這部分保持不變)

  } catch (error) {
    console.error('刪除過程中發生錯誤：', error);
    // ... (這部分保持不變)
  }
}

async function renameFile(oldFilename, sha) {
  // ... (這部分保持不變)

  try {
    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': googleIdToken ? `Bearer ${googleIdToken}` : '', // <--- 取消註解這行
      },
      body: JSON.stringify({
        action: 'rename', // 告知 Worker 這是重新命名操作
        oldFilename: oldFilename,
        newFilename: newFilename,
        sha: sha // 重新命名需要舊檔案的 SHA
      })
    });

    // ... (這部分保持不變)

  } catch (error) {
    console.error('更改名稱過程中發生錯誤：', error);
    // ... (這部分保持不變)
  }
}

// 事件監聽器
button.addEventListener('click', uploadFile);

// 頁面載入時載入檔案列表
document.addEventListener('DOMContentLoaded', () => {
    // --- 請取消註解以下部分 ---
    if (googleIdToken) {
        verifyUser(googleIdToken); // 如果已經有 token，嘗試驗證
    } else {
        showLoginUI(); // 否則顯示登入介面
    }
    // loadFiles(); // 這行請註解掉或刪除，因為 verifyUser 會呼叫 loadFiles
});

// --- 請取消註解以下所有函數 ---
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

// 顯示登入 UI 或主內容 UI
function showLoginUI() {
    loginContainer.style.display = 'block';
    mainContent.style.display = 'none';
    userEmailSpan.textContent = '';
}

// 將 deleteFile 和 renameFile 暴露給 HTML 中的 onclick (如果沒有使用模組化js)
window.deleteFile = deleteFile;
window.renameFile = renameFile;

// --- 請取消註解這行 ---
// 確保 handleCredentialResponse 對 Google Sign-In 函式庫是可見的
window.handleCredentialResponse = handleCredentialResponse;
