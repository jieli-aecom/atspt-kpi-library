declare module 'react-katex' {
  import type { CSSProperties, ReactNode } from 'react';

  type MathProps = {
    children?: ReactNode;
    errorColor?: string;
    math?: string;
    renderError?: (error: Error) => ReactNode;
    settings?: Record<string, unknown>;
    style?: CSSProperties;
  };

  export function InlineMath(props: MathProps): JSX.Element;
  export function BlockMath(props: MathProps): JSX.Element;
}
