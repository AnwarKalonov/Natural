import React from 'react';

interface FileIconProps {
  name: string;
  type: 'file' | 'folder';
  isOpen?: boolean;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ name, type, isOpen, className = "w-4 h-4" }) => {
  if (type === 'folder') {
    return isOpen ? (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path fill="#E8B95E" d="M2.6 6.1v13.1c0 1 .8 1.8 1.8 1.8h15.2c1 0 1.8-.8 1.8-1.8V8.8c0-1-.8-1.8-1.8-1.8H10.8l-1.7-2.6H4.4c-1 0-1.8.8-1.8 1.8z"/>
        <path fill="#F0CF86" d="M20.1 9.6H8.4l-1.7 1.8H4.4v7.9h17.5V11.4c0-1-.8-1.8-1.7-1.8z"/>
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path fill="#E8B95E" d="M2.6 6.1v13.1c0 1 .8 1.8 1.8 1.8h15.2c1 0 1.8-.8 1.8-1.8V8.8c0-1-.8-1.8-1.8-1.8H10.8l-1.7-2.6H4.4c-1 0-1.8.8-1.8 1.8z"/>
      </svg>
    );
  }

  const ext = name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'html':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <path fill="#E34F26" d="M5.5 2h21l-2 23.5L16 30l-8.5-4.5L5.5 2z"/>
          <path fill="#EF652A" d="M16 4v23.5l6.5-3.5 1.5-19H16z"/>
          <path fill="#FFF" d="M9.5 7h13l-.5 6h-9l.5 5.5 2.5.5 2.5-.5.5-3.5h3l-.5 6-5.5 1.5-5.5-1.5-.5-8.5h9l.5-3H9.5z"/>
        </svg>
      );
    case 'css':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <path fill="#1572B6" d="M5.5 2h21l-2 23.5L16 30l-8.5-4.5L5.5 2z"/>
          <path fill="#33A9DC" d="M16 4v23.5l6.5-3.5 1.5-19H16z"/>
          <path fill="#FFF" d="M16 7H9.5l.5 3h6v3h-6l.5 4.5 5.5 1.5V23l-2.5-.5-2.5-.5-.5-3H7.5l.5 6 8 2V15.5h-5l-.5-2.5h5.5V7z"/>
        </svg>
      );
    case 'js':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <path fill="#F7DF1E" d="M0 0h32v32H0z"/>
          <path fill="#000" d="M21 23.5c-1 1-2.5 1.5-4 1-1.5-1-2-2.5-2-4h-4c0 3.5 2.5 7 6 7 4 0 7.5-3 8-7v-8h-4v8zM10 13h-4v7c0 2 1.5 3.5 3.5 3.5h.5v-3.5h-.5c-.5 0-1-.5-1-1v-6z"/>
        </svg>
      );
    case 'jsx':
    case 'tsx':
    case 'react':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <circle cx="16" cy="16" r="2.5" fill="#61DAFB"/>
          <g fill="none" stroke="#61DAFB" strokeWidth="2">
            <ellipse cx="16" cy="16" rx="10" ry="4.5"/>
            <ellipse cx="16" cy="16" rx="10" ry="4.5" transform="rotate(60 16 16)"/>
            <ellipse cx="16" cy="16" rx="10" ry="4.5" transform="rotate(120 16 16)"/>
          </g>
        </svg>
      );
    case 'ts':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <path fill="#3178C6" d="M0 0h32v32H0z"/>
          <path fill="#FFF" d="M16.5 13h-4v10.5h-3.5V13h-4v-3h11.5v3zm6.5 7.5c-1 1-2.5 1.5-4 1-1.5-1-2-2.5-2-4h-3.5c0 3.5 2.5 7 6 7 4 0 7.5-3 8-7v-8h-3.5v8z"/>
        </svg>
      );
    case 'json':
      return (
        <svg viewBox="0 0 32 32" className={className}>
          <circle cx="16" cy="16" r="14" fill="#F7DF1E"/>
          <path fill="#000" d="M10 10h2v2h-2zm0 10h2v2h-2zM20 10h2v2h-2zm0 10h2v2h-2z"/>
        </svg>
      );
    case 'md':
      return (
        <svg viewBox="0 0 32 32" className={className}>
           <path fill="#ffffff" d="M4 4h24v24H4z" opacity="0.1"/>
           <path fill="#9E9E9E" d="M26 6H6v20h20V6zM10 20H8V10h2l3 4 3-4h2v10h-2v-6l-3 4-3-4v6z"/>
        </svg>
      );
    case 'en':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{stopColor:'#818cf8', stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:'#c084fc', stopOpacity:1}} />
            </linearGradient>
          </defs>
          <path fill="url(#grad1)" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          <circle cx="12" cy="12" r="3" fill="#fff" fillOpacity="0.8" />
        </svg>
      );
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
    case 'ico':
      return (
        <svg viewBox="0 0 32 32" className={className}>
           <path fill="#8e44ad" d="M4 6h24v20H4z"/>
           <circle cx="10" cy="12" r="3" fill="#ecf0f1"/>
           <path fill="#ecf0f1" d="M24 22L4 22v-6l6-8 8 6 2-2 4 4z"/>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
      );
  }
};
