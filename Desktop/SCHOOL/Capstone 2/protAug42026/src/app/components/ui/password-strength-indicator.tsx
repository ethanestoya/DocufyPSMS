import React, { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

interface ValidationRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export function PasswordStrengthIndicator({
  password,
  className = "",
}: PasswordStrengthIndicatorProps) {
  const rules: ValidationRule[] = useMemo(
    () => [
      {
        id: "length",
        label: "At least 8 characters",
        test: (pwd) => pwd.length >= 8,
      },
      {
        id: "uppercase",
        label: "One uppercase letter (A-Z)",
        test: (pwd) => /[A-Z]/.test(pwd),
      },
      {
        id: "lowercase",
        label: "One lowercase letter (a-z)",
        test: (pwd) => /[a-z]/.test(pwd),
      },
      {
        id: "number",
        label: "One number (0-9)",
        test: (pwd) => /\d/.test(pwd),
      },
      {
        id: "special",
        label: "One special character (!@#$%^&*)",
        test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      },
    ],
    [],
  );

  const validationResults = useMemo(() => {
    return rules.map((rule) => ({
      ...rule,
      passed: rule.test(password),
    }));
  }, [password, rules]);

  const passedCount = validationResults.filter((r) => r.passed).length;
  const totalCount = validationResults.length;

  const strength = useMemo(() => {
    if (passedCount === 0) return { label: "", color: "", percentage: 0 };
    if (passedCount <= 2)
      return { label: "Weak", color: "bg-red-500", percentage: 33 };
    if (passedCount <= 4)
      return { label: "Moderate", color: "bg-yellow-500", percentage: 66 };
    return { label: "Strong", color: "bg-green-500", percentage: 100 };
  }, [passedCount]);

  const isValid = passedCount === totalCount;

  if (!password) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Strength Meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-700">Password Strength</span>
          {strength.label && (
            <span
              className={`font-bold ${
                strength.label === "Weak"
                  ? "text-red-600"
                  : strength.label === "Moderate"
                    ? "text-yellow-600"
                    : "text-green-600"
              }`}
            >
              {strength.label}
            </span>
          )}
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-in-out ${strength.color}`}
            style={{ width: `${strength.percentage}%` }}
          />
        </div>
      </div>

      {/* Validation Checklist */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">Requirements:</p>
        <div className="space-y-1.5">
          {validationResults.map((result) => (
            <div
              key={result.id}
              className={`flex items-center gap-2 text-xs transition-colors ${
                result.passed
                  ? "text-green-700"
                  : password.length > 0
                    ? "text-red-600"
                    : "text-gray-500"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  result.passed
                    ? "bg-green-100 text-green-600"
                    : password.length > 0
                      ? "bg-red-100 text-red-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {result.passed ? (
                  <Check className="w-3 h-3" strokeWidth={3} />
                ) : (
                  <X className="w-3 h-3" strokeWidth={2.5} />
                )}
              </div>
              <span className={result.passed ? "font-medium" : ""}>
                {result.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Status */}
      {password.length > 0 && (
        <div
          className={`text-xs p-3 rounded-lg border transition-all ${
            isValid
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {isValid ? (
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="font-medium">
                Password meets all requirements
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="font-medium">
                {totalCount - passedCount} requirement
                {totalCount - passedCount !== 1 ? "s" : ""} remaining
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Utility function to validate password
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
