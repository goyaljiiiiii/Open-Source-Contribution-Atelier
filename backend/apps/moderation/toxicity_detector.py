import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os

class ToxicityDetector:
    """BERT-based toxicity detection."""
    
    def __init__(self):
        self.model_name = "unitary/toxic-bert"
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
        self.threshold = 0.7
    
    def detect(self, text: str) -> dict:
        """Detect toxicity in text."""
        inputs = self.tokenizer(text, return_tensors='pt', truncation=True, max_length=512)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
        
        # Get toxicity score
        toxicity_score = probs[0][1].item()
        
        is_toxic = toxicity_score > self.threshold
        
        return {
            'is_toxic': is_toxic,
            'score': toxicity_score,
            'severity': self._get_severity(toxicity_score),
            'suggestions': self._get_suggestions(toxicity_score, text)
        }
    
    def _get_severity(self, score: float) -> str:
        if score > 0.9: return 'critical'
        if score > 0.8: return 'high'
        if score > 0.7: return 'medium'
        return 'low'
    
    def _get_suggestions(self, score: float, text: str) -> list:
        suggestions = []
        
        if score > 0.8:
            suggestions.append("Your comment contains potentially harmful language. Please rephrase respectfully.")
        
        if 'you' in text.lower():
            suggestions.append("Try focusing on the code or idea, not the person.")
        
        if 'always' in text.lower() or 'never' in text.lower():
            suggestions.append("Avoid absolute statements like 'always' and 'never'.")
        
        if text.isupper():
            suggestions.append("Avoid writing in all caps. It can be perceived as shouting.")
        
        if len(suggestions) == 0 and score > 0.7:
            suggestions.append("Consider rephrasing your comment to be more constructive.")
        
        return suggestions

# Global instance
toxicity_detector = ToxicityDetector()