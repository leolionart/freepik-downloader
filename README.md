# Freepik Pages Downloader

Tool cực gọn để:

- lưu `Freepik API key` ở cookie local trên trình duyệt
- paste link Freepik hoặc resource ID
- validate metadata resource trước khi tải
- gọi endpoint download chính thức của Freepik ở phía server qua Cloudflare Pages Functions

## Cấu trúc

- `index.html`: giao diện tĩnh
- `assets/app.js`: logic client
- `assets/styles.css`: style
- `functions/api/resource/[id].js`: validate resource
- `functions/api/download/[id].js`: lấy signed download URL từ Freepik

## Chạy local

```bash
npm install
npm run dev
```

## Deploy Cloudflare Pages

1. Push folder này lên Git.
2. Tạo project mới trong Cloudflare Pages.
3. Chọn:
   - Framework preset: `None`
   - Build command: để trống
   - Build output directory: `.`
4. Deploy.

Cloudflare Pages sẽ tự nhận thư mục `functions/` để chạy server-side routes.

## Lưu ý bảo mật

- API key được lưu ở cookie local cùng domain app để Functions đọc được.
- Key không được hard-code vào source.
- Với mô hình này key vẫn nằm ở phía trình duyệt người dùng cuối. Phù hợp nhất cho tool cá nhân/nội bộ nhỏ.
- Lệnh download gọi `GET /v1/resources/{id}/download`, đây là thao tác có thể tiêu tốn quota/chi phí từ tài khoản Freepik của key đó.
