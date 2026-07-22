import { SVGProps } from "react";

const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
d="M4 10H16M6 13L4 10L6 7M14 13L16 10L14 7M19 19V1M1 19V1"    />
  </svg>
);
export default SvgComponent;
