import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'absolute',
        bottom: '8px',
        right: '8px',
        padding: '8px 12px',
        background: copied ? 'var(--success-light)' : 'var(--primary-100)',
        color: copied ? 'var(--success)' : 'var(--primary-600)',
        borderRadius: 'var(--radius-sm)',
        transition: 'all var(--transition-fast)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 500,
        border: `1px solid ${copied ? 'var(--success)' : 'transparent'}`,
        cursor: 'pointer'
      }}
      className={className}
      title={copied ? "已复制" : "复制邮件内容"}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          <span>已复制</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          <span>复制</span>
        </>
      )}
    </button>
  );
};

export default CopyButton;
