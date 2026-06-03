'use client';

import React from 'react';
import styles from './StarRating.module.css';

interface StarRatingProps {
  messageId: string;
  rating: number;
  hoverRating: number;
  onRate: (messageId: string, star: number) => void;
  onHover: (messageId: string, star: number) => void;
  onLeave: (messageId: string) => void;
}

const StarRating = ({ messageId, rating, hoverRating, onRate, onHover, onLeave }: StarRatingProps) => {
  const effectiveRating = hoverRating || rating || 0;

  return (
    <div className={styles.container}>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            className={`${styles.star} ${effectiveRating >= star ? styles.active : ''}`}
            onClick={() => onRate(messageId, star)}
            onMouseEnter={() => onHover(messageId, star)}
            onMouseLeave={() => onLeave(messageId)}
            aria-label={`${star} sao`}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && <span className={styles.thanks}>Cảm ơn bạn!</span>}
    </div>
  );
};

export default StarRating;
