# Lưu file lên GitHub (Next.js)

Web tải **PDF, ảnh, video** lên chính repo GitHub này (thư mục `uploads/`), có xem dung lượng repo và giới hạn.
Web chạy miễn phí trên **GitHub Pages**, gọi thẳng GitHub API từ trình duyệt bằng token của bạn.

## 1. Đẩy code lên GitHub

```bash
git init
git add .
git commit -m "Web upload file"
git branch -M main
git remote add origin https://github.com/Quangh161t25/luu_file_git.git
git push -u origin main
```

## 2. Bật GitHub Pages

Repo → **Settings → Pages → Source: GitHub Actions**.
Sau khi workflow chạy xong, web có ở: `https://quangh161t25.github.io/luu_file_git/`

> GitHub Pages miễn phí chỉ dùng được với repo **công khai** → file bạn tải lên ai cũng xem được.

## 3. Tạo token

GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**

- Repository access: *Only select repositories* → `luu_file_git`
- Permissions → Repository → **Contents: Read and write**

Dán token vào web. Token chỉ lưu trong trình duyệt của bạn (localStorage), không gửi đi đâu ngoài `api.github.com`.
**Đừng commit token vào code.**

## Giới hạn dung lượng của GitHub

| Mục | Giới hạn |
|---|---|
| 1 file | tối đa **100 MB** (cảnh báo từ 50 MB) |
| Repo | khuyến nghị **< 1 GB**, khuyến nghị mạnh **< 5 GB** |
| GitHub Pages site | 1 GB, băng thông ~100 GB/tháng |

File đã xoá vẫn nằm trong lịch sử git nên vẫn tính vào dung lượng repo.
Muốn lưu video lớn hơn 100 MB → dùng Git LFS, GitHub Releases (≤ 2 GB/file) hoặc dịch vụ khác (Google Drive, Cloudinary...).

## Chạy trên máy

```bash
npm install
npm run dev
```
