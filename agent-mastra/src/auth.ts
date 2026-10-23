import { authStorage } from "./subscription";

process.umask(0o077);
try {
  await authStorage.login("openai-codex", {
    authMode: "device",
    onAuth: ({ url, instructions, userCode }) => {
      console.log(`Open ${url} in your browser.`);
      if (userCode) console.log(`Device code: ${userCode}`);
      if (instructions) console.log(instructions);
    },
    onPrompt: async () => {
      throw new Error("Unexpected prompt in device login");
    },
  });
  console.log(
    "Codex subscription sign-in saved. Start Mastra and run scripts/local/verify.sh.",
  );
} catch {
  console.error(
    "Codex sign-in failed or expired. Enable device-code login in ChatGPT security settings and retry scripts/local/login.sh.",
  );
  process.exitCode = 1;
}
