from typing import Dict, List, Any
from utils.mistral_client import MistralClient

class SummaryAgent:
    def __init__(self, mistral_client: MistralClient):
        self.mistral_client = mistral_client
        self.system_prompt = """
        You are an expert at creating comprehensive summaries of documents.
        
        Create summaries that are:
        1. Accurate and comprehensive
        2. Well-structured with clear sections
        3. Appropriate for the target length
        4. Include key points, concepts, and takeaways
        
        Maintain the original meaning while making content accessible.
        """
    
    async def generate_summaries(self, text: str) -> Dict[str, Any]:
        """Generate multiple types of summaries"""
        
        summaries = {}
        
        # Generate 1-page summary
        summaries['one_page'] = await self._generate_one_page_summary(text)
        
        # Generate 5-page summary
        summaries['five_page'] = await self._generate_detailed_summary(text)
        
        # Generate bullet point summary
        summaries['bullet_points'] = await self._generate_bullet_summary(text)
        
        # Generate chapter summaries if applicable
        summaries['chapters'] = await self._generate_chapter_summaries(text)
        
        return summaries
    
    async def _generate_one_page_summary(self, text: str) -> str:
        """Generate a concise 1-page summary"""
        
        prompt = f"""
        Create a concise 1-page summary of this document:
        
        TEXT: {text[:3000]}...
        
        The summary should:
        1. Capture the main ideas and themes
        2. Include key concepts and conclusions
        3. Be approximately 300-400 words
        4. Be well-structured with clear paragraphs
        
        Focus on the most important information that someone needs to understand the document.
        """
        
        try:
            response = await self.mistral_client.generate_response(prompt, self.system_prompt)
            return response
        except Exception as e:
            return f"Summary generation failed: {str(e)}"
    
    async def _generate_detailed_summary(self, text: str) -> str:
        """Generate a detailed 5-page summary"""
        
        prompt = f"""
        Create a comprehensive 5-page summary of this document:
        
        TEXT: {text[:4000]}...
        
        The summary should:
        1. Include detailed explanations of all major concepts
        2. Provide context and background information
        3. Include examples and illustrations where relevant
        4. Be approximately 1200-1500 words
        5. Be organized into clear sections with headings
        
        This should be a thorough analysis that covers all important aspects.
        """
        
        try:
            response = await self.mistral_client.generate_response(prompt, self.system_prompt, max_tokens=3000)
            return response
        except Exception as e:
            return f"Detailed summary generation failed: {str(e)}"
    
    async def _generate_bullet_summary(self, text: str) -> List[str]:
        """Generate bullet point summary"""
        
        prompt = f"""
        Create a bullet-point summary of this document:
        
        TEXT: {text[:2000]}...
        
        Provide 10-15 key bullet points that capture:
        1. Main topics and themes
        2. Important concepts and definitions
        3. Key conclusions or findings
        4. Notable examples or case studies
        
        Format as a JSON array of strings:
        ["bullet point 1", "bullet point 2", ...]
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            if isinstance(response, list):
                return response
            elif isinstance(response, dict) and 'bullet_points' in response:
                return response['bullet_points']
            else:
                return ["Failed to generate bullet points"]
        except Exception as e:
            return [f"Bullet point generation failed: {str(e)}"]
    
    async def _generate_chapter_summaries(self, text: str) -> List[Dict[str, str]]:
        """Generate summaries for different sections/chapters"""
        
        # Try to identify chapters or sections
        import re
        
        # Look for chapter markers
        chapter_pattern = r'(Chapter \d+|Section \d+|Part \d+|^\d+\.)'
        chapters = re.split(chapter_pattern, text, flags=re.MULTILINE)
        
        if len(chapters) < 3:  # If no clear chapters, split by length
            chunk_size = len(text) // 3
            chapters = [
                text[i:i+chunk_size] 
                for i in range(0, len(text), chunk_size)
            ]
        
        chapter_summaries = []
        
        for i, chapter in enumerate(chapters[:5]):  # Limit to 5 chapters
            if len(chapter.strip()) < 100:  # Skip very short sections
                continue
                
            prompt = f"""
            Summarize this section of the document:
            
            SECTION: {chapter[:1000]}...
            
            Provide a summary that includes:
            1. Main topic of this section
            2. Key points covered
            3. Important concepts introduced
            
            Keep it concise but comprehensive (100-200 words).
            """
            
            try:
                summary = await self.mistral_client.generate_response(prompt, self.system_prompt)
                chapter_summaries.append({
                    "chapter": f"Section {i+1}",
                    "title": f"Section {i+1}",
                    "summary": summary
                })
            except Exception as e:
                chapter_summaries.append({
                    "chapter": f"Section {i+1}",
                    "title": f"Section {i+1}",
                    "summary": f"Summary generation failed: {str(e)}"
                })
        
        return chapter_summaries