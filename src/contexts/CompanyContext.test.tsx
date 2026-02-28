import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyProvider, useCompany } from "./CompanyContext";

function TestConsumer() {
  const { activeCompany, activeCompanies, setActiveCompanies, companyLabel } = useCompany();
  return React.createElement("div", null,
    React.createElement("span", { "data-testid": "company" }, activeCompany),
    React.createElement("span", { "data-testid": "companies" }, JSON.stringify(activeCompanies)),
    React.createElement("span", { "data-testid": "label" }, companyLabel),
    React.createElement("button", { onClick: () => setActiveCompanies(["TOKENIZA"]) }, "Switch Tokeniza"),
    React.createElement("button", { onClick: () => setActiveCompanies(["BLUE"]) }, "Switch Blue"),
    React.createElement("button", { onClick: () => setActiveCompanies(["BLUE", "TOKENIZA"]) }, "Switch Both"),
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(CompanyProvider, null, children)
  );
}

describe("CompanyContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to BLUE when no stored value", () => {
    const { getByTestId } = render(
      React.createElement(Wrapper, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("BLUE");
  });

  it("switches company and persists to localStorage", () => {
    const { getByTestId, getByText } = render(
      React.createElement(Wrapper, null,
        React.createElement(TestConsumer)
      )
    );
    act(() => {
      getByText("Switch Tokeniza").click();
    });
    expect(getByTestId("company").textContent).toBe("TOKENIZA");
    expect(localStorage.getItem("bluecrm-companies")).toBe('["TOKENIZA"]');
  });

  it("supports multi-company selection", () => {
    const { getByTestId, getByText } = render(
      React.createElement(Wrapper, null,
        React.createElement(TestConsumer)
      )
    );
    act(() => {
      getByText("Switch Both").click();
    });
    expect(getByTestId("companies").textContent).toBe('["BLUE","TOKENIZA"]');
    expect(getByTestId("label").textContent).toBe("2 empresas");
  });

  it("migrates old lowercase values", () => {
    localStorage.setItem("bluecrm-company", "blue");
    const { getByTestId } = render(
      React.createElement(Wrapper, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("BLUE");
  });

  it("falls back to BLUE for invalid stored value", () => {
    localStorage.setItem("bluecrm-company", "invalid");
    const { getByTestId } = render(
      React.createElement(Wrapper, null,
        React.createElement(TestConsumer)
      )
    );
    expect(getByTestId("company").textContent).toBe("BLUE");
  });
});
