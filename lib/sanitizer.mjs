import parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import generate from '@babel/generator';

export function sanitizeCode(inputCode) {
  try {
    const ast = parser.parse(inputCode, {
      sourceType: 'module',
      strictMode: false,
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      plugins: [],
    });

    let hasRemovedNodes = false;

    traverse(ast, {
      AssignmentExpression(path) {
        const { left } = path.node;

        const isWindow = (obj) =>
          t.isIdentifier(obj, { name: 'window' }) || t.isThisExpression(obj);

        const getPropertyName = (prop, computed) => {
          if (!computed && t.isIdentifier(prop)) {
            return prop.name;
          }
          if (computed && t.isStringLiteral(prop)) {
            return prop.value;
          }
          return null;
        };

        // Match things like: location = ..., window.location = ..., location.href = ...
        if (t.isIdentifier(left, { name: 'location' })) {
          path.remove();
          hasRemovedNodes = true;
          return;
        }

        if (t.isMemberExpression(left)) {
          const obj = left.object;
          const prop = left.property;

          // Match window.location = ... or window[prop] where prop could be "location"
          if (isWindow(obj)) {
            const propName = getPropertyName(prop, left.computed);
            if (propName === 'location') {
              path.remove();
              hasRemovedNodes = true;
              return;
            }
            // Handle computed property access: window["location"] or window[variable]
            if (left.computed) {
              path.remove();
              hasRemovedNodes = true;
              return;
            }
          }

          // Match location.href = ..., location.assign = ..., location[prop] = ..., etc.
          if (t.isIdentifier(obj, { name: 'location' })) {
            path.remove();
            hasRemovedNodes = true;
            return;
          }

          // Match window.location.href = ..., window.location.assign = ..., etc.
          if (t.isMemberExpression(obj)) {
            if (isWindow(obj.object)) {
              const objPropName = getPropertyName(obj.property, obj.computed);
              if (objPropName === 'location') {
                path.remove();
                hasRemovedNodes = true;
                return;
              }
            }
          }
        }
      },
    });

    // If no nodes were removed, return original code to preserve formatting
    if (!hasRemovedNodes) {
      return inputCode;
    }

    const generatedCode = generate(ast, { 
      retainLines: true,
      compact: false
    }).code;
    
    // Clean up extra blank lines created by removed statements
    return generatedCode
      .split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');
  } catch (e) {
    // Return original code on any parsing error to preserve user code
    return inputCode;
  }
}
