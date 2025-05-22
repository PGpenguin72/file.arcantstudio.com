// upload.js
const input = document.getElementById('file-input');
const button = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');

const WORKER_UPLOAD_URL = 'https://upload-arcantstudio.tu28291797.workers.dev/';
const PUBLIC_FOLDER_URL = 'https://file.arcantstudio.com/public/';

// 顯示 GitHub 上的檔案清單
async function loadFiles() {
  fileList.innerHTML = '載入中...';

  try {
    const res = await fetch('https://api.github.com/repos/PGpenguin72/file.arcantstudio.com/contents/public');
    const files = await res.json();

    if (!Array.isArray(files)) {
      fileList.innerHTML = '讀取失敗：GitHub 回傳錯誤';
      console.error(files);
      return;
    }

    fileList.innerHTML = files.map(file =>
      `<a href="${PUBLIC_FOLDER_URL}${file.name}" target="_blank">${file.name}</a>`
    ).join('<br>');
  } catch (err) {
    fileList.innerHTML = '載入錯誤';
    console.error(err);
  }
}

loadFiles();

button.onclick = async () => {
  const file = input.files[0];
  if (!file) return alert('請選擇檔案！');

  const content = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(content)));

  const res = await fetch(WORKER_UPLOAD_URL, {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      content: base64
    }),
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(errorText);
    alert("上傳失敗！錯誤資訊已顯示在開發者工具 Console");
  } else {
    alert("上傳成功！");
    loadFiles(); // 更新清單
  }
};
