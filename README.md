# Temp Mail Generator

A temporary email service with a REST API backend and GitHub Pages frontend.

## Features

✅ Generate temporary email addresses  
✅ Receive emails at temp addresses  
✅ Auto-cleanup after expiration  
✅ Real-time inbox viewer  
✅ Copy email to clipboard  
✅ No signup required  

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite
- **Email**: Ethereal (testing) / Mailtrap (production)
- **Frontend**: Vanilla JS + HTML/CSS
- **Hosting**: Railway (backend) + GitHub Pages (frontend)

## Getting Started

### Backend Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Create `.env` file:
```
PORT=3000
DATABASE_URL=./temp_mail.db
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_email
SMTP_PASS=your_ethereal_password
JWT_SECRET=your_super_secret_key
DOMAIN=yourdomain.temp
```

3. Start server:
```bash
npm start
```

### Frontend Setup

The frontend files are in the `docs/` folder (GitHub Pages compatible).

Deploy to GitHub Pages:
1. Push to main branch
2. Go to Settings → Pages
3. Set source to `docs` folder

## API Endpoints

### Get Available Domains
```bash
GET /api/domains
```

### Create Account
```bash
POST /api/accounts
Content-Type: application/json

{
  "domain": "temp"
}
```

Response:
```json
{
  "email": "randomuser@temp.mail",
  "token": "jwt_token_here",
  "expiresIn": 3600
}
```

### Get Messages
```bash
GET /api/messages
Authorization: Bearer <token>
```

### Delete Account
```bash
DELETE /api/accounts
Authorization: Bearer <token>
```

## Project Structure

```
temp-mail/
├── server/                 # Backend
│   ├── index.js
│   ├── package.json
│   ├── .env
│   └── database/
│       └── init.js
├── docs/                   # Frontend (GitHub Pages)
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## License

MIT
