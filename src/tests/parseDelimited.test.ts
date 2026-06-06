import { describe, it, expect } from 'vitest';
import { parseDelimited } from '@/utils/import';

describe('parseDelimited', () => {
  it('parses simple comma CSV', () => {
    expect(parseDelimited('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('parses tab-delimited input', () => {
    expect(parseDelimited('a\tb\tc\n1\t2\t3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('quoted field with embedded comma', () => {
    expect(parseDelimited('a,"b,c",d')).toEqual([['a', 'b,c', 'd']]);
  });

  it('escaped double-quote inside quoted field', () => {
    expect(parseDelimited('"a""b"')).toEqual([['a"b']]);
  });

  it('CRLF line endings', () => {
    expect(parseDelimited('a\r\nb\r\nc')).toEqual([['a'], ['b'], ['c']]);
  });

  it('newline inside a quoted field is preserved literally', () => {
    const result = parseDelimited('"line1\nline2",b');
    expect(result).toEqual([['line1\nline2', 'b']]);
  });

  it('filters blank/whitespace-only rows', () => {
    expect(parseDelimited('a,b\n  \n  ,  \nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('trailing data without a final newline', () => {
    expect(parseDelimited('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('unclosed quote — does not throw, returns observed partial content', () => {
    expect(() => parseDelimited('"unclosed')).not.toThrow();
    expect(Array.isArray(parseDelimited('"unclosed'))).toBe(true);
  });

  it('empty input returns empty array', () => {
    expect(parseDelimited('')).toEqual([]);
  });

  it('single cell', () => {
    expect(parseDelimited('hello')).toEqual([['hello']]);
  });
});
