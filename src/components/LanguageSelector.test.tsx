import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LanguageSelector from "./LanguageSelector";

describe("LanguageSelector", () => {
  it("opens the language dialog and calls onLanguageChange", async () => {
    const user = userEvent.setup();
    const onLanguageChange = vi.fn();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <LanguageSelector language="no" onLanguageChange={onLanguageChange} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /select language/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/select language/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /norsk/i }));
    expect(onLanguageChange).toHaveBeenCalledWith("no");

    await user.click(screen.getByRole("button", { name: /^done$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
