'use client';

import React from 'react';

interface NotificationBadgeProps {
  count: number;
  variant?: 'dot' | 'count';
  className?: string;
  show?: boolean;
}

export function NotificationBadge({ 
  count, 
  variant = 'count', 
  className = '',
  show = true 
}: NotificationBadgeProps) {
  if (!show || count <= 0) return null;

  const baseClasses = "absolute bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800";
  
  if (variant === 'dot') {
    return (
      <div className={`${baseClasses} w-3 h-3 -top-1 -right-1 ${className}`} />
    );
  }

  // For count variant
  const displayCount = count > 99 ? '99+' : count.toString();
  const sizeClasses = count > 9 ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-xs';

  return (
    <div className={`${baseClasses} ${sizeClasses} -top-2 -right-2 ${className}`}>
      {displayCount}
    </div>
  );
}

interface ConversationBadgeProps {
  conversationId: string;
  unreadCount: number;
  className?: string;
}

export function ConversationBadge({ 
  conversationId, 
  unreadCount, 
  className = '' 
}: ConversationBadgeProps) {
  return (
    <NotificationBadge 
      count={unreadCount}
      variant="count"
      className={className}
      show={unreadCount > 0}
    />
  );
}

interface MessagesBadgeProps {
  totalUnreadCount: number;
  className?: string;
  variant?: 'dot' | 'count';
}

export function MessagesBadge({ 
  totalUnreadCount, 
  className = '',
  variant = 'dot' 
}: MessagesBadgeProps) {
  return (
    <NotificationBadge 
      count={totalUnreadCount}
      variant={variant}
      className={className}
      show={totalUnreadCount > 0}
    />
  );
} 