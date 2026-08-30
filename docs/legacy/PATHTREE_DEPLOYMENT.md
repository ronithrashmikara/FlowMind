# PathTree Deployment Guide 🚀

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/ronithrashmikara/PathTree.git
cd PathTree
```

### 2. Set Up Environment Variables
```bash
# Create backend .env file
echo "MISTRAL_API_KEY=your_mistral_api_key" > backend/.env
```

### 3. Install Dependencies

#### Backend (Python)
```bash
cd backend
pip install -r requirements.txt
```

#### Frontend (Node.js)
```bash
cd ../frontend
npm install
```

### 4. Start the Application
```bash
# From the root directory
./start.sh
```

Or manually:

#### Start Backend
```bash
cd backend
python main.py
```

#### Start Frontend
```bash
cd frontend
npm run dev
```

## Access URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## Features Tested ✅

### Core Functionality
- ✅ Document upload (PDF, PPTX, TXT)
- ✅ Multi-agent AI processing system
- ✅ Knowledge tree generation with React Flow
- ✅ Summary generation (1-page, 5-page, detailed)
- ✅ Flashcard creation with Q&A pairs
- ✅ AI tutor chat interface
- ✅ Assessment and quiz generation

### Technical Features
- ✅ FastAPI backend with async endpoints
- ✅ Next.js frontend with modern React
- ✅ TailwindCSS styling with JoyCode theme
- ✅ File upload handling
- ✅ CORS configuration
- ✅ Error handling
- ✅ Responsive design

## API Endpoints

### Document Processing
- `POST /upload` - Upload and process documents
- `POST /generate/graph` - Generate knowledge tree
- `POST /generate/summary` - Create summaries
- `POST /generate/flashcards` - Generate flashcards

### Interactive Features
- `POST /tutor` - AI tutoring chat
- `POST /generate/quiz` - Create assessments
- `GET /health` - Health check

## Architecture

### Backend (FastAPI)
```
backend/
├── agents/                 # 7 AI agents
│   ├── extraction_agent.py
│   ├── simplifier_agent.py
│   ├── knowledge_tree_agent.py
│   ├── summary_agent.py
│   ├── flashcard_agent.py
│   ├── tutor_agent.py
│   └── assessment_agent.py
├── utils/                  # Utilities
│   ├── mistral_client.py
│   └── document_processor.py
└── main.py                # FastAPI app
```

### Frontend (Next.js)
```
frontend/
├── src/
│   ├── app/               # Next.js app router
│   ├── components/        # React components
│   │   ├── features/      # Feature components
│   │   └── ui/           # UI components
│   └── lib/              # Utilities
└── public/               # Static assets
```

## Technology Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **Mistral AI** - Advanced language model
- **pdfplumber** - PDF text extraction
- **python-pptx** - PowerPoint processing
- **uvicorn** - ASGI server

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - Modern React with hooks
- **TailwindCSS** - Utility-first CSS
- **React Flow** - Interactive node graphs
- **Lucide React** - Beautiful icons

## Environment Requirements

- **Python**: 3.12+
- **Node.js**: 18+
- **npm**: 9+

## Production Deployment

### Docker (Recommended)

1. **Create Dockerfile for Backend**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
```

2. **Create Dockerfile for Frontend**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

3. **Docker Compose**
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - MISTRAL_API_KEY=${MISTRAL_API_KEY}
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

### Cloud Deployment Options

#### Vercel (Frontend)
```bash
cd frontend
npm install -g vercel
vercel --prod
```

#### Railway/Render (Backend)
- Connect GitHub repository
- Set environment variables
- Deploy automatically

## Troubleshooting

### Common Issues

1. **Module not found errors**
   - Ensure virtual environment is activated
   - Install dependencies: `pip install -r requirements.txt`

2. **CORS errors**
   - Backend includes CORS middleware
   - Check frontend API URL configuration

3. **File upload issues**
   - Check file size limits (50MB max)
   - Verify supported formats: PDF, PPTX, TXT

4. **Mistral API errors**
   - Verify API key is set correctly
   - Check API quota and limits

### Performance Optimization

1. **Backend**
   - Use async/await for I/O operations
   - Implement caching for processed documents
   - Add database for persistent storage

2. **Frontend**
   - Enable Next.js image optimization
   - Implement lazy loading for components
   - Use React.memo for expensive components

## Security Considerations

1. **API Key Management**
   - Store in environment variables
   - Never commit to version control
   - Use secrets management in production

2. **File Upload Security**
   - Validate file types and sizes
   - Scan for malicious content
   - Implement rate limiting

3. **CORS Configuration**
   - Restrict origins in production
   - Use HTTPS in production

## Monitoring and Logging

1. **Backend Logging**
   - Add structured logging
   - Monitor API response times
   - Track error rates

2. **Frontend Analytics**
   - Add user analytics
   - Monitor performance metrics
   - Track feature usage

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT License - see LICENSE file for details.

---

**PathTree** - Successfully deployed and ready for production! 🌳✨
