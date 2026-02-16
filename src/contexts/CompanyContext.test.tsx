import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { CompanyProvider, useCompany } from "./CompanyContext";

function TestConsumer() {
  const { activeCompany, setActiveCompany, companyLabel } = useCompany();
  return React.createElement("div", null,
    React.createElement("span", { "data-testid": "company" }, activeCompany),
    React.createElement("span", { "data-testid": "label" }, companyLabel),
    React.createElement("button", { onClick: () => setActiveCompany("TOKENIZA") }, "Switch Tokeniza"),
    React.createElement("button", { onClick: () => setActiveCompany("ALL") }, "Switch All"),
  );
}

describe("CompanyContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to BLUE when no stored value", () => {
    const { getByTestId } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("BLUE");
    expect(getByTestId("label").textContent).toBe("Blue Consult");
  });

  it("switches company and persists to localStorage", () => {
    const { getByTestId, getByText } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    act(() => {
      getByText("Switch Tokeniza").click();
    });
    expect(getByTestId("company").textContent).toBe("TOKENIZA");
    expect(localStorage.getItem("bluecrm-company")).toBe("TOKENIZA");
  });

  it("reads stored value on mount", () => {
    localStorage.setItem("bluecrm-company", "ALL");
    const { getByTestId } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("ALL");
    expect(getByTestId("label").textContent).toBe("Todas");
  });

  it("migrates old lowercase values", () => {
    localStorage.setItem("bluecrm-company", "blue");
    const { getByTestId } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("BLUE");
  });

  it("falls back to BLUE for invalid stored value", () => {
    localStorage.setItem("bluecrm-company", "invalid");
    const { getByTestId } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("BLUE");
  });
});
