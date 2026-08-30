from typing import Dict, List, Any
from utils.mistral_client import MistralClient
import random

class AssessmentAgent:
    def __init__(self, mistral_client: MistralClient):
        self.mistral_client = mistral_client
        self.system_prompt = """
        You are an expert at creating educational assessments and quizzes.
        
        Create assessments that:
        1. Test understanding at appropriate levels
        2. Include various question types (MCQ, short answer, essay)
        3. Are fair and unbiased
        4. Provide clear, correct answers
        5. Include explanations for learning
        
        Adapt difficulty based on student performance and provide constructive feedback.
        """
    
    async def create_quiz(self, topic: str, difficulty: str = "medium", num_questions: int = 10) -> Dict[str, Any]:
        """Create a comprehensive quiz on a topic"""
        
        prompt = f"""
        Create a {difficulty} difficulty quiz on: {topic}
        Number of questions: {num_questions}
        
        Include a mix of question types:
        - Multiple choice (60%)
        - Short answer (30%)
        - True/False (10%)
        
        For each question provide:
        1. Question text
        2. Options (for MCQ)
        3. Correct answer
        4. Explanation of why the answer is correct
        5. Points value
        
        Format as JSON:
        {{
            "quiz_title": "Quiz on {topic}",
            "difficulty": "{difficulty}",
            "total_points": 100,
            "time_limit": "30 minutes",
            "questions": [
                {{
                    "id": "q1",
                    "type": "multiple_choice|short_answer|true_false",
                    "question": "question text",
                    "options": ["A", "B", "C", "D"],  // for MCQ only
                    "correct_answer": "correct answer",
                    "explanation": "why this is correct",
                    "points": 10,
                    "difficulty": "easy|medium|hard"
                }}
            ]
        }}
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            
            if response.get('questions'):
                return self._validate_quiz(response)
            else:
                return self._create_fallback_quiz(topic, difficulty, num_questions)
                
        except Exception as e:
            print(f"Error creating quiz: {e}")
            return self._create_fallback_quiz(topic, difficulty, num_questions)
    
    def _validate_quiz(self, quiz_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean quiz data"""
        questions = quiz_data.get('questions', [])
        validated_questions = []
        
        for i, q in enumerate(questions):
            validated_q = {
                "id": q.get('id', f'q{i+1}'),
                "type": q.get('type', 'multiple_choice'),
                "question": q.get('question', 'Question not available'),
                "correct_answer": q.get('correct_answer', 'Answer not available'),
                "explanation": q.get('explanation', 'Explanation not available'),
                "points": q.get('points', 10),
                "difficulty": q.get('difficulty', 'medium')
            }
            
            # Add options for MCQ
            if validated_q['type'] == 'multiple_choice':
                validated_q['options'] = q.get('options', ['A', 'B', 'C', 'D'])
            
            validated_questions.append(validated_q)
        
        return {
            "quiz_title": quiz_data.get('quiz_title', 'Quiz'),
            "difficulty": quiz_data.get('difficulty', 'medium'),
            "total_points": quiz_data.get('total_points', len(validated_questions) * 10),
            "time_limit": quiz_data.get('time_limit', '30 minutes'),
            "questions": validated_questions
        }
    
    def _create_fallback_quiz(self, topic: str, difficulty: str, num_questions: int) -> Dict[str, Any]:
        """Create a simple fallback quiz"""
        questions = []
        
        for i in range(num_questions):
            if i % 3 == 0:  # True/False
                questions.append({
                    "id": f"q{i+1}",
                    "type": "true_false",
                    "question": f"Statement about {topic} (True or False)",
                    "correct_answer": "True",
                    "explanation": f"This relates to key concepts in {topic}",
                    "points": 10,
                    "difficulty": difficulty
                })
            elif i % 3 == 1:  # Short answer
                questions.append({
                    "id": f"q{i+1}",
                    "type": "short_answer",
                    "question": f"Explain a key concept related to {topic}",
                    "correct_answer": f"Key concept explanation for {topic}",
                    "explanation": f"This tests understanding of {topic}",
                    "points": 15,
                    "difficulty": difficulty
                })
            else:  # Multiple choice
                questions.append({
                    "id": f"q{i+1}",
                    "type": "multiple_choice",
                    "question": f"Which of the following best describes {topic}?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_answer": "Option A",
                    "explanation": f"This is the correct answer because it accurately describes {topic}",
                    "points": 10,
                    "difficulty": difficulty
                })
        
        return {
            "quiz_title": f"Quiz on {topic}",
            "difficulty": difficulty,
            "total_points": sum(q['points'] for q in questions),
            "time_limit": "30 minutes",
            "questions": questions
        }
    
    async def grade_quiz(self, quiz_data: Dict[str, Any], student_answers: Dict[str, str]) -> Dict[str, Any]:
        """Grade a completed quiz"""
        
        questions = quiz_data.get('questions', [])
        total_points = 0
        earned_points = 0
        detailed_feedback = []
        
        for question in questions:
            q_id = question['id']
            correct_answer = question['correct_answer']
            student_answer = student_answers.get(q_id, '')
            points = question['points']
            
            total_points += points
            
            # Simple grading logic
            if question['type'] in ['multiple_choice', 'true_false']:
                if student_answer.lower().strip() == correct_answer.lower().strip():
                    earned_points += points
                    feedback = "Correct!"
                else:
                    feedback = f"Incorrect. The correct answer is: {correct_answer}"
            else:  # Short answer - use AI for grading
                grade_result = await self._grade_short_answer(
                    question['question'], 
                    correct_answer, 
                    student_answer
                )
                partial_points = int(points * grade_result['score_percentage'] / 100)
                earned_points += partial_points
                feedback = grade_result['feedback']
            
            detailed_feedback.append({
                "question_id": q_id,
                "question": question['question'],
                "student_answer": student_answer,
                "correct_answer": correct_answer,
                "points_earned": partial_points if question['type'] == 'short_answer' else (points if student_answer.lower().strip() == correct_answer.lower().strip() else 0),
                "points_possible": points,
                "feedback": feedback,
                "explanation": question['explanation']
            })
        
        percentage = (earned_points / total_points * 100) if total_points > 0 else 0
        
        return {
            "total_points": total_points,
            "earned_points": earned_points,
            "percentage": round(percentage, 1),
            "grade": self._calculate_letter_grade(percentage),
            "detailed_feedback": detailed_feedback,
            "strengths": self._identify_strengths(detailed_feedback),
            "areas_for_improvement": self._identify_weaknesses(detailed_feedback)
        }
    
    async def _grade_short_answer(self, question: str, correct_answer: str, student_answer: str) -> Dict[str, Any]:
        """Grade short answer questions using AI"""
        
        prompt = f"""
        Grade this short answer question:
        
        QUESTION: {question}
        CORRECT ANSWER: {correct_answer}
        STUDENT ANSWER: {student_answer}
        
        Provide:
        1. Score percentage (0-100)
        2. Feedback explaining the grade
        3. What the student got right
        4. What could be improved
        
        Format as JSON:
        {{
            "score_percentage": 85,
            "feedback": "Good answer, but missing...",
            "correct_aspects": ["what they got right"],
            "improvements": ["what could be better"]
        }}
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            return response
        except Exception as e:
            return {
                "score_percentage": 50,
                "feedback": "Unable to grade automatically. Please review manually.",
                "correct_aspects": ["Attempted the question"],
                "improvements": ["Review the topic and try again"]
            }
    
    def _calculate_letter_grade(self, percentage: float) -> str:
        """Convert percentage to letter grade"""
        if percentage >= 90:
            return "A"
        elif percentage >= 80:
            return "B"
        elif percentage >= 70:
            return "C"
        elif percentage >= 60:
            return "D"
        else:
            return "F"
    
    def _identify_strengths(self, feedback: List[Dict[str, Any]]) -> List[str]:
        """Identify student strengths from quiz performance"""
        strengths = []
        
        correct_answers = [f for f in feedback if f['points_earned'] == f['points_possible']]
        
        if len(correct_answers) > len(feedback) * 0.7:
            strengths.append("Strong overall understanding of the topic")
        
        if any(f['question'].lower().find('definition') != -1 for f in correct_answers):
            strengths.append("Good grasp of key definitions")
        
        if any(f['question'].lower().find('application') != -1 for f in correct_answers):
            strengths.append("Able to apply concepts effectively")
        
        return strengths if strengths else ["Completed the assessment"]
    
    def _identify_weaknesses(self, feedback: List[Dict[str, Any]]) -> List[str]:
        """Identify areas for improvement"""
        weaknesses = []
        
        incorrect_answers = [f for f in feedback if f['points_earned'] < f['points_possible']]
        
        if len(incorrect_answers) > len(feedback) * 0.5:
            weaknesses.append("Review fundamental concepts")
        
        if any(f['question'].lower().find('application') != -1 for f in incorrect_answers):
            weaknesses.append("Practice applying concepts to real situations")
        
        if any(f['question'].lower().find('analysis') != -1 for f in incorrect_answers):
            weaknesses.append("Work on analytical thinking skills")
        
        return weaknesses if weaknesses else ["Continue practicing to maintain understanding"]
    
    async def create_adaptive_quiz(self, topic: str, student_performance: Dict[str, Any]) -> Dict[str, Any]:
        """Create an adaptive quiz based on student performance"""
        
        # Determine difficulty based on past performance
        avg_score = student_performance.get('average_score', 75)
        
        if avg_score >= 85:
            difficulty = "hard"
        elif avg_score >= 70:
            difficulty = "medium"
        else:
            difficulty = "easy"
        
        # Focus on weak areas
        weak_areas = student_performance.get('weak_areas', [topic])
        focus_topic = weak_areas[0] if weak_areas else topic
        
        return await self.create_quiz(focus_topic, difficulty, 10)