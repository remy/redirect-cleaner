import { sanitizeCode } from '../lib/sanitizer.mjs';
import { describe, it, expect } from 'vitest';

describe('sanitizeCode', () => {
  describe('normal code', () => {
    it('should pass through regular variable assignments', () => {
      const input = 'const x = 5; let y = "hello";';
      const result = sanitizeCode(input);
      expect(result).toBe(input);
    });

    it('should pass through function calls', () => {
      const input = 'console.log("test"); alert("hello");';
      const result = sanitizeCode(input);
      expect(result).toBe(input);
    });

    it('should pass through object property assignments', () => {
      const input = 'obj.prop = value; myObj["key"] = data;';
      const result = sanitizeCode(input);
      expect(result).toBe(input);
    });

    it('should pass through non-location related code', () => {
      const input = `
        const config = { url: "https://example.com" };
        window.myVar = "safe";
        document.title = "New Title";
      `;
      const result = sanitizeCode(input);
      expect(result.replace(/\s+/g, ' ').trim()).toBe(
        input.replace(/\s+/g, ' ').trim()
      );
    });
  });

  describe('location assignment removal', () => {
    it('should remove direct location assignment', () => {
      const input = 'location = "https://evil.com";';
      const result = sanitizeCode(input);
      expect(result.trim()).toBe('');
    });

    it('should remove window.location assignment', () => {
      const input = 'window.location = "https://evil.com";';
      const result = sanitizeCode(input);
      expect(result.trim()).toBe('');
    });

    it('should remove location.href assignment', () => {
      const input = 'location.href = "https://evil.com";';
      const result = sanitizeCode(input);
      expect(result.trim()).toBe('');
    });

    it('should remove window.location.href assignment', () => {
      const input = 'window.location.href = "https://evil.com";';
      const result = sanitizeCode(input);
      expect(result.trim()).toBe('');
    });

    it('should remove computed property location assignment', () => {
      const input = 'window["location"] = "https://evil.com";';
      const result = sanitizeCode(input);
      expect(result.trim()).toBe('');
    });

    it('should remove computed property href assignment', () => {
      const input = 'location["href"] = "https://evil.com";';
      const result = sanitizeCode(input);
      expect(result.trim()).toBe('');
    });

    it('should remove this.location assignment', () => {
      const input = 'this.location = "https://evil.com";';
      const result = sanitizeCode(input);
      expect(result.trim()).toBe('');
    });

    it('should preserve safe code while removing location assignments', () => {
      const input = `
        const x = 5;
        location = "https://evil.com";
        console.log("safe");
        window.location.href = "https://bad.com";
        alert("still safe");
      `;
      const result = sanitizeCode(input);
      const lines = result
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line);
      expect(lines.includes('const x = 5;')).toBe(true);
      expect(lines.includes('console.log("safe");')).toBe(true);
      expect(lines.includes('alert("still safe");')).toBe(true);
      expect(lines.includes('window.location.href = "https://bad.com";')).toBe(
        false
      );
      expect(result.includes('location')).toBe(false);
    });
  });

  describe('broken/malformed code', () => {
    it('should return original code for syntax errors', () => {
      const input = 'function broken( { invalid syntax';
      const result = sanitizeCode(input);
      expect(result).toBe(input);
    });

    it('should return original code for incomplete expressions', () => {
      const input = 'if (true) { incomplete';
      const result = sanitizeCode(input);
      expect(result).toBe(input);
    });

    it('should return original code for invalid tokens', () => {
      const input = 'const x = @#$%^&*;';
      const result = sanitizeCode(input);
      expect(result).toBe(input);
    });

    it('should return original code for unmatched brackets', () => {
      const input = 'function test() { console.log("missing closing bracket";';
      const result = sanitizeCode(input);
      expect(result).toBe(input);
    });
  });

  describe('exploitation attempts', () => {
    it('should not execute code during parsing', () => {
      // This would be dangerous if path.evaluate() was still used
      const input =
        'const evil = (() => { throw new Error("Code executed!"); })(); location = evil;';
      const result = sanitizeCode(input);
      // Should not throw an error and should remove the location assignment
      expect(result.includes('location')).toBe(false);
    });

    it('should handle complex computed property attempts', () => {
      const input = `
        const prop = "location";
        window[prop] = "https://evil.com";
        const href = "href";
        location[href] = "https://bad.com";
      `;
      const result = sanitizeCode(input);
      // Should preserve variable declarations but remove location assignments
      expect(result.includes('const prop = "location"')).toBe(true);
      expect(result.includes('const href = "href"')).toBe(true);
      expect(result.includes('window[prop]')).toBe(false);
      expect(result.includes('location[href]')).toBe(false);
    });

    it('should handle code without semi colons', () => {
      const input = `
      function test() {
        const prop = "location";
        window[prop] = "https://evil.com"
      }`;
      const result = sanitizeCode(input);
      // Should preserve variable declarations but remove location assignments
      expect(result.includes('const prop = "location"')).toBe(true);
      expect(result.includes('window[prop]')).toBe(false);
    });

    it('should handle obfuscated location access', () => {
      const input = `
        const loc = "location";
        const h = "href";
        window[loc][h] = "https://evil.com";
      `;
      const result = sanitizeCode(input);
      // Should preserve variable declarations
      expect(result.includes('const loc = "location"')).toBe(true);
      expect(result.includes('const h = "href"')).toBe(true);
      // Complex computed access should remain (not in scope of current sanitizer)
      expect(result.includes('window[loc][h]')).toBe(true);
    });

    it('should not be bypassed by prototype pollution attempts', () => {
      const input = `
        Object.prototype.location = "https://evil.com";
        location = "https://bad.com";
      `;
      const result = sanitizeCode(input);
      // Should preserve prototype assignment but remove location assignment
      expect(result.includes('Object.prototype.location')).toBe(true);
      expect(result.includes('location = "https://bad.com"')).toBe(false);
    });

    it('should handle mixed safe and unsafe code', () => {
      const input = `
        const data = fetch("/api/data");
        location.href = "https://evil.com";
        const result = processData(data);
        window.location = "https://bad.com";
        return result;
      `;
      const result = sanitizeCode(input);
      // Should preserve safe operations
      expect(result.includes('fetch("/api/data")')).toBe(true);
      expect(result.includes('processData(data)')).toBe(true);
      expect(result.includes('return result')).toBe(true);
      // Should remove location assignments
      expect(result.includes('location.href')).toBe(false);
      expect(result.includes('window.location')).toBe(false);
    });

    it('should not execute code in string literals', () => {
      const input =
        'const code = "location = \\"https://evil.com\\""; eval(code);';
      const result = sanitizeCode(input);
      // Should preserve the code as it's just a string literal and eval call
      expect(result.includes('const code =')).toBe(true);
      expect(result.includes('eval(code)')).toBe(true);
    });
  });
});
