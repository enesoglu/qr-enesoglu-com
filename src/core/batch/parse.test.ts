import { describe, expect, it } from 'vitest';
import { parseBatchInput } from './index';
import { createFilenameAllocator, sanitizeFilename } from './filenames';

describe('batch parsing', () => {
  it('parses plain lines, preserving content and physical line numbers', () => {
    expect(parseBatchInput('first\n\n  \nİstanbul\n')).toEqual({
      rows: [
        { data: 'first', filename: 'qr-0001', line: 1 },
        { data: 'İstanbul', filename: 'qr-0002', line: 4 },
      ],
      errors: [],
    });
  });

  it('parses quoted CSV commas, escaped quotes, and embedded CRLF', () => {
    expect(
      parseBatchInput(
        'data,filename\r\n"Hello, ""world""",greeting\r\n"line one\r\nline two",multiline\r\n,missing',
      ),
    ).toEqual({
      rows: [
        { data: 'Hello, "world"', filename: 'greeting', line: 2 },
        { data: 'line one\r\nline two', filename: 'multiline', line: 3 },
      ],
      errors: [{ line: 5, message: 'Data is required' }],
    });
  });

  it('parses TSV with comma-containing fields and ignores extra columns once', () => {
    const result = parseBatchInput(
      'content\tfilename\textra\nHello, world\thello\tignored\nOther\tother\tignored',
    );
    expect(result.rows).toEqual([
      { data: 'Hello, world', filename: 'hello', line: 2 },
      { data: 'Other', filename: 'other', line: 3 },
    ]);
    expect(result.errors).toEqual([
      { line: 1, message: 'Extra columns are ignored' },
    ]);
  });

  it.each(['data', 'CONTENT', 'Text', 'uRL'])(
    'skips the %s header after leading blank rows and BOM',
    (header) => {
      expect(
        parseBatchInput(`\ufeff\n ${header} \nvalue\ntext`).rows.map(
          (row) => row.data,
        ),
      ).toEqual(['value', 'text']);
    },
  );

  it('reports empty data but skips blank rows', () => {
    expect(
      parseBatchInput('data,filename\n,\n,value\nvalid,name').errors,
    ).toEqual([{ line: 3, message: 'Data is required' }]);
    expect(parseBatchInput(' \r\n\r\n')).toEqual({ rows: [], errors: [] });
    expect(parseBatchInput('')).toEqual({ rows: [], errors: [] });
  });

  it('truncates valid rows and reports the first omitted physical line', () => {
    const result = parseBatchInput('text\na\n\nb\nc\nd', { maxRows: 2 });
    expect(result.rows.map((row) => row.data)).toEqual(['a', 'b']);
    expect(result.errors).toEqual([
      { line: 5, message: 'Input is limited to 2 rows' },
    ]);
    expect(parseBatchInput('a', { maxRows: 0 }).rows).toEqual([]);
    expect(
      parseBatchInput(
        Array.from({ length: 1001 }, (_, i) => `item${i}`).join('\n'),
      ).rows,
    ).toHaveLength(1000);
  });

  it.each([-1, 1.5, NaN, Infinity])(
    'rejects invalid row limit %s',
    (maxRows) => {
      expect(() => parseBatchInput('a', { maxRows })).toThrow(RangeError);
    },
  );

  it('reports malformed quotes with the physical source line', () => {
    expect(parseBatchInput('data,filename\n"unclosed,value').errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 2, message: expect.any(String) }),
      ]),
    );
  });

  it('sanitizes and de-duplicates explicit and default filenames', () => {
    const { rows } = parseBatchInput(
      'data,filename\na, A / B* \nb,A-B\nc,a-b\nd,qr-0005\ne,\nf,CON.txt',
    );
    expect(rows.map((row) => row.filename)).toEqual([
      'A-B',
      'A-B-2',
      'a-b-3',
      'qr-0005',
      'qr-0005-2',
      '_CON.txt',
    ]);
  });
});

describe('portable filename allocation', () => {
  it('strips invalid characters and trims trailing dots', () => {
    expect(
      sanitizeFilename('  ../folder\\file<>:"|?*\u0000\u001f\u007f name.  '),
    ).toBe('..folderfile-name');
    expect(sanitizeFilename('  .. ')).toBe('');
    expect(sanitizeFilename('İş  ağı')).toBe('İş-ağı');
  });

  it.each(['CON', 'prn', 'AUX.txt', 'nul', 'COM1', 'LPT9.svg', 'COM¹'])(
    'avoids reserved name %s',
    (name) => {
      expect(sanitizeFilename(name)).toBe(`_${name}`);
    },
  );

  it('keeps suffixed names within 80 characters and avoids pre-existing suffixes', () => {
    const allocate = createFilenameAllocator(10000);
    const longName = 'a'.repeat(100);
    expect(allocate(longName, 0)).toBe('a'.repeat(80));
    expect(allocate(longName, 1)).toBe(`${'a'.repeat(78)}-2`);
    expect(allocate('name-2', 2)).toBe('name-2');
    expect(allocate('name', 3)).toBe('name');
    expect(allocate('name', 4)).toBe('name-3');
    expect(allocate('', 5)).toBe('qr-00006');
  });
});
