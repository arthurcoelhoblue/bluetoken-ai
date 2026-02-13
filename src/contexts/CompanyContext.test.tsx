import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { CompanyProvider, useCompany } from "./CompanyContext";

function TestConsumer() {
  const { activeCompany, setActiveCompany, companyLabel } = useCompany();
  return React.createElement("div", null,
    React.createElement("span", { "data-testid": "company" }, activeCompany),
    React.createElement("span", { "data-testid": "label" }, companyLabel),
    React.createElement("button", { onClick: () => setActiveCompany("tokeniza") }, "Switch Tokeniza"),
    React.createElement("button", { onClick: () => setActiveCompany("all") }, "Switch All"),
  );
}

describe("CompanyContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to blue when no stored value", () => {
    const { getByTestId } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("blue");
    expect(getByTestId("label").textContent).toBe("Blue Consult");
  });

  it("switches company and persists to localStorage", () => {
    const { getByTestId, getByText } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    getByText("Switch Tokeniza").click();
    expect(getByTestId("company").textContent).toBe("tokeniza");
    expect(localStorage.getItem("bluecrm-company")).toBe("tokeniza");
  });

  it("reads stored value on mount", () => {
    localStorage.setItem("bluecrm-company", "all");
    const { getByTestId } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("all");
    expect(getByTestId("label").textContent).toBe("Todas");
  });

  it("falls back to blue for invalid stored value", () => {
    localStorage.setItem("bluecrm-company", "invalid");
    const { getByTestId } = render(
      React.createElement(CompanyProvider, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("blue");
  });
});
