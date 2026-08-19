import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

// Adds `toHaveNoViolations()` for the axe-core accessibility tests
// (apps/web/components/business/__tests__/business-registration-form.a11y.test.tsx).
expect.extend(matchers);
