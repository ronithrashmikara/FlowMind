from typing import Dict, List, Any
from utils.mistral_client import MistralClient
import json

class FlashcardAgent:
    def __init__(self, mistral_client: MistralClient):
        self.mistral_client = mistral_client
        self.system_prompt = """
        You are an expert at creating educational flashcards from documents.
        
        Create flashcards that are:
        1. Clear and concise questions
        2. Accurate and complete answers
        3. Appropriate difficulty level
        4. Cover key concepts comprehensively
        5. Include various question types (definition, application, comparison)
        
        Each flashcard should test understanding, not just memorization.
        """
    
    async def create_flashcards(self, text: str, num_cards: int = 50) -> List[Dict[str, Any]]:
        """Generate flashcards from document text"""
        
        # Split text into chunks for processing
        chunks = self._split_text_for_processing(text)
        all_flashcards = []
        
        cards_per_chunk = max(1, num_cards // len(chunks))
        
        for i, chunk in enumerate(chunks):
            chunk_cards = await self._generate_flashcards_from_chunk(chunk, cards_per_chunk)
            all_flashcards.extend(chunk_cards)
        
        # Ensure we have the right number of cards
        if len(all_flashcards) > num_cards:
            all_flashcards = all_flashcards[:num_cards]
        elif len(all_flashcards) < num_cards:
            # Generate additional cards if needed
            additional_needed = num_cards - len(all_flashcards)
            additional_cards = await self._generate_additional_flashcards(text, additional_needed)
            all_flashcards.extend(additional_cards)
        
        return all_flashcards
    
    async def _generate_flashcards_from_chunk(self, text_chunk: str, num_cards: int) -> List[Dict[str, Any]]:
        """Generate flashcards from a text chunk"""
        
        prompt = f"""
        Create {num_cards} flashcards from this text:
        
        TEXT: {text_chunk}
        
        Create diverse question types:
        1. Definition questions ("What is...?")
        2. Application questions ("How would you...?")
        3. Comparison questions ("What's the difference between...?")
        4. Analysis questions ("Why does...?")
        
        Format as JSON array:
        [
            {{
                "id": "card_1",
                "question": "Clear, specific question",
                "answer": "Complete, accurate answer",
                "difficulty": "easy|medium|hard",
                "category": "concept|definition|application|analysis",
                "tags": ["tag1", "tag2"]
            }}
        ]
        
        Make questions specific and answers comprehensive but concise.
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            
            if isinstance(response, list):
                return self._validate_flashcards(response)
            elif isinstance(response, dict) and 'flashcards' in response:
                return self._validate_flashcards(response['flashcards'])
            else:
                return self._create_fallback_flashcards(text_chunk, num_cards)
                
        except Exception as e:
            print(f"Error generating flashcards: {e}")
            return self._create_fallback_flashcards(text_chunk, num_cards)
    
    async def _generate_additional_flashcards(self, text: str, num_additional: int) -> List[Dict[str, Any]]:
        """Generate additional flashcards to reach target number"""
        
        prompt = f"""
        Create {num_additional} additional flashcards focusing on review and synthesis:
        
        TEXT: {text[:2000]}...
        
        Focus on:
        1. Review questions that connect multiple concepts
        2. Synthesis questions that require combining ideas
        3. Application questions for real-world scenarios
        4. Critical thinking questions
        
        Format as JSON array with the same structure as before.
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            
            if isinstance(response, list):
                return self._validate_flashcards(response)
            else:
                return []
                
        except Exception as e:
            return []
    
    def _validate_flashcards(self, flashcards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Validate and clean flashcard data"""
        validated_cards = []
        
        for i, card in enumerate(flashcards):
            if not isinstance(card, dict):
                continue
                
            validated_card = {
                "id": card.get('id', f'card_{i+1}'),
                "question": card.get('question', 'Question not available'),
                "answer": card.get('answer', 'Answer not available'),
                "difficulty": card.get('difficulty', 'medium'),
                "category": card.get('category', 'concept'),
                "tags": card.get('tags', [])
            }
            
            # Ensure difficulty is valid
            if validated_card['difficulty'] not in ['easy', 'medium', 'hard']:
                validated_card['difficulty'] = 'medium'
            
            # Ensure category is valid
            valid_categories = ['concept', 'definition', 'application', 'analysis']
            if validated_card['category'] not in valid_categories:
                validated_card['category'] = 'concept'
            
            validated_cards.append(validated_card)
        
        return validated_cards
    
    def _create_fallback_flashcards(self, text: str, num_cards: int) -> List[Dict[str, Any]]:
        """Create simple fallback flashcards when AI generation fails"""
        import re
        
        # Extract potential concepts (capitalized words/phrases)
        concepts = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        unique_concepts = list(set(concepts))[:num_cards]
        
        fallback_cards = []
        
        for i, concept in enumerate(unique_concepts):
            fallback_cards.append({
                "id": f"fallback_card_{i+1}",
                "question": f"What is {concept}?",
                "answer": f"{concept} is a key concept from the document that requires further study.",
                "difficulty": "medium",
                "category": "definition",
                "tags": ["fallback", concept.lower()]
            })
        
        return fallback_cards
    
    def _split_text_for_processing(self, text: str, chunk_size: int = 1500) -> List[str]:
        """Split text into manageable chunks for flashcard generation"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            if end >= len(text):
                chunks.append(text[start:])
                break
            
            # Try to break at sentence boundary
            sentence_end = text.rfind('.', start, end)
            if sentence_end > start:
                end = sentence_end + 1
            
            chunks.append(text[start:end])
            start = end - 100  # Small overlap
        
        return chunks
    
    async def categorize_flashcards(self, flashcards: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Categorize flashcards by difficulty and type"""
        categorized = {
            "easy": [],
            "medium": [],
            "hard": [],
            "definition": [],
            "application": [],
            "analysis": []
        }
        
        for card in flashcards:
            difficulty = card.get('difficulty', 'medium')
            category = card.get('category', 'concept')
            
            if difficulty in categorized:
                categorized[difficulty].append(card)
            
            if category in categorized:
                categorized[category].append(card)
        
        return categorized