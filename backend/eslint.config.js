import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// Correctness only: no stylistic rules and no formatter.
export default defineConfig([
	globalIgnores(["node_modules/", "coverage/"]),
	js.configs.recommended,
	tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				// Type information for the promise rules below.
				projectService: { allowDefaultProject: ["eslint.config.js"] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// A promise nobody awaits loses its rejection, which Express 5 would otherwise
			// send to the error handler.
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-misused-promises": "error",
			// Express needs an error handler's unused fourth parameter; "_" marks it, as elsewhere.
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
		},
	},
]);
