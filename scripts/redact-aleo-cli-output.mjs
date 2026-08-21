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
    .map(redactLine)
    .join("\n");
}

function redactLine(line) {
  if (sensitiveLabel.test(line)) return "[REDACTED_SENSITIVE_LEO_OUTPUT]";
  return line.replace(sensitiveLiteral, "[REDACTED_SENSITIVE_VALUE]");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let pending = "";
  process.stdin.on("data", (chunk) => {
    pending += chunk.toString("utf8");
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) process.stdout.write(`${redactLine(line)}\n`);
  });
  process.stdin.on("end", () => {
    if (pending) process.stdout.write(redactLine(pending));
  });
}
