'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface KeywordInputProps {
  value: string[];
  onChange: (keywords: string[]) => void;
  maxKeywords?: number;
  placeholder?: string;
  className?: string;
}

export function KeywordInput({
  value,
  onChange,
  maxKeywords = 20,
  placeholder = 'Type a keyword and press Enter',
  className,
}: KeywordInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addKeyword(keyword: string) {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed || value.includes(trimmed) || value.length >= maxKeywords) return;
    onChange([...value, trimmed]);
    setInputValue('');
  }

  function removeKeyword(keyword: string) {
    onChange(value.filter((k) => k !== keyword));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeKeyword(value[value.length - 1]);
    }
  }

  return (
    <div
      className={cn(
        'border-input focus-within:border-ring focus-within:ring-ring/50 flex min-h-10 w-full flex-wrap gap-1.5 rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-within:ring-3',
        className
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((keyword) => (
        <span
          key={keyword}
          className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
        >
          {keyword}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeKeyword(keyword);
            }}
            className="hover:text-destructive rounded-sm transition-colors"
            aria-label={`Remove keyword ${keyword}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => inputValue && addKeyword(inputValue)}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={value.length >= maxKeywords}
        className="h-auto min-w-[120px] flex-1 border-0 p-0 shadow-none outline-none focus-visible:ring-0"
      />
      {value.length >= maxKeywords && (
        <span className="text-muted-foreground self-center text-xs">Max {maxKeywords} keywords</span>
      )}
    </div>
  );
}
