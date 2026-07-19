# Railway Deploy Guide

## Muc tieu

Project nay da duoc chuan hoa de deploy bang mot Railway service va mot domain:

- `npm install`
- `npm run build`
- `npm start`

Frontend React duoc build tai root `build/`.
Backend Express trong `Chat-App-Backend/` se phuc vu static files sau khi build va xu ly API + Socket.IO cung domain.

## Cau truc sau refactor

- `package.json`: file duy nhat Railway can dung
- `src/`, `public/`: frontend CRA o root
- `Chat-App-Backend/`: backend Express + Socket.IO
- `.env.example`: bien moi truong mau

## Bien moi truong can set tren Railway

Tao cac bien moi truong tu `.env.example`:

- Bat buoc de app boot: `DATABASE`, `JWT_SECRET`
- Khuyen nghi cho Railway production: `NODE_ENV=production`, `CLIENT_URL`
- Tuy chon / do Railway cap: `PORT`
- Feature flag cho test nhanh auth: `ENABLE_EMAIL_VERIFICATION=true`
- Khi `ENABLE_EMAIL_VERIFICATION=false`: bo qua gui OTP email, user moi duoc set `verified=true`, login duoc ngay de test tren Railway
- Khi `ENABLE_EMAIL_VERIFICATION=true`: OTP + verify email hoat dong lai nhu binh thuong
- Bien theo tinh nang:
  - `SG_KEY`: bat buoc neu can gui email OTP / reset password
  - `ZEGO_APP_ID`: bat buoc neu can audio/video call
  - `ZEGO_SERVER_SECRET`: bat buoc neu can audio/video call

Ghi chu:

- `REACT_APP_API_URL` de trong neu frontend va backend cung domain
- `REACT_APP_SOCKET_URL` de trong neu Socket.IO dung cung domain
- `REACT_APP_*` la build-time env, phai set truoc khi chay `npm run build`
- Neu khong dung email trong giai doan smoke test, co the tam dat `ENABLE_EMAIL_VERIFICATION=false`

## Lenh Railway can chay

- Install command: `npm install`
- Build command: `npm run build`
- Start command: `npm start`

## Cach app hoat dong sau deploy

- Request frontend duoc Express phuc vu tu `build/`
- API giu nguyen namespace hien tai: `/auth/*`, `/user/*`
- Socket.IO client se ket noi cung domain neu khong set `REACT_APP_SOCKET_URL`
- Link reset password dung `CLIENT_URL`

## Local smoke test

1. Copy `.env.example` thanh `.env`
2. Dien gia tri that cho `DATABASE`, `JWT_SECRET`, va cac integration can dung
3. Chay:

```bash
npm install
npm run build
npm start
```

4. Mo `http://localhost:3000`

## Luu y

- Khong can tao service frontend rieng
- Khong can reverse proxy domain khac cho Socket.IO
- Neu build frontend can goi API khac domain, set `REACT_APP_API_URL` va `REACT_APP_SOCKET_URL` truoc khi chay `npm run build`
