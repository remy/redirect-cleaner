import { sanitizeCode } from '../lib/sanitizer.mjs';
import { test, it, expect } from 'vitest';

test('sanitizeCode', () => {
  const input = `
        const x = 5;
        location = "https://evil.com";
        console.log("safe");
        window.location.href = "https://bad.com";
        alert("still safe");
      `;
  const result = sanitizeCode(input);

  expect(result.includes('location')).toBe(false);
  expect(result.trim()).toBe(
    input
      .split('\n')
      .filter((line) => !line.includes('location'))
      .map((line) => line.trim())
      .join('\n')
      .trim()
  );
});
