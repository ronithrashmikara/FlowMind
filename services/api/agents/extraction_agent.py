from typing import Dict, List, Any
from utils.mistral_client import MistralClient

class ExtractionAgent:
    def __init__(self, mistral_client: MistralClient):
        self.mistral_client = mistral_client
        self.system_prompt = """
        You are an expert document analysis agent. Your task is to extract key information from documents.
        
        Extract the following from the given text:
        1. Main topics and themes
        2. Document sections/chapters
        3. Key concepts and definitions
        4. Important formulas or equations
        5. Document structure and hierarchy
        
        Return your response as JSON with the following structure:
        {
            "topics": ["topic1", "topic2", ...],
            "sections": [{"title": "section_title", "content_preview": "preview..."}],
            "concepts": [{"term": "concept", "definition": "definition"}],
            "formulas": ["formula1", "formula2"],
            "structure": {"type": "document_type", "hierarchy": [...]}
        }
        """
    
    async def extract_concepts(self, text: str) -> Dict[str, Any]:
        """Extract key concepts and structure from document text"""
        
        prompt = f"""
        Analyze the following document text and extract key information:
        
        TEXT:
        {text[:3000]}...
        
        Please extract:
        1. Main topics (5-10 key topics)
        2. Document sections with titles
        3. Key concepts with definitions
        4. Any formulas or equations
        5. Overall document structure
        
        Respond with valid JSON only.
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            
            # Ensure we have the expected structure
            if not response.get('success', True):
                return self._create_fallback_response(text)
            
            return {
                "topics": response.get('topics', []),
                "sections": response.get('sections', []),
                "concepts": response.get('concepts', []),
                "formulas": response.get('formulas', []),
                "structure": response.get('structure', {})
            }
            
        except Exception as e:
            print(f"Error in extraction agent: {e}")
            return self._create_fallback_response(text)
    
    def _create_fallback_response(self, text: str) -> Dict[str, Any]:
        """Create a fallback response when AI extraction fails"""
        import re
        
        # Simple fallback extraction
        words = text.split()
        
        # Extract potential topics (capitalized words)
        topics = list(set([word.strip('.,!?') for word in words if word[0].isupper() and len(word) > 3]))[:10]
        
        # Extract potential sections (lines that look like headers)
        lines = text.split('\n')
        sections = []
        for line in lines:
            if len(line) < 100 and len(line) > 5 and (line.isupper() or line.istitle()):
                sections.append({
                    "title": line.strip(),
                    "content_preview": "Section content..."
                })
        
        return {
            "topics": topics,
            "sections": sections[:10],
            "concepts": [],
            "formulas": [],
            "structure": {"type": "document", "hierarchy": topics}
        }