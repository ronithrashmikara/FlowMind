#!/usr/bin/env python3
import sys
import os

# Add user site-packages to Python path
sys.path.insert(0, '/root/.local/lib/python3.12/site-packages')

# Now import and run the main application
from main import app
import uvicorn

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)