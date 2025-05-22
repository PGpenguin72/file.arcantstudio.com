// upload.js
const input = document.getElementById('file-input');
const button = document.getElementById('upload-btn');
const fileList = document.getElementById('file-list');

const WORKER_UPLOAD_URL = 'https://upload-arcantstudio.tu28291797.workers.dev/'; // 你會換成自己的 Worker 網址
const PUBLIC_FOLDER_URL = 'https://file.arcantstudio.com/public/'; // 你會換成自己網頁網址

// 顯示 GitHub 上的檔案清單
async function loadFiles() {
  fileList.innerHTML = '載入中...';
  const res = await fetch('https://api.github.com/repos/PGpenguin72/file.arcantstudio.com/contents/public');
  const files = await res.json();

  fileList.innerHTML = files.map(file =>
    `<a href="${PUBLIC_FOLDER_URL}${file.name}" target="_blank">${file.name}</a>`
  ).join('');
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
}
