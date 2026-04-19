declare module 'lucide-react/dist/esm/icons/*' {
  import * as React from 'react';
  import type { LucideProps } from 'lucide-react';

  const Icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
  >;

  export default Icon;
}
