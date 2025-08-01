"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface LoadingScreenProps {
  isExiting?: boolean;
  onAnimationComplete?: () => void;
}

export function LoadingScreen({ isExiting = false, onAnimationComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  
  useEffect(() => {
    if (isExiting && !isCompleting) {
      // When exiting is requested, quickly complete the progress bar first
      setIsCompleting(true);
      const completeTimer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(completeTimer);
            // Small delay before starting exit animation
            setTimeout(() => {
              setProgress(100); // Ensure it stays at 100%
            }, 100);
            return 100;
          }
          return prev + 15; // Fast completion
        });
      }, 50);
      
      return () => clearInterval(completeTimer);
    } else if (!isExiting && !isCompleting) {
      // Normal loading progress
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(timer);
            return 95; // Stop at 95% until auth completes
          }
          return prev + Math.random() * 8 + 2; // Slower, more realistic progress
        });
      }, 200);
      
      return () => clearInterval(timer);
    }
  }, [isExiting, isCompleting]);
  
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: '#1a1a1a' }} // Always dark background
      initial={{ opacity: 1 }}
      animate={{ opacity: (isExiting && progress >= 100) ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ 
        duration: 0.5, 
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: (isExiting && progress >= 100) ? 0.2 : 0 // Small delay after completion
      }}
      onAnimationComplete={onAnimationComplete}
    >
      {/* Polished progress bar */}
      <div className="w-96 h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
        <motion.div
          className="h-full rounded-full bg-white shadow-lg"
          style={{
            boxShadow: '0 0 20px rgba(255, 255, 255, 0.3)'
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ 
            duration: isCompleting ? 0.1 : 0.6,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
        />
      </div>
    </motion.div>
  );
}