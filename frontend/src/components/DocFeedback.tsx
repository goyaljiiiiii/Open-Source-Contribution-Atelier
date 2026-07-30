import React, { useState, useEffect } from 'react';
import './DocFeedback.css';

const STORAGE_KEY = 'doc_feedback';

interface DocFeedbackProps {
  pageId: string;
}

export function DocFeedback({ pageId }: DocFeedbackProps) {
  const [feedback, setFeedback] = useState<{
    voted: boolean;
    helpful: boolean | null;
    comment: string;
  }>({
    voted: false,
    helpful: null,
    comment: ''
  });

  const [showComment, setShowComment] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_${pageId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFeedback(parsed);
        if (parsed.voted) {
          setSubmitted(true);
        }
        if (parsed.helpful === false) {
          setShowComment(true);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [pageId]);

  // Save to localStorage
  const saveFeedback = (data: typeof feedback) => {
    localStorage.setItem(`${STORAGE_KEY}_${pageId}`, JSON.stringify(data));
    setFeedback(data);
  };

  const handleHelpful = (helpful: boolean) => {
    if (submitted) return;

    const newData = {
      voted: true,
      helpful,
      comment: feedback.comment
    };

    saveFeedback(newData);

    if (helpful) {
      setSubmitted(true);
      // Show celebration animation
    } else {
      setShowComment(true);
    }
  };

  const handleCommentSubmit = () => {
    if (!feedback.comment.trim()) return;

    const newData = {
      ...feedback,
      voted: true,
      helpful: false,
    };
    saveFeedback(newData);
    setSubmitted(true);
    setShowComment(false);
  };

  if (submitted && feedback.helpful === true) {
    return (
      <div className="doc-feedback submitted">
        <div className="feedback-celebration">
          <span className="celebration-icon">🎉</span>
          <span className="celebration-text">Thanks for your feedback!</span>
        </div>
      </div>
    );
  }

  if (submitted && feedback.helpful === false) {
    return (
      <div className="doc-feedback submitted">
        <span className="feedback-thanks">✅ Thanks! We'll work on improving this page.</span>
      </div>
    );
  }

  return (
    <div className="doc-feedback">
      <p className="feedback-question">Was this page helpful?</p>
      
      <div className="feedback-buttons">
        <button
          className="feedback-btn yes"
          onClick={() => handleHelpful(true)}
          disabled={submitted}
        >
          👍 Yes
        </button>
        <button
          className="feedback-btn no"
          onClick={() => handleHelpful(false)}
          disabled={submitted}
        >
          👎 No
        </button>
      </div>

      {showComment && (
        <div className="feedback-comment">
          <textarea
            placeholder="What could we improve?"
            value={feedback.comment}
            onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
            rows={3}
          />
          <button
            className="feedback-submit"
            onClick={handleCommentSubmit}
            disabled={!feedback.comment.trim()}
          >
            Submit Feedback
          </button>
        </div>
      )}
    </div>
  );
}