const input = document.getElementById('file-input');
const button = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');

const WORKER_UPLOAD_URL = 'https://upload-arcantstudio.tu28291797.workers.dev/';
const PUBLIC_FOLDER_URL = 'https://file.arcantstudio.com/public/';

async function loadFiles() {
  fileList.innerHTML = '載入中...';
  try {
    const res = await fetch('https://api.github.com/repos/PGpenguin72/file.arcantstudio.com/contents/public');
    if (!res.ok) {
      throw new Error(`GitHub API 錯誤: ${res.status}`);
    }
    const files = await res.json();

    if (!Array.isArray(files)) {
      fileList.innerHTML = '讀取失敗：GitHub 回傳格式錯誤';
      console.error(files);
      return;
    }

    if (files.length === 0) {
      fileList.innerHTML = '目前沒有檔案';
      return;
    }

    fileList.innerHTML = files.map(file =>
      `<a href="${PUBLIC_FOLDER_URL}${file.name}" target="_blank" rel="noopener noreferrer">${file.name}</a>`
    ).join('<br>');

  } catch (error) {
    fileList.innerHTML = '載入錯誤，請稍後再試';
    console.error('讀取檔案清單錯誤：', error);
  }
}

loadFiles();

button.onclick = async () => {
  button.disabled = true; // 防止連點

  try {
    const file = input.files[0];
    if (!file) {
      alert('請選擇檔案！');
      return;
    }

    const content = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(content)));

    const res = await fetch(WORKER_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, content: base64 }),
    });

    if (res.ok) {
      alert('上傳成功！');
      await loadFiles();
    } else {
      const errorText = await res.text();
      console.error('上傳失敗，回傳內容：', errorText);
      alert('上傳失敗，請看 console');
    }
  } catch (error) {
    console.error('網路或程式錯誤：', error);
    alert('發生錯誤，請稍後再試');
  } finally {
    button.disabled = false;
  }
};
