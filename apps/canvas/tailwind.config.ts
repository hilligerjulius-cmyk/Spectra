import type { Config } from "tailwindcss";
import { base, spectrum, accent, radius, fontFamily, shadow } from "@spectra/design-tokens";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: base.void,
        abyss: base.abyss,
        surface: base.surface,
        raised: base.raised,
        overlay: base.overlay,
        accent,
        violet: spectrum.violet,
        indigo: spectrum.indigo,
        blue: spectrum.blue,
        sky: spectrum.sky,
        cyan: spectrum.cyan,
      },
      borderRadius: {
        lg: radius.lg,
        xl: radius.xl,
        "2xl": radius["2xl"],
        "3xl": radius["3xl"],
      },
      fontFamily: {
        sans: [fontFamily.sans],
        mono: [fontFamily.mono],
      },
      boxShadow: {
        glow: shadow.glow,
        "glow-cyan": shadow.glowCyan,
        elevated: shadow.lg,
      },
      keyframes: {
        "prism-drift": {
          "0%,100%": { transform: "translate3d(0,0,0) rotate(0deg)", opacity: "0.55" },
          "50%": { transform: "translate3d(3%,-2%,0) rotate(8deg)", opacity: "0.85" },
        },
        "aura-pulse": {
          "0%,100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.08)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "prism-drift": "prism-drift 18s ease-in-out infinite",
        "aura-pulse": "aura-pulse 8s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
