import React from 'react';
import { useTranslate } from './useTranslate';
import { interpolateString, parseAst } from './icu-formatter';

interface TransProps {
  i18nKey: string;
  values?: Record<string, any>;
  components?: Record<string, React.ReactElement>;
}

export const Trans: React.FC<TransProps> = ({ i18nKey, values, components }) => {
  const { t } = useTranslate();
  const text = t(i18nKey, values);

  if (!components || Object.keys(components).length === 0) {
    return <>{text}</>;
  }

  const parts = parseAst(text);
  
  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <React.Fragment key={index}>{part}</React.Fragment>;
        }
        
        const component = components[part.name];
        if (component) {
          // If the component has children prop already, we merge it, but for our simple usecase we inject content as children
          return React.cloneElement(component, { key: index }, part.content);
        }
        
        // Fallback if component is missing
        return <React.Fragment key={index}>{`<${part.name}>${part.content}</${part.name}>`}</React.Fragment>;
      })}
    </>
  );
};
