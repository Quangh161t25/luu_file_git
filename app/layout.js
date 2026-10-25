import './globals.css';

export const metadata = {
  title: 'Lưu file GitHub',
  description: 'Tải PDF, ảnh, video lên repo GitHub',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
