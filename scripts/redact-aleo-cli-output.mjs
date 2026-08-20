const privateKeyPrefix = "A" + "PrivateKey1";
const viewKeyPrefix = "A" + "ViewKey1";
const signaturePrefix = "sign1";
const sensitiveLiteral = new RegExp(
  `(?:${privateKeyPrefix}|${viewKeyPrefix}|${signaturePrefix})[0-9A-Za-z_-]+`,
  "g",
);
const sensitiveLabel = /(?:private[ _-]?key|view[ _-]?key|signature|signed[ _-]?payload)/i;

export function redactAleoCliOutput(output) {
  return String(output)
    .split(/\r?\n/)
    .map((line) => {
      if (sensitiveLabel.test(line)) return "[REDACTED_SENSITIVE_LEO_OUTPUT]";
      return line.replace(sensitiveLiteral, "[REDACTED_SENSITIVE_VALUE]");
    })
    .join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => process.stdout.write(redactAleoCliOutput(Buffer.concat(chunks).toString("utf8"))));
}
