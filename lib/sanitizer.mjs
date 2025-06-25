import parser from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default;
import * as t from '@babel/types';
import generateModule from '@babel/generator';
const generate = generateModule.default;

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
      plugins: []
    });

    traverse(ast, {
      AssignmentExpression(path) {
        const { left } = path.node;

        const isWindow = (obj) =>
          t.isIdentifier(obj, { name: 'window' }) ||
          t.isThisExpression(obj);

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
          return;
        }

        if (t.isMemberExpression(left)) {
          const obj = left.object;
          const prop = left.property;

          if (isWindow(obj)) {
            const propName = getPropertyName(prop, left.computed);
            if (propName === 'location') {
              path.remove();
              return;
            }
          }

          // catch: location.href = ..., window.location.href = ...
          if (t.isIdentifier(obj, { name: 'location' })) {
            const propName = getPropertyName(prop, left.computed);
            if (propName === 'href') {
              path.remove();
              return;
            }
          }

          // catch: window.location.href = ...
          if (t.isMemberExpression(obj) && isWindow(obj.object)) {
            const objPropName = getPropertyName(obj.property, obj.computed);
            const propName = getPropertyName(prop, left.computed);
            if (objPropName === 'location' && propName === 'href') {
              path.remove();
              return;
            }
          }
        }
      },
    });

    return generate(ast).code;
  } catch (e) {
    // Return empty string on any parsing error to prevent bypass
    return '';
  }
}