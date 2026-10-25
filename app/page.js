'use client';

import { useEffect, useState } from 'react';
import {
  MAX_FILE_SIZE,
  WARN_FILE_SIZE,
  REPO_SOFT_LIMIT,
  REPO_HARD_LIMIT,
  getRepo,
  listFiles,
  uploadFiles,
  deleteFile,
  rawUrl,
  blobUrl,
  formatSize,
} from '../lib/github';

const ACCEPT = 'application/pdf,image/*,video/*';
const DEFAULTS = { owner: 'Quangh161t25', repo: 'luu_file_git', branch: 'main', dir: 'uploads' };

function isAllowed(file) {
  return (
    file.type === 'application/pdf' || file.type.startsWith('image/') || file.type.startsWith('video/')
  );
}

function kindOf(path) {
  const ext = path.split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

export default function Home() {
  const [cfg, setCfg] = useState({ token: '', ...DEFAULTS });
  const [remember, setRemember] = useState(true);
  const [repoInfo, setRepoInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [progress, setProgress] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('luu-file-git') || 'null');
      if (saved) setCfg((c) => ({ ...c, ...saved }));
    } catch {}
  }, []);

  const set = (key) => (e) => setCfg({ ...cfg, [key]: e.target.value.trim() });

  async function refresh() {
    if (!cfg.token) return setMsg({ type: 'error', text: 'Hãy nhập GitHub token.' });
    setBusy(true);
    setMsg(null);
    try {
      try {
        if (remember) localStorage.setItem('luu-file-git', JSON.stringify(cfg));
        else localStorage.removeItem('luu-file-git');
      } catch {}
      const info = await getRepo(cfg.token, cfg.owner, cfg.repo);
      setRepoInfo(info);
      setFiles(await listFiles(cfg.token, cfg.owner, cfg.repo, cfg.branch, cfg.dir));
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  function addFiles(list) {
    const arr = Array.from(list);
    const bad = arr.filter((f) => !isAllowed(f));
    const tooBig = arr.filter((f) => isAllowed(f) && f.size > MAX_FILE_SIZE);
    const ok = arr.filter((f) => isAllowed(f) && f.size <= MAX_FILE_SIZE);
    const notes = [];
    if (bad.length) notes.push(`Bỏ qua ${bad.length} file không phải PDF/ảnh/video.`);
    if (tooBig.length)
      notes.push(`Bỏ qua ${tooBig.map((f) => f.name).join(', ')} vì lớn hơn 100 MB (giới hạn của GitHub).`);
    setMsg(notes.length ? { type: 'error', text: notes.join(' ') } : null);
    setSelected((s) => [...s, ...ok]);
  }

  async function upload() {
    if (!repoInfo) return setMsg({ type: 'error', text: 'Bấm "Kết nối" trước.' });
    setBusy(true);
    setMsg(null);
    setProgress({});
    try {
      await uploadFiles(cfg.token, cfg.owner, cfg.repo, cfg.branch, cfg.dir, selected, (i, status) =>
        setProgress((p) => ({ ...p, [i]: status }))
      );
      setMsg({ type: 'ok', text: `Đã tải ${selected.length} file lên GitHub.` });
      setSelected([]);
      setProgress({});
      await refresh();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(path) {
    if (!confirm(`Xoá ${path} khỏi repo?`)) return;
    setBusy(true);
    try {
      await deleteFile(cfg.token, cfg.owner, cfg.repo, cfg.branch, path);
      setFiles((f) => f.filter((x) => x.path !== path));
      setMsg({ type: 'ok', text: `Đã xoá ${path}` });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const selectedTotal = selected.reduce((s, f) => s + f.size, 0);
  const uploadsTotal = files.reduce((s, f) => s + f.size, 0);
  const repoBytes = repoInfo ? repoInfo.size * 1024 : 0; // API trả về đơn vị KB
  const pct = Math.min(100, (repoBytes / REPO_SOFT_LIMIT) * 100);

  return (
    <main>
      <h1>Lưu file lên GitHub</h1>
      <p className="muted">Tải PDF, ảnh, video lên repo GitHub. Token chỉ lưu trong trình duyệt của bạn.</p>

      <section className="card">
        <h2>1. Kết nối repo</h2>
        <label>
          GitHub token (fine-grained, quyền <b>Contents: Read and write</b>)
          <input type="password" value={cfg.token} onChange={set('token')} placeholder="github_pat_..." />
        </label>
        <div className="grid">
          <label>
            Chủ repo
            <input value={cfg.owner} onChange={set('owner')} />
          </label>
          <label>
            Tên repo
            <input value={cfg.repo} onChange={set('repo')} />
          </label>
          <label>
            Nhánh
            <input value={cfg.branch} onChange={set('branch')} />
          </label>
          <label>
            Thư mục lưu
            <input value={cfg.dir} onChange={set('dir')} />
          </label>
        </div>
        <label className="inline">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Nhớ token trên máy này
        </label>
        <button onClick={refresh} disabled={busy}>
          {busy ? 'Đang xử lý...' : 'Kết nối / Làm mới'}
        </button>
      </section>

      {repoInfo && (
        <section className="card">
          <h2>2. Dung lượng</h2>
          <div className="stats">
            <div>
              <span className="muted">Dung lượng repo</span>
              <strong>{formatSize(repoBytes)}</strong>
            </div>
            <div>
              <span className="muted">Thư mục {cfg.dir}/</span>
              <strong>
                {formatSize(uploadsTotal)} · {files.length} file
              </strong>
            </div>
            <div>
              <span className="muted">Còn lại (đến mức 1 GB)</span>
              <strong>{formatSize(Math.max(0, REPO_SOFT_LIMIT - repoBytes))}</strong>
            </div>
            <div>
              <span className="muted">Chế độ repo</span>
              <strong>{repoInfo.private ? 'Riêng tư' : 'Công khai'}</strong>
            </div>
          </div>
          <div className="bar">
            <div className={pct > 80 ? 'fill warn' : 'fill'} style={{ width: `${pct}%` }} />
          </div>
          <p className="muted small">
            Giới hạn GitHub: mỗi file tối đa 100 MB (cảnh báo từ 50 MB). Repo nên dưới 1 GB, tối đa khuyến nghị{' '}
            {formatSize(REPO_HARD_LIMIT)}. Số liệu “dung lượng repo” GitHub cập nhật chậm vài phút và tính cả lịch sử
            (file đã xoá vẫn chiếm chỗ).
          </p>
        </section>
      )}

      <section className="card">
        <h2>3. Chọn file</h2>
        <div
          className={dragging ? 'drop active' : 'drop'}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <p>Kéo thả file vào đây hoặc</p>
          <input type="file" multiple accept={ACCEPT} onChange={(e) => addFiles(e.target.files)} />
        </div>

        {selected.length > 0 && (
          <>
            <ul className="list">
              {selected.map((f, i) => (
                <li key={i}>
                  <span className="name">{f.name}</span>
                  <span className={f.size > WARN_FILE_SIZE ? 'size warn-text' : 'size'}>
                    {formatSize(f.size)}
                    {f.size > WARN_FILE_SIZE && ' (lớn, có thể chậm)'}
                  </span>
                  <span className="muted small">{progress[i]}</span>
                  {!busy && (
                    <button className="link" onClick={() => setSelected(selected.filter((_, j) => j !== i))}>
                      Bỏ
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p>
              Tổng: <b>{formatSize(selectedTotal)}</b>
              {repoInfo && repoBytes + selectedTotal > REPO_SOFT_LIMIT && (
                <span className="warn-text"> — sau khi tải repo sẽ vượt 1 GB</span>
              )}
            </p>
            <button onClick={upload} disabled={busy || !repoInfo}>
              {busy ? 'Đang tải lên...' : `Tải ${selected.length} file lên GitHub`}
            </button>
          </>
        )}
      </section>

      {msg && <p className={msg.type === 'ok' ? 'msg ok' : 'msg error'}>{msg.text}</p>}

      {repoInfo && (
        <section className="card">
          <h2>4. File đã lưu</h2>
          {files.length === 0 && <p className="muted">Chưa có file nào.</p>}
          <div className="gallery">
            {files.map((f) => {
              const kind = kindOf(f.path);
              const raw = rawUrl(cfg.owner, cfg.repo, cfg.branch, f.path);
              return (
                <div key={f.path} className="item">
                  <div className="thumb">
                    {kind === 'image' && !repoInfo.private ? (
                      <img src={raw} alt="" loading="lazy" />
                    ) : (
                      <span className="badge">{kind.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="name" title={f.path}>
                    {f.path.split('/').pop()}
                  </div>
                  <div className="muted small">{formatSize(f.size)}</div>
                  <div className="actions">
                    <a href={blobUrl(cfg.owner, cfg.repo, cfg.branch, f.path)} target="_blank" rel="noreferrer">
                      Xem
                    </a>
                    {!repoInfo.private && (
                      <a href={raw} target="_blank" rel="noreferrer">
                        Link tải
                      </a>
                    )}
                    <button className="link danger" onClick={() => remove(f.path)} disabled={busy}>
                      Xoá
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
