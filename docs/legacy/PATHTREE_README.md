# PathTree 🌳

A complete web application that converts PDFs, PPTX files, and text documents into interactive knowledge trees, summaries, flashcards, mind maps, and provides an AI-powered tutor experience.

## 🚀 Features

### Core Functionality
- **Document Upload**: Support for PDF, PPTX, and text files
- **Multi-Agent AI Processing**: 7 specialized AI agents for different tasks
- **Knowledge Tree Visualization**: Interactive React Flow-based knowledge graphs
- **Smart Summaries**: 1-page, 5-page, and chapter-based summaries
- **Flashcard Generation**: Intelligent Q&A pairs with difficulty levels
- **AI Tutor**: Interactive chat-based learning assistant
- **Assessment Tools**: Quizzes, MCQs, and adaptive testing

### Technology Stack

#### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - Modern React with hooks
- **TailwindCSS** - Utility-first CSS framework
- **React Flow** - Interactive node-based graphs
- **Lucide React** - Beautiful icons

#### Backend
- **FastAPI** - High-performance Python web framework
- **Python 3.12** - Latest Python with type hints
- **pdfplumber** - PDF text extraction
- **python-pptx** - PowerPoint processing
- **Mistral AI** - Advanced language model integration

## 🎨 Design

The application features a modern dark theme inspired by JoyCode's design language:
- **Primary Colors**: Deep blues and purples
- **Accent Colors**: Bright gradients (blue to pink)
- **Typography**: Clean, modern fonts
- **Layout**: Responsive grid-based design

## 🏗️ Architecture

### Multi-Agent System

1. **Extraction Agent** - Extracts chapters, sections, concepts, and definitions
2. **Simplifier Agent** - Rewrites complex concepts into simple explanations
3. **Knowledge Tree Agent** - Creates hierarchical knowledge structures
4. **Summary Agent** - Generates various types of summaries
5. **Flashcard Agent** - Creates Q&A pairs for learning
6. **Tutor Agent** - Provides interactive explanations and guidance
7. **Assessment Agent** - Generates quizzes and evaluations

### API Endpoints

- `POST /upload` - Upload and process documents
- `POST /generate/graph` - Generate knowledge tree
- `POST /generate/summary` - Create summaries
- `POST /generate/flashcards` - Generate flashcards
- `POST /tutor` - Interactive tutoring
- `POST /generate/quiz` - Create assessments

## 🛠️ Installation

### Prerequisites
- Python 3.12+
- Node.js 18+
- npm or yarn

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pathtree/backend
   ```

2. **Install Python dependencies**
   ```bash
   # Using conda/micromamba (recommended)
   micromamba install -c conda-forge fastapi uvicorn python-multipart pdfplumber python-pptx mistralai aiofiles pillow nltk scikit-learn pandas -y
   
   # Or using pip
   pip install fastapi uvicorn python-multipart pdfplumber python-pptx mistralai python-dotenv aiofiles Pillow nltk scikit-learn pandas
   ```

3. **Set up environment variables**
   ```bash
   # Create .env file
   echo "MISTRAL_API_KEY=your_mistral_api_key_here" > .env
   ```

4. **Start the backend server**
   ```bash
   python main.py
   ```
   Server will run on `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`

## 🚀 Usage

### 1. Upload Documents
- Navigate to the dashboard
- Click the upload area or drag & drop files
- Supported formats: PDF, PPTX, TXT

### 2. Generate Knowledge Tree
- After upload, click "Generate Knowledge Tree"
- View interactive node-based visualization
- Click nodes to explore details

### 3. Create Summaries
- Access the Summaries page
- Choose from 1-page, 5-page, or detailed summaries
- Export or share summaries

### 4. Study with Flashcards
- Visit the Flashcards page
- Flip cards to reveal answers
- Mark cards as learned
- Shuffle for random practice

### 5. Chat with AI Tutor
- Open the Tutor Chat page
- Ask questions about your documents
- Get explanations, examples, and practice problems

## 🧪 Testing

### Backend Testing
```bash
cd backend
python -m pytest tests/
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Integration Testing
```bash
# Start both servers
cd backend && python main.py &
cd frontend && npm run dev &

# Test upload functionality
curl -X POST http://localhost:8000/upload -F "file=@test_document.pdf"
```

## 📁 Project Structure

```
pathtree/
├── backend/
│   ├── agents/                 # AI agent implementations
│   │   ├── extraction_agent.py
│   │   ├── simplifier_agent.py
│   │   ├── knowledge_tree_agent.py
│   │   ├── summary_agent.py
│   │   ├── flashcard_agent.py
│   │   ├── tutor_agent.py
│   │   └── assessment_agent.py
│   ├── utils/                  # Utility functions
│   │   ├── mistral_client.py
│   │   ├── document_processor.py
│   │   └── text_chunker.py
│   ├── uploads/               # Uploaded files storage
│   ├── main.py               # FastAPI application
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js app directory
│   │   ├── components/       # React components
│   │   └── lib/             # Utility functions
│   ├── public/              # Static assets
│   ├── package.json         # Node.js dependencies
│   └── tailwind.config.js   # Tailwind configuration
├── test_document.txt        # Sample test file
└── README.md               # This file
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
MISTRAL_API_KEY=your_mistral_api_key_here
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50MB
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Mistral AI** for providing the language model API
- **React Flow** for the knowledge graph visualization
- **FastAPI** for the high-performance backend framework
- **Next.js** for the modern React framework
- **TailwindCSS** for the utility-first CSS framework

## 🐛 Troubleshooting

### Common Issues

1. **Module not found errors**
   - Ensure all dependencies are installed
   - Check Python path and virtual environment

2. **API connection issues**
   - Verify Mistral API key is set correctly
   - Check network connectivity

3. **File upload failures**
   - Ensure file size is under limit
   - Check file format is supported

4. **Frontend build errors**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility

### Getting Help

- Open an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

---

**PathTree** - Transform your documents into interactive learning experiences! 🌳✨