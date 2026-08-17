const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(?<!\d)(?:1[3-9]\d{9})(?!\d)/g, replacement: '[手机号已遮蔽]' },
  { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, replacement: '[邮箱已遮蔽]' },
  { pattern: /(?<!\d)\d{17}[\dXx](?!\d)/g, replacement: '[身份证号已遮蔽]' },
  { pattern: /(?<!\d)(?:\d[ -]?){15,18}\d(?!\d)/g, replacement: '[银行卡号已遮蔽]' },
];

export function redactSensitiveData(input: string): string {
  return SENSITIVE_PATTERNS.reduce(
    (value, { pattern, replacement }) => value.replace(pattern, replacement),
    input,
  );
}
