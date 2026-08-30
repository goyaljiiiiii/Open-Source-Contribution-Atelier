import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TemplateMarketplacePage from "../pages/TemplateMarketplacePage";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../lib/clipboard", () => ({
  copyText: vi.fn(),
}));

vi.mock("../api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from "../api";
import { copyText } from "../lib/clipboard";
import { toast } from "react-hot-toast";

const composeContent = "services:\n  web:\n    image: node:20\n";

describe("TemplateMarketplacePage", () => {
  beforeEach(() => {
    // eslint-disable-next-line no-restricted-syntax
    vi.useRealTimers();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("template-categories")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({
        data: [
          {
            id: "tpl-1",
            category: "cat-1",
            name: "Node Starter",
            description: "Starter template",
            language: "javascript",
            tags: ["node"],
            is_official: true,
            use_count: 3,
            files: [
              {
                id: "file-1",
                path: "docker-compose.yml",
                content: composeContent,
              },
            ],
          },
        ],
      });
    });
    vi.mocked(copyText).mockResolvedValue({ ok: true, method: "clipboard-api" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("copies docker-compose.yml from a template card without opening the modal", async () => {
    render(<TemplateMarketplacePage />);

    const copyButton = await screen.findByRole("button", {
      name: "Copy docker-compose.yml",
    });

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(copyText).toHaveBeenCalledWith(composeContent);
    expect(toast.success).toHaveBeenCalledWith(
      "docker-compose.yml copied to clipboard!",
    );
  });
});
