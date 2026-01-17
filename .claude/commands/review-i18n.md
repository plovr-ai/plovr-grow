# Review Hardcoded Currency and Locale

Review the codebase for hardcoded currency symbols and locale values that should use internationalization (i18n) configuration.

## Instructions

1. **Search for hardcoded currency symbols** in the source code:
   - `$` (USD)
   - `€` (EUR)
   - `¥` (CNY/JPY)
   - `£` (GBP)
   - `₩` (KRW)
   - Other currency symbols

2. **Search for hardcoded locale strings**:
   - `en-US`, `zh-CN`, `ja-JP`, etc.
   - Hardcoded number formatting patterns

3. **Check these file types**:
   - `src/**/*.tsx`
   - `src/**/*.ts`
   - Exclude test files (`__tests__`, `*.test.ts`, `*.test.tsx`)
   - Exclude the i18n configuration files themselves

4. **Acceptable patterns** (DO NOT flag these):
   - Using `useFormatPrice()` hook
   - Using `useCurrencySymbol()` hook
   - Using `Intl.NumberFormat` with dynamic locale/currency from config
   - Currency/locale in configuration files or mock data
   - Currency codes like `"USD"`, `"EUR"` (these are identifiers, not display symbols)

5. **Report format**:
   For each issue found, report:
   - File path and line number
   - The problematic code snippet
   - Suggested fix

## Example Issues

```typescript
// BAD: Hardcoded currency symbol
<span>${price}</span>
<span>¥{price}</span>

// GOOD: Using hook
const formatPrice = useFormatPrice();
<span>{formatPrice(price)}</span>

// BAD: Hardcoded locale
new Intl.NumberFormat('en-US', ...)

// GOOD: Using config
const { locale } = useMerchantConfig();
new Intl.NumberFormat(locale, ...)
```

## Output

Provide a summary:
1. Total issues found
2. List of files with issues
3. Detailed findings with file:line references
4. Recommendations for fixing each issue
