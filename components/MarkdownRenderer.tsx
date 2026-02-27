import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Simple Markdown Renderer
 * Supports basic Markdown syntax: headers, bold, italic, lists, links, code
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  const renderMarkdown = (text: string): React.ReactNode[] => {
    if (!text) return [];
    
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let isOrderedList = false;
    let key = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        const ListTag = isOrderedList ? 'ol' : 'ul';
        elements.push(
          <ListTag key={`list-${key++}`} className="markdown-list">
            {listItems.map((item, idx) => (
              <li key={idx} className="markdown-list-item">{renderInlineStyles(item)}</li>
            ))}
          </ListTag>
        );
        listItems = [];
      }
    };

    lines.forEach((line, index) => {
      // Check for list items
      const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
      const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
      
      if (unorderedMatch) {
        if (isOrderedList && listItems.length > 0) {
          flushList();
        }
        isOrderedList = false;
        listItems.push(unorderedMatch[2]);
        return;
      } else if (orderedMatch) {
        if (!isOrderedList && listItems.length > 0) {
          flushList();
        }
        isOrderedList = true;
        listItems.push(orderedMatch[2]);
        return;
      } else {
        flushList();
      }

      // Empty line
      if (line.trim() === '') {
        elements.push(<br key={`br-${key++}`} />);
        return;
      }

      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h3 key={key++} className="markdown-h3">{renderInlineStyles(line.substring(4))}</h3>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={key++} className="markdown-h2">{renderInlineStyles(line.substring(3))}</h2>);
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={key++} className="markdown-h1">{renderInlineStyles(line.substring(2))}</h1>);
      } else {
        // Regular paragraph
        elements.push(<p key={key++} className="markdown-paragraph">{renderInlineStyles(line)}</p>);
      }
    });

    flushList();
    return elements;
  };

  const renderInlineStyles = (text: string): React.ReactNode => {
    // Process inline styles: bold, italic, code, links
    let result: React.ReactNode = text;
    
    // Bold and italic
    result = processPattern(result, /\*\*\*(.+?)\*\*\*/g, (match, content) => <strong key={Math.random()}><em>{content}</em></strong>);
    result = processPattern(result, /\*\*(.+?)\*\*/g, (match, content) => <strong key={Math.random()}>{content}</strong>);
    result = processPattern(result, /\*(.+?)\*/g, (match, content) => <em key={Math.random()}>{content}</em>);
    result = processPattern(result, /_(.+?)_/g, (match, content) => <em key={Math.random()}>{content}</em>);
    
    // Inline code
    result = processPattern(result, /`(.+?)`/g, (match, content) => <code key={Math.random()} className="markdown-code-inline">{content}</code>);
    
    // Links [text](url)
    result = processPattern(result, /\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => (
      <a key={Math.random()} href={url} target="_blank" rel="noopener noreferrer" className="markdown-link">{text}</a>
    ));
    
    return result;
  };

  const processPattern = (input: React.ReactNode, pattern: RegExp, replacer: (...args: any[]) => React.ReactNode): React.ReactNode => {
    if (typeof input !== 'string') return input;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(input)) !== null) {
      if (match.index > lastIndex) {
        parts.push(input.substring(lastIndex, match.index));
      }
      parts.push(replacer(match[0], match[1], match[2]));
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < input.length) {
      parts.push(input.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : input;
  };

  return (
    <div className={`markdown-content ${className}`}>
      {renderMarkdown(content)}
    </div>
  );
};

export default MarkdownRenderer;
