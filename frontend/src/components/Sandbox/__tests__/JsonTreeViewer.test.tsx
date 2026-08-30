import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { JsonTreeViewer } from "../JsonTreeViewer";
import {
  analyzeJson,
  formatJson,
  minifyJson,
  parseJsonSafe,
  isValidJson,
  searchJson,
  SAMPLE_PRESETS,
} from "../json/jsonUtils";

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("jsonUtils", () => {
  describe("parseJsonSafe", () => {
    it("parses valid JSON", () => {
      const result = parseJsonSafe('{"a":1}');
      expect(result.value).toEqual({ a: 1 });
      expect(result.error).toBeNull();
    });

    it("returns error for invalid JSON", () => {
      const result = parseJsonSafe("{invalid}");
      expect(result.value).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe("isValidJson", () => {
    it("returns true for valid JSON", () => {
      expect(isValidJson('{"key":"value"}')).toBe(true);
      expect(isValidJson("[1,2,3]")).toBe(true);
    });

    it("returns false for invalid JSON", () => {
      expect(isValidJson("{bad")).toBe(false);
    });
  });

  describe("formatJson", () => {
    it("formats with specified indent", () => {
      const result = formatJson({ a: 1 }, 4);
      expect(result).toContain("    ");
      expect(result).toContain('"a"');
    });
  });

  describe("minifyJson", () => {
    it("removes whitespace", () => {
      const result = minifyJson({ a: 1 });
      expect(result).toBe('{"a":1}');
    });
  });

  describe("analyzeJson", () => {
    it("counts all node types", () => {
      const data = { a: "str", b: 42, c: true, d: null, e: [1, 2], f: { nested: true } };
      const stats = analyzeJson(data);
      expect(stats.nodeCount).toBe(9);
      expect(stats.stringCount).toBe(1);
      expect(stats.numberCount).toBe(3);
      expect(stats.booleanCount).toBe(2);
      expect(stats.nullCount).toBe(1);
      expect(stats.arrayCount).toBe(1);
      expect(stats.objectCount).toBe(2);
      expect(stats.maxDepth).toBe(3);
    });

    it("handles empty objects", () => {
      const stats = analyzeJson({});
      expect(stats.nodeCount).toBe(1);
      expect(stats.maxDepth).toBe(0);
    });
  });

  describe("searchJson", () => {
    it("finds matching keys", () => {
      const data = { name: "test", count: 42 };
      const results = searchJson(data, "name");
      expect(results.length).toBe(1);
      expect(results[0].key).toBe("name");
    });

    it("finds matching values", () => {
      const data = { greeting: "hello world" };
      const results = searchJson(data, "hello");
      expect(results.length).toBe(1);
    });

    it("returns empty for no match", () => {
      expect(searchJson({ a: 1 }, "xyz")).toHaveLength(0);
    });

    it("returns empty for empty query", () => {
      expect(searchJson({ a: 1 }, "")).toHaveLength(0);
    });

    it("searches nested structures", () => {
      const data = { outer: { inner: { target: "found it" } } };
      const results = searchJson(data, "found");
      expect(results.length).toBe(1);
    });
  });

  describe("SAMPLE_PRESETS", () => {
    it("has at least 3 presets", () => {
      expect(SAMPLE_PRESETS.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("JsonTreeViewer", () => {
  it("renders the header with title", () => {
    renderWithRouter(<JsonTreeViewer />);
    expect(screen.getByText("JSON Tree Viewer & Formatter")).toBeInTheDocument();
  });

  it("renders the input textarea", () => {
    renderWithRouter(<JsonTreeViewer />);
    expect(screen.getByPlaceholderText('{"paste": "your JSON here"}')).toBeInTheDocument();
  });

  it("renders sample data buttons", () => {
    renderWithRouter(<JsonTreeViewer />);
    expect(screen.getByText("Sample Data")).toBeInTheDocument();
    expect(screen.getByText("App Config")).toBeInTheDocument();
  });

  it("renders tree/raw toggle", () => {
    renderWithRouter(<JsonTreeViewer />);
    expect(screen.getByText("Tree")).toBeInTheDocument();
    expect(screen.getByText("Raw")).toBeInTheDocument();
  });

  it("shows empty state when no input", () => {
    renderWithRouter(<JsonTreeViewer />);
    expect(screen.getByText(/Paste JSON on the left/)).toBeInTheDocument();
  });

  it("shows error for invalid JSON", () => {
    renderWithRouter(<JsonTreeViewer />);
    const textarea = screen.getByPlaceholderText('{"paste": "your JSON here"}');
    fireEvent.change(textarea, { target: { value: "{invalid" } });
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("shows valid badge for valid JSON", () => {
    renderWithRouter(<JsonTreeViewer />);
    const textarea = screen.getByPlaceholderText('{"paste": "your JSON here"}');
    fireEvent.change(textarea, { target: { value: '{"key": "value"}' } });
    expect(screen.getByText("Valid")).toBeInTheDocument();
  });

  it("loads a preset and shows stats", () => {
    renderWithRouter(<JsonTreeViewer />);
    fireEvent.click(screen.getByText("App Config"));
    expect(screen.getByText("Statistics")).toBeInTheDocument();
    expect(screen.getByText("Nodes")).toBeInTheDocument();
  });

  it("shows tree view after loading preset", () => {
    renderWithRouter(<JsonTreeViewer />);
    fireEvent.click(screen.getByText("App Config"));
    expect(screen.getByText("application")).toBeInTheDocument();
  });

  it("toggles to raw view", () => {
    renderWithRouter(<JsonTreeViewer />);
    fireEvent.click(screen.getByText("App Config"));
    fireEvent.click(screen.getByText("Raw"));
    expect(screen.getByText("2 spaces")).toBeInTheDocument();
  });
});
