from typing import Dict, List, Any, Optional
from utils.mistral_client import MistralClient

class TutorAgent:
    def __init__(self, mistral_client: MistralClient):
        self.mistral_client = mistral_client
        self.system_prompt = """
        You are an expert AI tutor. Your role is to help students understand complex topics through:
        
        1. Clear, step-by-step explanations
        2. Relevant examples and analogies
        3. Practice questions and exercises
        4. Encouraging and supportive guidance
        5. Adaptive responses based on student needs
        
        Always:
        - Break down complex concepts into simpler parts
        - Provide multiple ways to understand the same concept
        - Encourage active learning through questions
        - Be patient and supportive
        - Offer practice opportunities
        """
    
    async def answer_question(self, question: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Answer student questions with comprehensive tutoring response"""
        
        context_text = f"\nCONTEXT: {context}" if context else ""
        
        prompt = f"""
        A student asks: "{question}"
        {context_text}
        
        Provide a comprehensive tutoring response that includes:
        
        1. EXPLANATION: Clear, step-by-step explanation
        2. EXAMPLES: Relevant examples or analogies
        3. PRACTICE: 2-3 practice questions for the student
        4. TIPS: Study tips or memory aids
        5. SUMMARY: Key takeaways (2-3 bullet points)
        
        Format as JSON:
        {{
            "explanation": "detailed explanation...",
            "examples": ["example1", "example2"],
            "practice_questions": [
                {{"question": "practice question", "hint": "helpful hint"}},
                ...
            ],
            "tips": ["tip1", "tip2"],
            "summary": ["key point 1", "key point 2"],
            "difficulty_level": "beginner|intermediate|advanced",
            "related_topics": ["topic1", "topic2"]
        }}
        
        Make the response engaging and educational.
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            
            if response.get('success', True):
                return self._format_tutor_response(response)
            else:
                return self._create_fallback_response(question)
                
        except Exception as e:
            print(f"Error in tutor response: {e}")
            return self._create_fallback_response(question)
    
    def _format_tutor_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format and validate tutor response"""
        return {
            "explanation": response.get('explanation', 'I can help explain this concept.'),
            "examples": response.get('examples', []),
            "practice_questions": response.get('practice_questions', []),
            "tips": response.get('tips', []),
            "summary": response.get('summary', []),
            "difficulty_level": response.get('difficulty_level', 'intermediate'),
            "related_topics": response.get('related_topics', []),
            "response_type": "tutor_answer"
        }
    
    def _create_fallback_response(self, question: str) -> Dict[str, Any]:
        """Create fallback response when AI generation fails"""
        return {
            "explanation": f"This is an interesting question about {question}. Let me help you understand this concept step by step.",
            "examples": ["Let me provide some examples to illustrate this concept."],
            "practice_questions": [
                {"question": f"Can you think of a real-world application of {question}?", "hint": "Consider everyday situations"}
            ],
            "tips": ["Break down complex problems into smaller parts", "Practice regularly to reinforce understanding"],
            "summary": ["Understanding this concept is important for your learning", "Practice will help solidify your knowledge"],
            "difficulty_level": "intermediate",
            "related_topics": ["foundational concepts"],
            "response_type": "tutor_answer"
        }
    
    async def generate_practice_problems(self, topic: str, difficulty: str = "medium", count: int = 5) -> List[Dict[str, Any]]:
        """Generate practice problems for a specific topic"""
        
        prompt = f"""
        Generate {count} practice problems for the topic: {topic}
        Difficulty level: {difficulty}
        
        Create problems that:
        1. Test understanding of key concepts
        2. Require application of knowledge
        3. Are appropriate for the difficulty level
        4. Include helpful hints
        5. Have clear, correct solutions
        
        Format as JSON:
        {{
            "problems": [
                {{
                    "id": "prob_1",
                    "question": "problem statement",
                    "hint": "helpful hint",
                    "solution": "step-by-step solution",
                    "difficulty": "easy|medium|hard",
                    "concepts_tested": ["concept1", "concept2"]
                }}
            ]
        }}
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            
            if response.get('problems'):
                return response['problems']
            else:
                return self._create_fallback_problems(topic, count)
                
        except Exception as e:
            return self._create_fallback_problems(topic, count)
    
    def _create_fallback_problems(self, topic: str, count: int) -> List[Dict[str, Any]]:
        """Create fallback practice problems"""
        problems = []
        
        for i in range(count):
            problems.append({
                "id": f"fallback_prob_{i+1}",
                "question": f"Explain the key aspects of {topic} and provide an example.",
                "hint": "Think about the main characteristics and real-world applications",
                "solution": f"Consider the fundamental principles of {topic} and how they apply in practice.",
                "difficulty": "medium",
                "concepts_tested": [topic]
            })
        
        return problems
    
    async def provide_feedback(self, student_answer: str, correct_answer: str, question: str) -> Dict[str, Any]:
        """Provide feedback on student answers"""
        
        prompt = f"""
        Provide constructive feedback on this student answer:
        
        QUESTION: {question}
        STUDENT ANSWER: {student_answer}
        CORRECT ANSWER: {correct_answer}
        
        Provide feedback that includes:
        1. What the student got right
        2. Areas for improvement
        3. Specific suggestions for better understanding
        4. Encouragement
        
        Format as JSON:
        {{
            "correct_aspects": ["what they got right"],
            "areas_for_improvement": ["what needs work"],
            "suggestions": ["specific advice"],
            "encouragement": "positive message",
            "score": "percentage or grade",
            "next_steps": ["what to study next"]
        }}
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            return response
            
        except Exception as e:
            return {
                "correct_aspects": ["You're thinking about this topic"],
                "areas_for_improvement": ["Consider reviewing the key concepts"],
                "suggestions": ["Practice more examples", "Review the fundamental principles"],
                "encouragement": "Keep working at it! Understanding comes with practice.",
                "score": "Needs more work",
                "next_steps": ["Review the material", "Try more practice problems"]
            }
    
    async def suggest_study_plan(self, topics: List[str], student_level: str = "intermediate") -> Dict[str, Any]:
        """Suggest a personalized study plan"""
        
        prompt = f"""
        Create a study plan for these topics: {', '.join(topics)}
        Student level: {student_level}
        
        Create a structured plan with:
        1. Learning sequence (what to study first)
        2. Time estimates for each topic
        3. Recommended resources or activities
        4. Milestones and checkpoints
        5. Review schedule
        
        Format as JSON:
        {{
            "study_sequence": [
                {{
                    "topic": "topic name",
                    "order": 1,
                    "estimated_time": "2 hours",
                    "activities": ["activity1", "activity2"],
                    "checkpoint": "what to verify you learned"
                }}
            ],
            "total_time_estimate": "X hours",
            "review_schedule": ["when to review"],
            "tips": ["study tips"]
        }}
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            return response
            
        except Exception as e:
            return {
                "study_sequence": [
                    {
                        "topic": topic,
                        "order": i+1,
                        "estimated_time": "1-2 hours",
                        "activities": ["Read and understand", "Practice problems"],
                        "checkpoint": f"Can explain {topic} clearly"
                    }
                    for i, topic in enumerate(topics)
                ],
                "total_time_estimate": f"{len(topics) * 2} hours",
                "review_schedule": ["Review after 1 day", "Review after 1 week"],
                "tips": ["Take breaks", "Practice actively", "Ask questions"]
            }