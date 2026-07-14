import { SVGProps } from "react";

const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      d="m12 3 9 4.5-9 4.5-9-4.5L12 3Zm-7.4 8.3 7.4 3.7 7.4-3.7m-14.8 4.5 7.4 3.7 7.4-3.7"
    />
  </svg>
);
export default SvgComponent;
