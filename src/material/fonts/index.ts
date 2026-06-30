import localFont from "next/font/local";
import { Anuphan } from "next/font/google";

/**
 * Latin font. Swap the family / files here to rebrand a project.
 * Keep the variable name `--font-font` so globals.css & material/index stay stable.
 */
const PoppinsFont = localFont({
  variable: "--font-font",
  src: [
    { path: "./Poppins/Poppins-Light.ttf", weight: "300" },
    { path: "./Poppins/Poppins-Regular.ttf", weight: "400" },
    { path: "./Poppins/Poppins-Medium.ttf", weight: "500" },
    { path: "./Poppins/Poppins-SemiBold.ttf", weight: "600" },
    { path: "./Poppins/Poppins-Bold.ttf", weight: "700" },
    { path: "./Poppins/Poppins-ExtraBold.ttf", weight: "800" },
  ],
});

/**
 * Thai font. Poppins has no Thai glyphs, so Thai text would fall back to a looped
 * system font. The HTML reference pairs Poppins with **Anuphan** (loopless Thai),
 * so we load the same face for visual parity. next/font/google self-hosts the
 * files at build time (served from the app, not a runtime CDN).
 */
const AnuphanFont = Anuphan({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export { PoppinsFont, AnuphanFont };
