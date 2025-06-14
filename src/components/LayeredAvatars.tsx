import React from 'react';
import Image from 'next/image';

interface Participant {
  _id: string;
  name: string;
  image: string;
}

interface LayeredAvatarsProps {
  participants: Participant[];
  size?: number;
  maxDisplay?: number;
  className?: string;
}

const LayeredAvatars: React.FC<LayeredAvatarsProps> = ({ 
  participants, 
  size = 56, 
  maxDisplay = 3,
  className = ""
}) => {
  // Filter out current user and get valid participants with images
  const validParticipants = participants.filter(p => 
    p.image && 
    p.image !== '' && 
    !p.image.includes('data:image/svg+xml') // Filter out default SVG images
  ).slice(0, maxDisplay);

  // If we don't have enough participants with images, fall back to default group icon
  if (validParticipants.length < 2) {
    return (
      <div 
        className={`bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" 
             className="text-blue-600 dark:text-blue-400" 
             style={{ width: size * 0.6, height: size * 0.6 }}
             fill="none" 
             viewBox="0 0 24 24" 
             stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
    );
  }

  const avatarSize = size * 0.7; // Individual avatar size is smaller
  const offset = size * 0.2; // How much each avatar overlaps

  return (
    <div 
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      {validParticipants.map((participant, index) => {
        const zIndex = validParticipants.length - index;
        const leftOffset = index * offset;
        
        return (
          <div
            key={participant._id}
            className="absolute border-2 border-white dark:border-gray-800 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700"
            style={{
              width: avatarSize,
              height: avatarSize,
              left: leftOffset,
              top: (size - avatarSize) / 2,
              zIndex: zIndex,
            }}
          >
            <Image
              src={participant.image}
              alt={participant.name || 'User'}
              fill
              sizes={`${Math.round(avatarSize)}px`}
              className="object-cover"
              onError={(e) => {
                // Hide avatar if image fails to load
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        );
      })}
      
      {/* Show count if there are more participants */}
      {participants.length > maxDisplay && (
        <div
          className="absolute bg-gray-500 dark:bg-gray-600 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800"
          style={{
            width: avatarSize * 0.8,
            height: avatarSize * 0.8,
            right: 0,
            bottom: 0,
            zIndex: validParticipants.length + 1,
          }}
        >
          +{participants.length - maxDisplay}
        </div>
      )}
    </div>
  );
};

export default LayeredAvatars; 