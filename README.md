# Freepik Downloader

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
- `chrome-extension/`: Chrome extension mở app từ tab Freepik hiện tại
- `privacy-policy.html`: privacy policy để dùng cho Chrome Web Store listing
- `scripts/package-extension.sh`: đóng gói ZIP cho Chrome extension

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

## Chrome Extension

Extension được thiết kế để không giữ API key riêng. Nó chỉ:

- đọc URL tab Freepik hiện tại
- hiện popup xác nhận
- chèn nút nổi ở góc phải dưới trên trang Freepik hợp lệ
- mở app web trên Cloudflare Pages với query `?import=<link>&download=1`

App web sẽ dùng cookie API key trên chính domain của nó để validate và tải.

### Load extension thủ công

1. Vào `chrome://extensions`
2. Bật `Developer mode`
3. Chọn `Load unpacked`
4. Trỏ tới thư mục `chrome-extension`

### Cấu hình extension

Lần đầu mở extension:

1. nhập URL app Cloudflare Pages, ví dụ `https://freepik-downloader.pages.dev`
2. bấm `Lưu app URL`
3. mở một trang resource trên Freepik
4. bấm icon extension rồi `Xác nhận và tải`
5. hoặc bấm trực tiếp nút nổi `Download bằng Freepik Downloader` trên trang Freepik

Extension sẽ mở app web với link đang xem và app sẽ tự chạy validate/download.

### Đóng gói để submit Chrome Web Store

```bash
npm run package:extension
```

Lệnh này tạo file ZIP tại:

```bash
release/freepik-downloader-extension.zip
```

Store assets để upload lên Chrome Web Store nằm ở:

```bash
chrome-extension/store-assets/
```

## Lưu ý bảo mật

- API key được lưu ở cookie local cùng domain app để Functions đọc được.
- Key không được hard-code vào source.
- Với mô hình này key vẫn nằm ở phía trình duyệt người dùng cuối. Phù hợp nhất cho tool cá nhân/nội bộ nhỏ.
- Lệnh download gọi `GET /v1/resources/{id}/download`, đây là thao tác có thể tiêu tốn quota/chi phí từ tài khoản Freepik của key đó.

## Chrome Web Store Notes

Theo tài liệu chính thức của Chrome Web Store:

- extension ZIP cần có icon PNG 128x128
- store listing cần tối thiểu: icon 128x128, một screenshot 1280x800, và small promo image 440x280
- phần privacy cần mô tả single purpose, giải thích permissions, và có privacy policy URL

Nguồn:

- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
