// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MoneyInput } from "./money-input";

function Example() {
  const [value, setValue] = useState(4);
  return <MoneyInput aria-label="Price" value={value} onChange={setValue} />;
}

describe("MoneyInput", () => {
  afterEach(cleanup);

  it("supports delete to empty followed by a replacement value", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const input = screen.getByRole("textbox", { name: "Price" }) as HTMLInputElement;

    await user.clear(input);
    expect(input.value).toBe("");
    await user.type(input, "6");
    expect(input.value).toBe("6");
  });
});
