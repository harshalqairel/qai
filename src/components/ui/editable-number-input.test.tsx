// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { EditableNumberInput } from "./editable-number-input";

function Example() {
  const [value, setValue] = useState(4);
  return <EditableNumberInput aria-label="Amount" value={value} onValueChange={setValue} />;
}

describe("EditableNumberInput", () => {
  afterEach(cleanup);

  it("allows a temporary empty value before accepting the replacement number", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const input = screen.getByRole("spinbutton", { name: "Amount" });

    await user.click(input);
    await user.clear(input);
    expect((input as HTMLInputElement).value).toBe("");
    await user.type(input, "6");
    expect((input as HTMLInputElement).value).toBe("6");
  });

  it("normalizes an empty draft only when editing finishes", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const input = screen.getByRole("spinbutton", { name: "Amount" });

    await user.click(input);
    await user.clear(input);
    await user.tab();
    expect((input as HTMLInputElement).value).toBe("0");
  });
});
