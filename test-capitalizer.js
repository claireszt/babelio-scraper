import { capitalizeWords } from "./utils.js";

const tests = [
  // Accented & classic French
  "le château d’argol",
  "à la recherche du temps perdu",
];

console.log("🧪 Capitalization Tests:\n");

tests.forEach((input) => {
  console.log(`→ Original: ${input}`);
  console.log(`→ Capitalized: ${capitalizeWords(input)}\n`);
});
