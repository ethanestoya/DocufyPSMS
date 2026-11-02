import * as React from "react";

import { cn } from "./utils";
import {
  digitsOnly,
  alphaSpaces,
  alphaNumericOnly,
  alphaNumericSpaces,
  moneyInput,
  integersOnly,
  sanitizeEmail,
} from "../../utils/inputSanitizers";

export interface InputProps extends React.ComponentProps<"input"> {
  digitsOnly?: boolean;
  lettersOnly?: boolean;
  alphaNumericOnly?: boolean;
  alphaNumericSpaces?: boolean;
  phoneOnly?: boolean;
  emailOnly?: boolean;
  moneyOnly?: boolean;
  integersOnly?: boolean;
  allowNegative?: boolean;
  maxDigits?: number;
  sanitizeOnChange?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      digitsOnly: digitsOnlyProp,
      lettersOnly,
      alphaNumericOnly: alphaNumericOnlyProp,
      alphaNumericSpaces: alphaNumericSpacesProp,
      phoneOnly,
      emailOnly,
      moneyOnly,
      integersOnly: integersOnlyProp,
      allowNegative,
      maxDigits,
      sanitizeOnChange = true,
      onChange,
      ...props
    },
    ref,
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!sanitizeOnChange) {
        onChange?.(e);
        return;
      }

      let value = e.target.value;

      if (phoneOnly || (type === "tel" && maxDigits)) {
        // Phones default to 11 digits (PH mobile). Other numeric identifiers
        // (e.g. a payment account number) pass their own cap in `maxDigits`.
        value = digitsOnly(value, maxDigits ?? 11);
      } else if (digitsOnlyProp) {
        value = digitsOnly(value, maxDigits);
      } else if (lettersOnly) {
        value = alphaSpaces(value, maxDigits);
      } else if (alphaNumericOnlyProp) {
        value = alphaNumericOnly(value, maxDigits);
      } else if (alphaNumericSpacesProp) {
        value = alphaNumericSpaces(value, maxDigits);
      } else if (emailOnly || type === "email") {
        value = sanitizeEmail(value);
      } else if (moneyOnly) {
        value = moneyInput(value);
      } else if (integersOnlyProp) {
        value = integersOnly(value, allowNegative);
      }

      if (value !== e.target.value) {
        e.target.value = value;
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          // Resting state is a neutral field, never a highlighted one: one hairline,
          // a white fill and a muted placeholder. Blue is reserved for focus (and,
          // per-control, for a filter that is actually narrowing a list).
          "file:text-foreground placeholder:text-[#5C6B7F] selection:bg-primary selection:text-primary-foreground border-[#D5DCE6] flex h-9 w-full min-w-0 rounded-[10px] border bg-white px-3 py-1 text-base transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[#E4E7EC] disabled:bg-[#F8FAFC] disabled:text-[#9AA4B2] md:text-sm",
          "hover:border-[#B7C3D4] focus-visible:border-[#2F6FD6] focus-visible:ring-[3px] focus-visible:ring-[#2F6FD6]/20",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        ref={ref}
        onChange={handleChange}
        inputMode={
          phoneOnly || (type === "tel" && maxDigits)
            ? "tel"
            : digitsOnlyProp || integersOnlyProp
              ? "numeric"
              : emailOnly || type === "email"
                ? "email"
                : props.inputMode
        }
        maxLength={
          maxDigits && (phoneOnly || digitsOnlyProp || integersOnlyProp)
            ? maxDigits
            : props.maxLength
        }
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };


