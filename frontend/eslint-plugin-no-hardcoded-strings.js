module.exports = {
  rules: {
    'no-hardcoded-strings': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'disallow hardcoded string literals in JSX',
        },
      },
      create(context) {
        return {
          JSXText(node) {
            if (node.value.trim() !== '') {
              context.report({
                node,
                message: 'Hardcoded strings in JSX should be localized with t() or <Trans>.',
              });
            }
          },
        };
      },
    },
  },
};
