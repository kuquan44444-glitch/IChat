# IChat - Real-time Chat Application

A modern, full-stack real-time chat application built with React and Node.js, featuring audio/video calling, file sharing, and a beautiful Material-UI interface.

![IChat Preview](https://via.placeholder.com/800x400/1976d2/ffffff?text=IChat+Real-time+Chat+Application)

## 🚀 Features

### 💬 **Real-time Messaging**
- Instant message delivery with Socket.io
- Typing indicators
- Message status (sent, delivered, read)
- Rich text support
- Emoji reactions

### 📞 **Audio & Video Calling**
- High-quality audio calls
- HD video calling
- Screen sharing capabilities
- Call history and logs
- Incoming call notifications

### 👥 **User Management**
- User registration and authentication
- Profile management with avatars
- Friend request system
- User search and discovery
- Online/offline status

### 📁 **File Sharing**
- Image, document, and media sharing
- File preview capabilities
- Drag & drop file upload
- File size optimization

### 🎨 **Modern UI/UX**
- Responsive Material-UI design
- Dark/Light theme support
- Mobile-first approach
- Smooth animations
- Customizable interface

## 🛠️ Tech Stack

### **Frontend**
- **React 18** - Modern React with hooks
- **Redux Toolkit** - State management
- **Material-UI (MUI)** - Component library
- **Socket.io-client** - Real-time communication
- **React Hook Form** - Form handling
- **Framer Motion** - Animations

### **Backend**
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.io** - Real-time communication
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **Nodemailer** - Email service

### **Additional Services**
- **AWS S3** - File storage
- **Zego Cloud** - Video calling
- **Nodemailer** - Email notifications

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/TharunChunchu/IChat.git
cd IChat
```

### 2. Install Dependencies

#### Backend
```bash
cd Chat-App-Backend
npm install
```

#### Frontend
```bash
cd ../chat-app-latest
npm install
```

### 3. Environment Setup

#### Backend Configuration
Create a `.env` file in `Chat-App-Backend/`:
```env
NODE_ENV=development
PORT=3001
DATABASE=mongodb://localhost:27017/ichat
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90

# Email Configuration
EMAIL_FROM=noreply@ichat.com
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
S3_BUCKET_NAME=your_s3_bucket

# Zego Cloud Configuration
ZEGO_APP_ID=your_zego_app_id
ZEGO_SERVER_SECRET=your_zego_server_secret
```

### 4. Database Setup
```bash
# Start MongoDB (if running locally)
mongod --dbpath /path/to/your/mongodb/data
```

### 5. Run the Application

#### Start Backend Server
```bash
cd Chat-App-Backend
npm start
```

#### Start Frontend Development Server
```bash
cd chat-app-latest
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

## 🔧 Development

### Project Structure
```
IChat/
├── Chat-App-Backend/          # Backend API
│   ├── controllers/           # Route controllers
│   ├── models/               # Database models
│   ├── routes/               # API routes
│   ├── services/             # Business logic
│   ├── utils/                # Utility functions
│   └── server.js             # Server entry point
├── chat-app-latest/           # Frontend React app
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── layouts/          # Layout components
│   │   ├── redux/            # State management
│   │   ├── sections/         # Feature sections
│   │   ├── theme/            # Material-UI theme
│   │   └── utils/            # Utility functions
│   └── public/               # Static assets
└── README.md
```

### Available Scripts

#### Backend
```bash
npm start          # Start development server
npm run dev        # Start with nodemon
npm test           # Run tests
```

#### Frontend
```bash
npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
npm run eject      # Eject from Create React App
```

## 🚀 Deployment

### Backend Deployment (Heroku)
1. Create a Heroku app
2. Set environment variables
3. Connect to GitHub repository
4. Deploy automatically

### Frontend Deployment (Netlify/Vercel)
1. Build the React app: `npm run build`
2. Deploy the `build` folder
3. Set environment variables for API endpoints

### Database (MongoDB Atlas)
1. Create a MongoDB Atlas cluster
2. Get connection string
3. Update `DATABASE` environment variable

## 🔐 Authentication

The application uses JWT-based authentication with the following features:
- User registration with email verification
- Secure login with password hashing
- Password reset functionality
- Protected routes and API endpoints

**Note**: Authentication is currently bypassed for testing purposes. To enable authentication, uncomment the authentication checks in the frontend and backend code.

## 📱 Mobile Support

The application is fully responsive and works seamlessly on:
- Desktop browsers
- Tablets
- Mobile phones
- Progressive Web App (PWA) capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Tharun Chunchu**
- GitHub: [@TharunChunchu](https://github.com/TharunChunchu)
- Email: ch.tharunkumar1@gmail.com

## 🙏 Acknowledgments

- Material-UI team for the amazing component library
- Socket.io for real-time communication
- MongoDB for the database solution
- All open-source contributors

## 📞 Support

If you have any questions or need help, please:
1. Check the [Issues](https://github.com/TharunChunchu/IChat/issues) page
2. Create a new issue with detailed description
3. Contact the author directly

---

⭐ **Star this repository if you found it helpful!**
