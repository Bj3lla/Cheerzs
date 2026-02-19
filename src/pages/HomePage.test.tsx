import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HomePage from "./HomePage";
import { translations } from "../locales/translations";

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HomePage language="en" />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /create room/i }));

    expect(
      screen.getByText(translations.no.ui.pleaseEnterPlayerName)
    ).toBeInTheDocument();
  });

  it("navigates to /create-room when name is provided", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage language="en" />} />
          <Route path="/create-room" element={<div>CreateRoomRoute</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(
      screen.getByPlaceholderText(translations.no.ui.placeholderPlayerName),
      "Kristine"
    );

    await user.click(screen.getByRole("button", { name: /create room/i }));

    expect(screen.getByText("CreateRoomRoute")).toBeInTheDocument();
    expect(localStorage.getItem("playerName")).toBe("Kristine");
  });
});
