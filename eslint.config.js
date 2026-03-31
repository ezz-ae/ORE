import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

const config = [
  { ignores: ["node_modules/**", ".next/**"] },
  ...nextCoreWebVitals,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "no-unused-vars": "off",
      "react/no-unescaped-entities": [
        "error",
        {
          "forbid": ["<", ">", '"']
        },
      ],
      "import/no-anonymous-default-export": "warn",
    },
  },
]

export default config
