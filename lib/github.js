// Gọi GitHub REST API trực tiếp từ trình duyệt bằng token của người dùng.
const API = 'https://api.github.com';

export const MB = 1024 * 1024;
export const MAX_FILE_SIZE = 100 * MB; // GitHub chặn cứng file > 100 MB
export const WARN_FILE_SIZE = 50 * MB; // GitHub cảnh báo file > 50 MB
export const REPO_SOFT_LIMIT = 1024 * MB; // khuyến nghị repo < 1 GB
export const REPO_HARD_LIMIT = 5 * 1024 * MB; // khuyến nghị mạnh repo < 5 GB

async function gh(token, path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = (await res.json()).message || message;
    } catch {}
    throw new Error(`GitHub ${res.status}: ${message}`);
  }
  return res.status === 204 ? null : res.json();
}

const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

export function getRepo(token, owner, repo) {
  return gh(token, `/repos/${owner}/${repo}`);
}

// Liệt kê toàn bộ file trong thư mục dir (đệ quy) kèm dung lượng
export async function listFiles(token, owner, repo, branch, dir) {
  const data = await gh(token, `/repos/${owner}/${repo}/git/trees/${enc(branch)}?recursive=1`);
  const prefix = dir ? dir.replace(/\/+$/, '') + '/' : '';
  return data.tree
    .filter((t) => t.type === 'blob' && t.path.startsWith(prefix) && !t.path.endsWith('.gitkeep'))
    .map((t) => ({ path: t.path, size: t.size, sha: t.sha }))
    .sort((a, b) => b.path.localeCompare(a.path));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function safeName(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');
}

// Tạo 1 commit chứa các thay đổi tree (thêm hoặc xoá file)
async function commitTree(token, owner, repo, branch, entries, message) {
  const base = `/repos/${owner}/${repo}/git`;
  const ref = await gh(token, `${base}/ref/heads/${enc(branch)}`);
  const parentSha = ref.object.sha;
  const parent = await gh(token, `${base}/commits/${parentSha}`);
  const tree = await gh(token, `${base}/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: entries }),
  });
  const commit = await gh(token, `${base}/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });
  await gh(token, `${base}/refs/heads/${enc(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
  return commit;
}

// Upload nhiều file trong 1 commit. onProgress(index, status)
export async function uploadFiles(token, owner, repo, branch, dir, files, onProgress) {
  const entries = [];
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, 'Đang đọc file...');
    const content = await fileToBase64(file);
    onProgress?.(i, 'Đang tải lên GitHub...');
    const blob = await gh(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content, encoding: 'base64' }),
    });
    const folder = file.type.startsWith('image/')
      ? 'images'
      : file.type.startsWith('video/')
        ? 'videos'
        : 'pdf';
    entries.push({
      path: `${dir}/${folder}/${stamp}_${safeName(file.name)}`,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
    onProgress?.(i, 'Đã tải blob, chờ commit');
  }
  return commitTree(token, owner, repo, branch, entries, `Upload ${files.length} file qua web`);
}

export function deleteFile(token, owner, repo, branch, path) {
  return commitTree(
    token,
    owner,
    repo,
    branch,
    [{ path, mode: '100644', type: 'blob', sha: null }],
    `Xoá ${path}`
  );
}

export function rawUrl(owner, repo, branch, path) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${enc(path)}`;
}

export function blobUrl(owner, repo, branch, path) {
  return `https://github.com/${owner}/${repo}/blob/${branch}/${enc(path)}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(2)} MB`;
  return `${(bytes / 1024 / MB).toFixed(2)} GB`;
}
