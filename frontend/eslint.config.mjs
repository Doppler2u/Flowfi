import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Aggressively sanitize the Next.js/Typescript config objects to remove
  // the 'name' property that ESLint 9's strict validation rejects.
  ...compat.extends("next/core-web-vitals", "next/typescript").map((config) => {
    if (config.name) {
      delete config.name;
    }
    return config;
  }),
];

export default eslintConfig;
